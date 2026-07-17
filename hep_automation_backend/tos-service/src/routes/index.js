const express = require("express");
const router = express.Router();
const tosRoutes = require("./tosRoutes");

router.use("/tos", tosRoutes);

module.exports = router;
