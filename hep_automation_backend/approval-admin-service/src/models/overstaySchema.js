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
      daily_rate            DECIMAL(12,2) NOT NULL DEFAULT 100.00,
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

const Overstay = {
  initTable: initOverstayTable,

  /* ── 1. DETECT: pass entities whose dateTo < TODAY not yet levied ── */
  async detectOverstays() {
    await initOverstayTable();

    const personRateDefault = parseFloat(process.env.OVERSTAY_DAILY_RATE_PERSON || "100");
    const vehicleRateDefault = parseFloat(process.env.OVERSTAY_DAILY_RATE_VEHICLE || "200");

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
        CURRENT_DATE - pp."dateTo"::date AS overstay_days,
        $1::numeric          AS daily_rate
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
            AND oc.status NOT IN ('EXCEPTION_APPROVED','WAIVED')
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
        CURRENT_DATE - pv."dateTo"::date AS overstay_days,
        $1::numeric          AS daily_rate
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
            AND oc.status NOT IN ('EXCEPTION_APPROVED','WAIVED')
        )
      ORDER BY overstay_days DESC
    `;

    const [persons, vehicles] = await Promise.all([
      pool.query(personsQuery, [personRateDefault]),
      pool.query(vehiclesQuery, [vehicleRateDefault]),
    ]);

    // Annotate with computed total
    const annotate = (rows) =>
      rows.map((r) => ({
        ...r,
        total_amount: parseFloat(r.daily_rate) * parseInt(r.overstay_days, 10),
      }));

    return [...annotate(persons.rows), ...annotate(vehicles.rows)];
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
      `SELECT oc.*, a."entityName" AS company_name, a."loginId" AS login_id
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
      `SELECT * FROM overstay_charges WHERE agent_id = $1 ORDER BY created_at DESC`,
      [agentId]
    );
    return res.rows;
  },

  /* ── 5. GET BY ID ── */
  async getById(id) {
    const res = await pool.query(
      `SELECT oc.*, a."entityName" AS company_name, a."email" AS agent_email
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
       SET status = 'PAID', payment_method = $2, transaction_id = $3, updated_at = NOW()
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
      `SELECT oc.*, a."email" AS agent_email, a."entityName" AS company_name
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
};

module.exports = Overstay;
