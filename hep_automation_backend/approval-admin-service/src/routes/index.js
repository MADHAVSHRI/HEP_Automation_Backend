const express = require("express");
const router = express.Router();
const userRoutes = require("./userRoutes");
const passRequestRoutes = require("./passRequestRoutes");
const blacklistRoutes = require("./blacklistRoutes");
const bulkPassRoutes = require("./bulkPassRoutes");
const materialPassRoutes = require("./materialPassRoutes");
const overstayRoutes = require("./overstayRoutes");
const passFeeMasterRoutes = require("./passFeeMasterRoutes");
const hepRateRoutes = require("./hepRateRoutes");
const vvipPassRoutes = require("./vvipPassRoutes");

router.use("/user", userRoutes);
router.use("/pass-request", passRequestRoutes);
router.use("/blacklist", blacklistRoutes);
router.use("/bulk-pass", bulkPassRoutes);
router.use("/material-pass", materialPassRoutes);
router.use("/overstay", overstayRoutes);
router.use("/pass-fee-master", passFeeMasterRoutes);
router.use("/hep-rate", hepRateRoutes);
router.use("/vvip-pass", vvipPassRoutes);

module.exports = router;
