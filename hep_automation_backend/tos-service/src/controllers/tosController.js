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

    if (result.status === "ALREADY_EXISTS") {
      return res.status(409).json({
        code: 409,
        success: false,
        ...result,
      });
    }

    return res.status(201).json({
      code: 201,
      success: true,
      ...result,
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        code: 409,
        success: false,
        status: "ALREADY_EXISTS",
        message: `Form-13 record '${req.body.form13No}' already exists`,
      });
    }

    const statusCode = error.statusCode || 500;
    console.error("Error saving Form-13 record:", error);
    return res.status(statusCode).json({
      code: statusCode,
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
        return res.status(400).json({ code: 400, success: false, message: res0.message });
      }
      if (!res0.success) {
        return res.status(400).json({ code: 400, success: false, message: res0.message });
      }

      const isDuplicate = res0.status === "ALREADY_EXISTS";
      const httpCode = isDuplicate ? 409 : 201;

      return res.status(httpCode).json({
        code: httpCode,
        success: !isDuplicate,
        status: res0.status,
        message: res0.message,
        eirNo: res0.eirNo,
      });
    }

    const hasFailures = result.results.some((item) => !item.success);
    const allDuplicates = result.results.every((item) => item.status === "ALREADY_EXISTS");
    const httpCode = hasFailures ? 207 : (allDuplicates ? 409 : 201);

    return res.status(httpCode).json({
      code: httpCode,
      success: !hasFailures && !allDuplicates,
      totalProcessed: result.totalProcessed,
      results: result.results,
    });
  } catch (error) {
    console.error("Error in pushEir controller:", error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      code: statusCode,
      success: false,
      message: error.message || "Internal server error",
    });
  }
};


