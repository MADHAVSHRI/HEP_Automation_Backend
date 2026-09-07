const { loginOperator, pushForm13Record, pushEirRecord } = require("../services/tosService");

exports.login = async (req, res) => {
  try {
    const result = await loginOperator(req.body);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      ...result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error("Error logging in TOS operator:", error);

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

exports.pushForm13 = async (req, res) => {
  try {
    const result = await pushForm13Record({
      payload: req.body,
      operatorId: req.operator.id,
    });

    return res.status(result.status === "SUCCESS" || result.status === "PROCESSED_DIRECTLY" ? 201 : 200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(200).json({
        success: true,
        status: "ALREADY_EXISTS",
        message: `Form-13 record '${req.body.form13No}' already exists`,
      });
    }

    console.error("Error saving Form-13 record:", error);
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

exports.pushEir = async (req, res) => {
  try {
    const result = await pushEirRecord({
      payload: req.body,
      operatorId: req.operator.id,
    });

    if (result.totalProcessed === 1) {
      const res0 = result.results[0];
      if (!res0.success && res0.message.startsWith("Missing required fields")) {
        return res.status(400).json({ success: false, message: res0.message });
      }
      if (!res0.success) {
        return res.status(400).json({ success: false, message: res0.message });
      }

      return res.status(201).json({
        success: true,
        status: res0.status,
        message: res0.message,
        eirNo: res0.eirNo,
      });
    }

    const hasFailures = result.results.some((item) => !item.success);
    return res.status(hasFailures ? 207 : 201).json({
      success: !hasFailures,
      totalProcessed: result.totalProcessed,
      results: result.results,
    });
  } catch (error) {
    console.error("Error in pushEir controller:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

