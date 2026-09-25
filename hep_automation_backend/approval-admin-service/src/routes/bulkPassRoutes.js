/**
 * bulkPassRoutes.js — approval-admin-service
 *
 * Traffic Officer routes for the Bulk Pass Module.
 * All routes protected by verifyToken.
 *
 * Individual approval flow (new):
 *   POST /:batchId/persons/:personId/approve  — approve one person
 *   POST /:batchId/persons/:personId/reject   — reject one person
 *   POST /:id/finalize                        — finalize after all persons actioned
 *
 * Kept for backward compatibility:
 *   POST /:id/return   — return entire batch to applicant
 *   POST /:id/reject   — reject entire batch
 *
 * Requirements: 8.1–8.4, 11.2
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/verifyToken");
const authorizeTrafficApprover = require("../middlewares/authorizeTrafficApprover");
const bulkPassApprovalController = require("../controllers/bulkPassApprovalController");

// GET  /api/bulk-pass/queue       — list UNDER_REVIEW batches (Req 8.1)
router.get("/queue", verifyToken, bulkPassApprovalController.getQueue);

// GET  /api/bulk-pass/:id/pdf     — download QR PDF (COMPLETED batches)
// MUST be before /:id to prevent "pdf" being captured as the id param
router.get("/:id/pdf", verifyToken, bulkPassApprovalController.downloadPdf);

// GET  /api/bulk-pass/:id         — batch detail (traffic officers, all statuses)
router.get("/:id", verifyToken, bulkPassApprovalController.getBatchDetail);

// POST /api/bulk-pass/:id/resend-pass — resend the approved-pass email to applicant
router.post("/:id/resend-pass", verifyToken, authorizeTrafficApprover, bulkPassApprovalController.resendPass);

// ── Individual person approval (new) ─────────────────────────────────────────
// MUST be declared before /:id routes to prevent "persons" being parsed as an id

// POST /api/bulk-pass/:batchId/persons/approve-all — approve everything pending.
// Declared first so "approve-all" is not parsed as a :personId.
router.post("/:batchId/persons/approve-all", verifyToken, authorizeTrafficApprover, bulkPassApprovalController.approveAllPendingInBatch);

// POST /api/bulk-pass/:batchId/persons/:personId/approve
router.post("/:batchId/persons/:personId/approve", verifyToken, authorizeTrafficApprover, bulkPassApprovalController.approvePersonInBatch);

// POST /api/bulk-pass/:batchId/persons/:personId/reject
router.post("/:batchId/persons/:personId/reject",  verifyToken, authorizeTrafficApprover, bulkPassApprovalController.rejectPersonInBatch);

// POST /api/bulk-pass/:batchId/persons/:personId/undo — reset approved/rejected → PENDING
router.post("/:batchId/persons/:personId/undo",    verifyToken, authorizeTrafficApprover, bulkPassApprovalController.undoPersonInBatch);

// POST /api/bulk-pass/:id/finalize — generate QR (approved only) + mark COMPLETED
router.post("/:id/finalize", verifyToken, authorizeTrafficApprover, bulkPassApprovalController.finalizeBatch);

// ── Batch-level operations ────────────────────────────────────────────────────

// POST /api/bulk-pass/:id/reject  — reject entire batch (Req 8.3)
router.post("/:id/reject", verifyToken, authorizeTrafficApprover, bulkPassApprovalController.rejectBatch);

// POST /api/bulk-pass/:id/return  — return to applicant for revision (Req 8.4)
router.post("/:id/return", verifyToken, authorizeTrafficApprover, bulkPassApprovalController.returnBatch);

module.exports = router;
