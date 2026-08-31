const Report = require("../models/reportSchema");

exports.getRegisteredUserOptions = async (req, res) => {
  try {
    const companyTypes = await Report.getRegisteredUserOptions();

    return res.status(200).json({
      success: true,
      data: {
        companyTypes,
      },
    });
  } catch (error) {
    console.error("Registered users report options error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch report options",
    });
  }
};

exports.getRegisteredUsersReport = async (req, res) => {
  try {
    const report = await Report.getRegisteredUsersReport(req.query);

    return res.status(200).json({
      success: true,
      ...report,
    });
  } catch (error) {
    console.error("Registered users report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch registered users report",
    });
  }
};

exports.getTypeOfPassIssuedReport = async (req, res) => {
  try {
    const report = await Report.getTypeOfPassIssuedReport(req.query);

    return res.status(200).json({
      success: true,
      ...report,
    });
  } catch (error) {
    console.error("Type of pass issued report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch type of pass issued report",
    });
  }
};

const sendReport = (method, label) => async (req, res) => {
  try {
    const report = await Report[method](req.query);
    return res.status(200).json({ success: true, ...report });
  } catch (error) {
    console.error(`${label} report error:`, error);
    return res.status(500).json({ success: false, message: `Failed to fetch ${label} report` });
  }
};

exports.getAllPassIssuanceOptions = async (req, res) => {
  try {
    return res.status(200).json({ success: true, data: await Report.getAllPassIssuanceOptions() });
  } catch (error) {
    console.error("All pass issuance options error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch report options" });
  }
};
exports.getAllPassIssuanceReport = sendReport("getAllPassIssuanceReport", "all pass issuance");
exports.getRevenueReport = sendReport("getRevenueReport", "revenue");
exports.getPassApprovalReport = sendReport("getPassApprovalReport", "pass approval");
exports.getQrInventorySummary = sendReport("getQrInventorySummary", "QR pass inventory summary");
exports.getGateWiseSummary = sendReport("getGateSummary", "gate-wise in/out summary");
exports.getGateLaneWiseSummary = async (req, res) => {
  try { return res.status(200).json({ success: true, ...(await Report.getGateSummary(req.query, true)) }); }
  catch (error) { console.error("Gate lane-wise report error:", error); return res.status(500).json({ success: false, message: "Failed to fetch gate lane-wise report" }); }
};
exports.getPassPenaltyReport = sendReport("getPassPenaltyReport", "pass penalty");
