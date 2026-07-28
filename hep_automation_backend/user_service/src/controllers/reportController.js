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
