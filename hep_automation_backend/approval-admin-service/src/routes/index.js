const express = require("express");
const router = express.Router();
const userRoutes = require("./userRoutes");
const passRequestRoutes = require("./passRequestRoutes");
const blacklistRoutes = require("./blacklistRoutes");
const bulkPassRoutes = require("./bulkPassRoutes");

router.use("/user", userRoutes);
router.use("/pass-request", passRequestRoutes);
router.use("/blacklist", blacklistRoutes);
router.use("/bulk-pass", bulkPassRoutes);

module.exports = router;
