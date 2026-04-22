const express = require("express");
const router = express.Router();
const userRoutes = require("./userRoutes");
const passRequestRoutes = require("./passRequestRoutes");



router.use("/user", userRoutes);
router.use("/pass-request", passRequestRoutes);


module.exports = router;