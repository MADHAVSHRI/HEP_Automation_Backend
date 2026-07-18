const express = require("express");
const router = express.Router();
const emailRoutes = require("./emailRoutes");
const smsRoutes = require("./smsRoutes");

router.use("/email", emailRoutes);
router.use("/sms", smsRoutes);

module.exports = router;