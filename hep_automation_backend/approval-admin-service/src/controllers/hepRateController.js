const HepRate = require("../models/hepRateConfigSchema");

/* ─────────────────────────────────────────────
   HEP RATE CONTROLLER
   Manages the yearly-revised Harbour Entry Permit
   charges (Individual / Vehicle / Cargo). All rates
   are GST-inclusive. verifyToken populates req.user.
───────────────────────────────────────────── */

/**
 * GET /hep-rate
 * Returns all category rate rows. ATM / Admin access.
 */
exports.getHepRates = async (req, res) => {
  try {
    const rates = await HepRate.getHepRates();
    return res.json({ success: true, data: rates });
  } catch (error) {
    console.error("getHepRates error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch HEP rates" });
  }
};

/**
 * PUT /hep-rate/:category
 * Body: { daily_rate, monthly_rate, yearly_rate }
 * Admin / ATM only.
 */
exports.updateHepRate = async (req, res) => {
  try {
    const category = String(req.params.category || "").toUpperCase();
    const { daily_rate, monthly_rate, yearly_rate } = req.body;

    if (!HepRate.VALID_CATEGORIES.includes(category)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid rate category" });
    }

    const daily = parseFloat(daily_rate);
    const monthly = parseFloat(monthly_rate);
    const yearly = parseFloat(yearly_rate);

    for (const [name, val] of [
      ["daily_rate", daily],
      ["monthly_rate", monthly],
      ["yearly_rate", yearly],
    ]) {
      if (isNaN(val) || val < 0) {
        return res.status(400).json({
          success: false,
          message: `${name} must be a valid non-negative number`,
        });
      }
    }

    const updated = await HepRate.upsertHepRate(
      category,
      daily,
      monthly,
      yearly,
      req.user?.userId || req.user?.id || null
    );

    return res.json({
      success: true,
      message: `HEP rate for ${category} updated`,
      data: updated,
    });
  } catch (error) {
    console.error("updateHepRate error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update HEP rate" });
  }
};
