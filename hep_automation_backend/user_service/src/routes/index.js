const express = require("express");
const router = express.Router();
const agentRoutes = require("./agentRoutes");
const userTypeRoutes = require("./userTypeRoutes");
const captchaRoutes = require("./captchaRoutes");
const passRequestRoutes = require("./passRequestRoutes");
const vendorPassRoutes = require("./vendorPassRoutes");


router.use("/agents", agentRoutes);
router.use("/user-types", userTypeRoutes);
router.use("/captcha", captchaRoutes);
router.use("/pass-request", passRequestRoutes);
router.use("/vendor-pass", vendorPassRoutes);

module.exports = router;