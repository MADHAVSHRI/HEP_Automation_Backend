const express = require("express");
const router = express.Router();
const iportmanRoutes = require("../routes/iportmanRoutes");
const operatorRoutes = require("../routes/operatorRoutes");

router.use("/cargo", iportmanRoutes);
router.use("/operator", operatorRoutes);

module.exports = router;