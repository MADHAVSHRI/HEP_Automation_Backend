const { pool } = require("../dbconfig/db");

/* ──────────────────────────────────────────────
   DB INIT — create table + indexes if not present
   (idempotent; runs once on service start)
────────────────────────────────────────────── */
async function initOverstayTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS overstay_charges (
      id                    SERIAL PRIMARY KEY,
      entity_type           VARCHAR(20)  NOT NULL CHECK (entity_type IN ('PERSON','VEHICLE','DRIVER')),
      entity_id             INTEGER,
      pass_request_id       INTEGER,
      agent_id              INTEGER,
      identifier            VARCHAR(100) NOT NULL,
      entity_name           VARCHAR(255),
      pass_no               VARCHAR(100),
      date_from             DATE,
      date_to               DATE,
      overstay_days         INTEGER      NOT NULL DEFAULT 0,
      daily_rate            DECIMAL(12,2) NOT NULL DEFAULT 0,
      total_amount          DECIMAL(12,2) NOT NULL DEFAULT 0,
      status                VARCHAR(30)  NOT NULL DEFAULT 'PENDING',
      payment_method        VARCHAR(50),
      transaction_id        VARCHAR(100),
      exception_reason      TEXT,
      exception_decided_by  VARCHAR(100),
      exception_decided_at  TIMESTAMP WITH TIME ZONE,
      levied_by             VARCHAR(100),
      levied_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      email_sent            BOOLEAN      NOT NULL DEFAULT FALSE,
      last_email_sent_at    TIMESTAMP WITH TIME ZONE,
      notes                 TEXT,
      created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_overstay_agent_id  ON overstay_charges (agent_id);
    CREATE INDEX IF NOT EXISTS idx_overstay_status     ON overstay_charges (status);
    CREATE INDEX IF NOT EXISTS idx_overstay_entity     ON overstay_charges (entity_type, identifier);
  `);
}

// Same cargo-equipment classification the frontend uses, kept in sync
// with vehicle_types.name values so VEHICLE vs CARGO_HANDLING_EQUIPMENT
// resolve identically on both sides.
const CARGO_EQUIPMENT_TYPES = [
  "CRANE", "DOZERS", "DUMPERS", "EXCAVATORS", "FORKLIFT",
  "JCB EARTHMOVER", "MOBILE CRANE", "PAY LOADER", "POCLAIN",
];
const LIVE_AMOUNT_SELECT = `
  CASE
    WHEN oc.status IN ('PENDING', 'EXCEPTION_REQUESTED', 'EXCEPTION_REJECTED')
      THEN GREATEST(CURRENT_DATE - oc.date_to::date, 0)
    ELSE oc.overstay_days
  END AS current_overstay_days,
  CASE
    WHEN oc.status IN ('PENDING', 'EXCEPTION_REQUESTED', 'EXCEPTION_REJECTED')
      THEN ROUND((oc.daily_rate * GREATEST(CURRENT_DATE - oc.date_to::date, 0))::numeric, 2)
    ELSE oc.total_amount
  END AS current_total_amount
`;
/**
 * Load daily fees from hep_rate_config — the single source of truth for
 * HEP charges maintained by ATM. Returns e.g. { INDIVIDUAL: 13.00, VEHICLE: 32.00, CARGO: 51.00 }
 */
async function loadDailyRates() {
  const res = await pool.query(
    `SELECT category, daily_rate FROM hep_rate_config`
  );
  const rates = {};
  res.rows.forEach((row) => {
    rates[String(row.category).toUpperCase()] = parseFloat(row.daily_rate);
  });
  return rates;
}

async function initSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key         VARCHAR(100) PRIMARY KEY,
      value       BOOLEAN NOT NULL DEFAULT true,
      updated_by  VARCHAR(100),
      updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  // Seed the default row if it doesn't exist yet — defaults to OFF per the
  // client's request (manual notify only, no auto emails for first 2 months).
  await pool.query(`
    INSERT INTO system_settings (key, value)
    VALUES ('overstay_auto_email_enabled', false)
    ON CONFLICT (key) DO NOTHING;
  `);
  await pool.query(`
  INSERT INTO system_settings (key, value)
  VALUES ('overstay_pass_block_enabled', true)
  ON CONFLICT (key) DO NOTHING;
`);
}

const Overstay = {
  initTable: initOverstayTable,

  /* ── 1. DETECT: pass entities whose dateTo < TODAY not yet levied ── */
  async detectOverstays() {
    await initOverstayTable();

    const rates = await loadDailyRates();

    const missing = [];
    if (rates.INDIVIDUAL === undefined) missing.push("INDIVIDUAL");
    if (rates.VEHICLE === undefined) missing.push("VEHICLE");
    if (rates.CARGO === undefined) missing.push("CARGO");
    if (missing.length > 0) {
      throw new Error(
        `Missing HEP rate configuration for: ${missing.join(", ")}. ` +
        `Overstay detection cannot compute penalties without these.`
      );
    }

    const personsQuery = `
      SELECT
        pp.id                AS entity_id,
        CASE WHEN LOWER(ht.name) LIKE '%driver%' THEN 'DRIVER' ELSE 'PERSON' END AS entity_type,
        pp."passRequestId"   AS pass_request_id,
        pr."agentId"         AS agent_id,
        a."entityName"       AS company_name,
        a."loginId"          AS login_id,
        pp."aadharNo"        AS identifier,
        pp.name              AS entity_name,
        pp."personPassNo"    AS pass_no,
        pp."dateFrom"        AS date_from,
        pp."dateTo"          AS date_to,
        CURRENT_DATE - pp."dateTo"::date AS overstay_days
      FROM pass_persons pp
      JOIN pass_requests pr ON pr.id = pp."passRequestId"
      LEFT JOIN hep_types ht ON ht.id = pp."hepTypeId"
      LEFT JOIN "Agents" a ON a.id = pr."agentId"
      WHERE (LOWER(pp.status::text) = 'approved' OR pp.status IS NULL)
        AND pp."dateTo"::date < CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM overstay_charges oc
          WHERE oc.entity_type IN ('PERSON','DRIVER')
            AND oc.entity_id = pp.id
            AND oc.pass_request_id = pp."passRequestId"
        )
      ORDER BY overstay_days DESC
    `;

    const vehiclesQuery = `
      SELECT
        pv.id                AS entity_id,
        'VEHICLE'            AS entity_type,
        pv."passRequestId"   AS pass_request_id,
        pr."agentId"         AS agent_id,
        a."entityName"       AS company_name,
        a."loginId"          AS login_id,
        pv."registrationNo"  AS identifier,
        COALESCE(vt.name, pv."registrationNo") AS entity_name,
        vt.name              AS vehicle_type_name,
        pv."vehiclePassNo"   AS pass_no,
        pv."dateFrom"        AS date_from,
        pv."dateTo"          AS date_to,
        CURRENT_DATE - pv."dateTo"::date AS overstay_days
      FROM pass_vehicles pv
      JOIN pass_requests pr ON pr.id = pv."passRequestId"
      LEFT JOIN vehicle_types vt ON vt.id = pv."vehicleTypeId"
      LEFT JOIN "Agents" a ON a.id = pr."agentId"
      WHERE (LOWER(pv.status::text) = 'approved' OR pv.status IS NULL)
        AND pv."dateTo"::date < CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM overstay_charges oc
          WHERE oc.entity_type = 'VEHICLE'
            AND oc.entity_id = pv.id
            AND oc.pass_request_id = pv."passRequestId"
        )
      ORDER BY overstay_days DESC
    `;

    const [persons, vehicles] = await Promise.all([
      pool.query(personsQuery),
      pool.query(vehiclesQuery),
    ]);

    // Persons/Drivers: always INDIVIDUAL rate
    const personRows = persons.rows.map((r) => {
      const dailyRate = rates.INDIVIDUAL;
      return {
        ...r,
        daily_rate: dailyRate,
        total_amount: parseFloat((dailyRate * parseInt(r.overstay_days, 10)).toFixed(2)),
      };
    });

    // Vehicles: rate depends on whether it's cargo handling equipment
    const vehicleRows = vehicles.rows.map((r) => {
      const typeName = String(r.vehicle_type_name || "").toUpperCase().trim();
      const isCargoEquipment = CARGO_EQUIPMENT_TYPES.includes(typeName);
      const dailyRate = isCargoEquipment ? rates.CARGO : rates.VEHICLE;
      return {
        ...r,
        daily_rate: dailyRate,
        total_amount: parseFloat((dailyRate * parseInt(r.overstay_days, 10)).toFixed(2)),
      };
    });

    return [...personRows, ...vehicleRows];
  },

  async createNotification(data) {
    // Check if a record already exists
    const existing = await pool.query(
      `SELECT *
      FROM overstay_charges
      WHERE entity_type = $1
        AND entity_id = $2
        AND pass_request_id = $3
      LIMIT 1`,
      [
        data.entity_type,
        data.entity_id,
        data.pass_request_id,
      ]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Otherwise create it
    return this.levyCharge(data);
  },
  
  /* ── 2. LEVY: insert a new charge ── */
  async levyCharge(data) {
    const res = await pool.query(
      `INSERT INTO overstay_charges (
          entity_type, entity_id, pass_request_id, agent_id,
          identifier, entity_name, pass_no, date_from, date_to,
          overstay_days, daily_rate, total_amount, status,
          levied_by, levied_at, notes
       ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          'PENDING', $13, NOW(), $14
       ) RETURNING *`,
      [
        data.entity_type,
        data.entity_id || null,
        data.pass_request_id || null,
        data.agent_id || null,
        data.identifier,
        data.entity_name || null,
        data.pass_no || null,
        data.date_from || null,
        data.date_to || null,
        data.overstay_days,
        data.daily_rate,
        data.total_amount,
        data.levied_by || null,
        data.notes || null,
      ]
    );
    return res.rows[0];
  },

  /* ── 3. LIST ALL CHARGES (ATM/Traffic) with optional filters ── */
  async listCharges({ status, entity_type, agent_id, limit = 200, offset = 0 } = {}) {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) { conditions.push(`oc.status = $${idx++}`); params.push(status); }
    if (entity_type) { conditions.push(`oc.entity_type = $${idx++}`); params.push(entity_type); }
    if (agent_id) { conditions.push(`oc.agent_id = $${idx++}`); params.push(agent_id); }

    const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
    params.push(limit, offset);

    const res = await pool.query(
      `SELECT oc.*, ${LIVE_AMOUNT_SELECT},
              a."entityName" AS company_name, a."loginId" AS login_id
      FROM overstay_charges oc
      LEFT JOIN "Agents" a ON a.id = oc.agent_id
      ${where}
      ORDER BY oc.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );
    return res.rows;
  },

  /* ── 4. MY CHARGES (Agent) ── */
  async myCharges(agentId) {
    const res = await pool.query(
      `SELECT oc.*, ${LIVE_AMOUNT_SELECT}
      FROM overstay_charges oc
      WHERE agent_id = $1 ORDER BY created_at DESC`,
      [agentId]
    );
    return res.rows;
  },

  /* ── 5. GET BY ID ── */
  async getById(id) {
    const res = await pool.query(
      `SELECT oc.*, ${LIVE_AMOUNT_SELECT},
              a."entityName" AS company_name, a."email" AS agent_email, a."loginId" AS login_id
      FROM overstay_charges oc
      LEFT JOIN "Agents" a ON a.id = oc.agent_id
      WHERE oc.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  },

  /* ── 6. PAY ── */
  async pay(id, { payment_method, transaction_id }) {
    const res = await pool.query(
      `UPDATE overstay_charges
      SET status = 'PAID',
          payment_method = $2,
          transaction_id = $3,
          overstay_days = GREATEST(CURRENT_DATE - date_to::date, 0),
          total_amount = ROUND((daily_rate * GREATEST(CURRENT_DATE - date_to::date, 0))::numeric, 2),
          updated_at = NOW()
      WHERE id = $1 AND status IN ('PENDING','EXCEPTION_REJECTED')
      RETURNING *`,
      [id, payment_method || "GATEWAY", transaction_id || `TXN-${Date.now()}`]
    );
    return res.rows[0] || null;
  },

  /* ── 7. REQUEST EXCEPTION ── */
  async requestException(id, exception_reason) {
    const res = await pool.query(
      `UPDATE overstay_charges
       SET status = 'EXCEPTION_REQUESTED', exception_reason = $2, updated_at = NOW()
       WHERE id = $1 AND status = 'PENDING'
       RETURNING *`,
      [id, exception_reason]
    );
    return res.rows[0] || null;
  },

  /* ── 8. LIST EXCEPTION REQUESTS (Traffic) ── */
  async listExceptionRequests() {
    const res = await pool.query(
      `SELECT oc.*, a."entityName" AS company_name, a."email" AS agent_email
       FROM overstay_charges oc
       LEFT JOIN "Agents" a ON a.id = oc.agent_id
       WHERE oc.status = 'EXCEPTION_REQUESTED'
       ORDER BY oc.updated_at DESC`
    );
    return res.rows;
  },

  /* ── 9. APPROVE EXCEPTION (Traffic) ── */
  async approveException(id, decidedBy) {
    const res = await pool.query(
      `UPDATE overstay_charges
       SET status = 'EXCEPTION_APPROVED', exception_decided_by = $2, exception_decided_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'EXCEPTION_REQUESTED'
       RETURNING *`,
      [id, decidedBy]
    );
    return res.rows[0] || null;
  },

  /* ── 10. REJECT EXCEPTION (Traffic) ── */
  async rejectException(id, decidedBy) {
    const res = await pool.query(
      `UPDATE overstay_charges
       SET status = 'EXCEPTION_REJECTED', exception_decided_by = $2, exception_decided_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'EXCEPTION_REQUESTED'
       RETURNING *`,
      [id, decidedBy]
    );
    return res.rows[0] || null;
  },

  /* ── 11. WAIVE (ATM) ── */
  async waive(id, waivedBy) {
    const res = await pool.query(
      `UPDATE overstay_charges
       SET status = 'WAIVED', exception_decided_by = $2, exception_decided_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status NOT IN ('PAID','WAIVED')
       RETURNING *`,
      [id, waivedBy]
    );
    return res.rows[0] || null;
  },

  /* ── 12. DAILY EMAIL JOB helper: fetch pending unsent ── */
  async fetchPendingForEmail() {
    const today = new Date().toISOString().slice(0, 10);
    const res = await pool.query(
      `SELECT oc.*, ${LIVE_AMOUNT_SELECT},
              a."email" AS agent_email, a."entityName" AS company_name, a."loginId" AS login_id
      FROM overstay_charges oc
      LEFT JOIN "Agents" a ON a.id = oc.agent_id
      WHERE oc.status = 'PENDING'
        AND (oc.last_email_sent_at IS NULL OR oc.last_email_sent_at::date < $1::date)
        AND a.email IS NOT NULL`,
      [today]
    );
    return res.rows;
  },

  /* ── 13. MARK EMAIL SENT ── */
  async markEmailSent(id) {
    await pool.query(
      `UPDATE overstay_charges SET email_sent = TRUE, last_email_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );
  },

  /* ── 14. GET AGENT EMAIL by agent_id ── */
  async getAgentEmail(agentId) {
    const res = await pool.query(
      `SELECT email FROM "Agents" WHERE id = $1`,
      [agentId]
    );
    return res.rows[0]?.email || null;
  },
  /* ── 15. AUTO-EMAIL SETTING (system_settings) ── */
/* ── 15. GENERIC SETTINGS GET/SET ── */
async getSetting(key, defaultValue = false) {
  await initSettingsTable();
  const res = await pool.query(
    `SELECT value, updated_by, updated_at FROM system_settings WHERE key = $1`,
    [key]
  );
  return res.rows[0] || { value: defaultValue, updated_by: null, updated_at: null };
},

async setSetting(key, enabled, updatedBy) {
  await initSettingsTable();
  const res = await pool.query(
    `INSERT INTO system_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()
     RETURNING *`,
    [key, enabled, updatedBy]
  );
  return res.rows[0];
},

// Kept for backward compatibility with existing auto-email routes
async getAutoEmailSetting() {
  return this.getSetting('overstay_auto_email_enabled', false);
},
async setAutoEmailSetting(enabled, updatedBy) {
  return this.setSetting('overstay_auto_email_enabled', enabled, updatedBy);
},

// New: pass-blocking toggle
async getPassBlockSetting() {
  return this.getSetting('overstay_pass_block_enabled', true);
},
async setPassBlockSetting(enabled, updatedBy) {
  return this.setSetting('overstay_pass_block_enabled', enabled, updatedBy);
},
};

module.exports = Overstay;