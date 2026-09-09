const express = require("express");
const router = express.Router();
const gateVerificationRoutes = require("./gateVerificationRoutes");

router.use("/gate-verification", gateVerificationRoutes);

module.exports = router;
