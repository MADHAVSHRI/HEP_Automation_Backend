const express = require("express");
const router = express.Router();
const agentRoutes = require("./agentRoutes");
const userTypeRoutes = require("./userTypeRoutes");
const captchaRoutes = require("./captchaRoutes");
const passRequestRoutes = require("./passRequestRoutes");


router.use("/agents", agentRoutes);
router.use("/user-types", userTypeRoutes);
router.use("/captcha", captchaRoutes);
router.use("/pass-request", passRequestRoutes);

module.exports = router;