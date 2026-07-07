const express = require("express");
const router = express.Router();
const iportmanRoutes = require("../routes/iportmanRoutes");

router.use("/cargo", iportmanRoutes);

module.exports = router;