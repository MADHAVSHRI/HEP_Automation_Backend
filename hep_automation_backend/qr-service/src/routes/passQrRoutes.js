const express = require("express");
const router = express.Router();

const verifyToken = require("../middlewares/verifyToken");
const passQrController = require("../controllers/passQrController");

router.get(
  "/generate-pass/:passRequestId",
  verifyToken,
  passQrController.generatePassQR
);

module.exports = router;