const express = require("express");
const router = express.Router();
const agentRoutes = require("./agentRoutes");
const userTypeRoutes = require("./userTypeRoutes");
const captchaRoutes = require("./captchaRoutes");
const passRequestRoutes = require("./passRequestRoutes");
const vendorPassRoutes = require("./vendorPassRoutes");
const lockRoutes = require("./lockRoutes");
const materialPassRoutes = require("./materialPassRoutes");
const bulkPassRoutes = require("./bulkPassRoutes");
const chatbotRoutes = require("./chatbotRoutes");
const ulipRoutes = require("./ulipRoutes");


router.use("/agents", agentRoutes);
router.use("/user-types", userTypeRoutes);
router.use("/captcha", captchaRoutes);
router.use("/pass-request", passRequestRoutes);
router.use("/vendor-pass", vendorPassRoutes);
router.use("/locks", lockRoutes);
router.use("/material-pass", materialPassRoutes);
router.use("/bulk-pass", bulkPassRoutes);
router.use("/chatbot", chatbotRoutes);
router.use("/ulip", ulipRoutes);


module.exports = router;