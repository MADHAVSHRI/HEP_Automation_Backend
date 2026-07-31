const { pool } = require("../dbconfig/db");

exports.getActiveFees = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        category,
        daily_fee,
        monthly_fee,
        yearly_fee
      FROM pass_fee_master
      WHERE is_active = true
      ORDER BY category;
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch fee master",
      error: err.message,
    });
  }
};