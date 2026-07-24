const express = require("express");
const router = express.Router();
const userRoutes = require("./userRoutes");
const passRequestRoutes = require("./passRequestRoutes");
const blacklistRoutes = require("./blacklistRoutes");
const bulkPassRoutes = require("./bulkPassRoutes");
const materialPassRoutes = require("./materialPassRoutes");

router.use("/user", userRoutes);
router.use("/pass-request", passRequestRoutes);
router.use("/blacklist", blacklistRoutes);
router.use("/bulk-pass", bulkPassRoutes);
router.use("/material-pass", materialPassRoutes);

module.exports = router;
