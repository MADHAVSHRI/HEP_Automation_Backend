const express = require("express");
const router = express.Router();

const faceCaptureRoutes = require("./faceCaptureRoutes");

router.use("/face", faceCaptureRoutes);

router.get("/health", (req, res) => res.json({ status: "ok", service: "face_verify" }));

module.exports = router;
