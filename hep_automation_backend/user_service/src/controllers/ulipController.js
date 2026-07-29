const ulipService = require("../services/ulipService");

const handleError = (res, err) => {
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
};

exports.verifyVehicle = async (req, res) => {
  try {
    const result = await ulipService.verifyVehicle(req.body.vehiclenumber);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
};

exports.verifyDL = async (req, res) => {
  try {
    const result = await ulipService.verifyDL(req.body.dlnumber);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
};

exports.verifyByChassis = async (req, res) => {
  try {
    const result = await ulipService.verifyByChassis(req.body.chasisnumber);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
};

exports.verifyByEngine = async (req, res) => {
  try {
    const result = await ulipService.verifyByEngine(req.body.enginenumber);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
};
