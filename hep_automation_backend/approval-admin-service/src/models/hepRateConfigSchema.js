const { pool } = require("../dbconfig/db");

/**
 * HEP RATE CONFIG MODEL
 * ─────────────────────────────────────────────
 * Holds the Harbour Entry Permit (HEP) charge rates that the ATM Pass
 * Section revises every year. Rates are stored per category
 * (INDIVIDUAL / VEHICLE / CARGO) with a daily, monthly and yearly amount.
 *
 * All figures are INCLUSIVE of GST — the amount stored is the amount payable.
 * Raw-SQL, idempotent init (mirrors blacklist_penalty_config) so the ATM
 * portal and the agent pass_request page read from a single source of truth.
 */

/** Canonical categories and their default (GST-inclusive) seed rates. */
const CATEGORY_META = {
  INDIVIDUAL: {
    label: "Individual",
    description: "Individual person harbour entry permit.",
    daily: 13,
    monthly: 191,
    yearly: 508,
  },
  VEHICLE: {
    label: "Vehicle",
    description: "Standard vehicle harbour entry permit.",
    daily: 32,
    monthly: 382,
    yearly: 2539,
  },
  CARGO: {
    label: "Cargo Handling Equipments",
    description:
      "Poclain, Dozers, Excavators, Forklift, Dumper, JCB Earthmover, Crane, Mobile Crane, Pay loader.",
    daily: 51,
    monthly: 571,
    yearly: 3807,
  },
};

const VALID_CATEGORIES = Object.keys(CATEGORY_META);

/**
 * Resolve a userId safely against the local `users` table.
 * The acting ATM user may not exist in THIS service's DB — return NULL
 * rather than risk a FK violation on updated_by.
 */
async function safeUserId(userId) {
  if (!userId) return null;
  try {
    const r = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
    return r.rows.length > 0 ? userId : null;
  } catch {
    return null;
  }
}

module.exports = {
  CATEGORY_META,
  VALID_CATEGORIES,

  /**
   * Initialise the hep_rate_config table (idempotent — safe on startup).
   * Seeds the three categories with the current GST-inclusive rates.
   */
  async initHepRateConfigTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hep_rate_config (
        category      VARCHAR(20)    PRIMARY KEY,
        label         TEXT           NOT NULL,
        description    TEXT,
        daily_rate    NUMERIC(12,2)  NOT NULL DEFAULT 0,
        monthly_rate  NUMERIC(12,2)  NOT NULL DEFAULT 0,
        yearly_rate   NUMERIC(12,2)  NOT NULL DEFAULT 0,
        updated_by    INT,
        "updatedAt"   TIMESTAMPTZ    DEFAULT NOW()
      )
    `);

    for (const category of VALID_CATEGORIES) {
      const m = CATEGORY_META[category];
      await pool.query(
        `INSERT INTO hep_rate_config
           (category, label, description, daily_rate, monthly_rate, yearly_rate)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (category) DO NOTHING`,
        [category, m.label, m.description, m.daily, m.monthly, m.yearly]
      );
    }
  },

  /**
   * Fetch all rate rows in a stable, display-friendly order.
   */
  async getHepRates() {
    const result = await pool.query(
      `SELECT * FROM hep_rate_config
       ORDER BY CASE category
                  WHEN 'INDIVIDUAL' THEN 1
                  WHEN 'VEHICLE'    THEN 2
                  WHEN 'CARGO'      THEN 3
                  ELSE 99
                END`
    );
    return result.rows;
  },

  /**
   * Update (upsert) the daily/monthly/yearly rate for a single category.
   */
  async upsertHepRate(category, dailyRate, monthlyRate, yearlyRate, updatedBy) {
    const meta = CATEGORY_META[category] || {
      label: category,
      description: null,
    };
    const safeBy = await safeUserId(parseInt(updatedBy, 10) || null);

    const result = await pool.query(
      `INSERT INTO hep_rate_config
         (category, label, description, daily_rate, monthly_rate, yearly_rate, updated_by, "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (category) DO UPDATE
         SET daily_rate   = EXCLUDED.daily_rate,
             monthly_rate = EXCLUDED.monthly_rate,
             yearly_rate  = EXCLUDED.yearly_rate,
             updated_by   = EXCLUDED.updated_by,
             "updatedAt"  = NOW()
       RETURNING *`,
      [
        category,
        meta.label,
        meta.description,
        dailyRate,
        monthlyRate,
        yearlyRate,
        safeBy,
      ]
    );

    return result.rows[0];
  },
};
