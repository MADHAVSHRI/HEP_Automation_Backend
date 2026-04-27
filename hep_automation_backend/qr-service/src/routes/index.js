const express = require("express");
const router = express.Router();

const verifyToken = require("../middlewares/verifyToken");
const passQrRoutes = require("../routes/passQrRoutes");

router.use("/qr", passQrRoutes);

module.exports = router;