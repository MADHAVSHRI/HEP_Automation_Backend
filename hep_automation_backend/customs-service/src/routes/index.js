const express = require("express");
const router = express.Router();
const customsRoutes = require("./customsRoutes");

router.use("/customs", customsRoutes);

module.exports = router;