const express = require("express");
const router = express.Router();

const controller = require("../controllers/gateVerificationController");
const verifyToken = require("../middlewares/verifyToken");
const verifyService = require("../middlewares/verifyService");

/* ── Device-facing (machine auth via x-service-key) ──────────────────── */
router.post("/event", verifyService, controller.receiveHardwareEvent);

/* ── Officer-facing (user auth via auth-service access token) ────────── */
router.post("/test-event", verifyToken, controller.simulateEvent);
router.get("/my-gates", verifyToken, controller.getMyGates);
router.get("/gates/:gateCode/events", verifyToken, controller.getGateEvents);

module.exports = router;
