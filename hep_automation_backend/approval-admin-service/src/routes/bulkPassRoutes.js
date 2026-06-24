/**
 * bulkPassRoutes.js — approval-admin-service
 *
 * Traffic Officer routes for the Bulk Pass Module.
 * All routes protected by verifyToken.
 *
 * Requirements: 8.1–8.4, 11.2
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/verifyToken");
const bulkPassApprovalController = require("../controllers/bulkPassApprovalController");

// GET  /api/bulk-pass/queue       — list UNDER_REVIEW batches (Req 8.1)
router.get("/queue", verifyToken, bulkPassApprovalController.getQueue);

// POST /api/bulk-pass/:id/approve — approve batch (Req 8.2)
router.post("/:id/approve", verifyToken, bulkPassApprovalController.approveBatch);

// POST /api/bulk-pass/:id/reject  — reject batch (Req 8.3)
router.post("/:id/reject", verifyToken, bulkPassApprovalController.rejectBatch);

// POST /api/bulk-pass/:id/return  — return to applicant for revision (Req 8.4)
router.post("/:id/return", verifyToken, bulkPassApprovalController.returnBatch);

module.exports = router;
