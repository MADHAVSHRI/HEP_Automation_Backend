/**
 * trafficAnalyticsRoutes.js — /api/reports/traffic/*
 *
 * Read-only analytics over TOS, weighbridge, customs and gate feeds for the
 * Traffic Department. Every route requires a valid JWT AND a traffic role
 * (unlike the legacy /api/reports routes, which are unauthenticated).
 */

const express = require("express");
const router = express.Router();

const verifyToken = require("../middlewares/verifyToken");
const authorizeTraffic = require("../middlewares/authorizeTraffic");
const controller = require("../controllers/trafficAnalyticsController");

router.use(verifyToken, authorizeTraffic);

router.get("/filters", controller.getFilterOptions);
router.get("/overview", controller.getOverview);
router.get("/eir", controller.getEirList);
router.get("/form13", controller.getForm13List);
router.get("/weighbridge", controller.getWeighbridgeList);
router.get("/customs", controller.getCustomsList);
router.get("/gate-events", controller.getGateEventList);
router.get("/journey", controller.getJourney);

module.exports = router;
