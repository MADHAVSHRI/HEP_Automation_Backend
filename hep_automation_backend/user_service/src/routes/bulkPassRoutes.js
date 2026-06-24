/**
 * bulkPassRoutes.js
 *
 * Routes for the Bulk Pass module.
 * Public (applicant) routes declared FIRST — no verifyToken.
 * Protected (Dept User) routes follow — guarded by verifyToken.
 *
 * Upload middleware:
 *  - workOrder file: uses existing uploadMiddleware.js (diskStorage to uploads/)
 *  - Excel files:    dedicated multer instance → /tmp/bulk_pass_excel/
 *
 * Requirements: 11.5, 11.8
 */

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const verifyToken = require("../middlewares/verifyToken");
const upload = require("../middlewares/uploadMiddleware");
const bulkPassController = require("../controllers/bulkPassController");

// ── Excel-upload multer instance (Req 11.8) ────────────────────────────────
const EXCEL_TMP_DIR = "/tmp/bulk_pass_excel";
if (!fs.existsSync(EXCEL_TMP_DIR)) {
  fs.mkdirSync(EXCEL_TMP_DIR, { recursive: true });
}

const excelStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, EXCEL_TMP_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${ts}_${safe}`);
  },
});

const excelFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (![".xlsx", ".xls"].includes(ext)) {
    return cb(new Error("Only .xlsx and .xls files are allowed"));
  }
  cb(null, true);
};

const excelUpload = multer({
  storage: excelStorage,
  fileFilter: excelFileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB per file (Req 4.5)
    files: 5,                    // max 5 files   (Req 4.5)
  },
});

// ── Zip-upload multer instance ─────────────────────────────────────────────
const ZIP_TMP_DIR = "/tmp/bulk_pass_zip";
if (!fs.existsSync(ZIP_TMP_DIR)) {
  fs.mkdirSync(ZIP_TMP_DIR, { recursive: true });
}

const zipStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ZIP_TMP_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${ts}_${safe}`);
  },
});

const zipFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== ".zip") return cb(new Error("Only .zip files are allowed"));
  cb(null, true);
};

const zipUpload = multer({
  storage: zipStorage,
  fileFilter: zipFileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// ── Error handler for multer upload errors ─────────────────────────────────
function handleExcelUploadError(err, req, res, next) {
  if (err) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, message: "File size exceeds 15 MB limit" });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ success: false, message: "Maximum 5 files allowed per upload session" });
    }
    return res.status(400).json({ success: false, message: err.message || "File upload error" });
  }
  next();
}

// ── Public routes (no verifyToken) ─────────────────────────────────────────

// Download Excel template
router.get("/template", bulkPassController.downloadTemplate);

// Lookup batch by token
router.get("/public/:token", bulkPassController.getPublicByToken);

// Real-time blacklist check for the public upload form (no auth needed)
// GET /public/blacklist-check?entity_type=PERSON&identifier=123456789012
router.get("/public/blacklist-check", bulkPassController.publicBlacklistCheck);

// Upload Excel files (up to 5) — dedicated excelUpload middleware
router.post(
  "/public/:token/upload",
  (req, res, next) => {
    excelUpload.array("files", 5)(req, res, (err) => {
      if (err) return handleExcelUploadError(err, req, res, next);
      next();
    });
  },
  bulkPassController.uploadFiles
);

// Parse & preview uploaded files
router.post("/public/:token/preview", bulkPassController.previewParsed);

// Submit batch (applicant finalises)
router.post("/public/:token/submit", bulkPassController.submitBatch);

// Download error report (GET with filePaths query param)
router.get("/public/:token/error-report", bulkPassController.downloadErrorReport);

// ── New Excel-only + photo flow ────────────────────────────────────────────

// Parse Excel without photos — returns editable rows
router.post("/public/:token/parse-excel", bulkPassController.parseExcelOnly);

// Upload zip of photos (auto-match by serial-number filename)
router.post(
  "/public/:token/upload-zip",
  (req, res, next) => {
    zipUpload.single("zipFile")(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message || "Zip upload error" });
      next();
    });
  },
  bulkPassController.uploadZipPhotos
);

// Submit rows directly with photoDataUrl per row + optional vehicle docs
router.post(
  "/public/:token/submit-rows",
  (req, res, next) => {
    // Accept any field name for vehicle docs + in-charge person Aadhaar cards.
    // Vehicles: up to 20 × 6 docs = 120 files. Persons: up to 200 Aadhaar cards.
    const fields = [];
    for (let i = 0; i < 20; i++) {
      ["rc", "insurance", "fitness", "permit", "roadTax", "emission"].forEach((doc) => {
        fields.push({ name: `vehicle_${i}_${doc}`, maxCount: 1 });
      });
    }
    for (let i = 0; i < 200; i++) {
      fields.push({ name: `person_${i}_aadhaarCard`, maxCount: 1 });
    }
    const docStorage = multer.diskStorage({
      destination: (_req, _file, cb) => {
        const tmpDir = "/tmp/bulk_pass_vehicle_docs";
        if (!require("fs").existsSync(tmpDir)) require("fs").mkdirSync(tmpDir, { recursive: true });
        cb(null, tmpDir);
      },
      filename: (_req, file, cb) => cb(null, Date.now() + "_" + file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")),
    });
    multer({ storage: docStorage, limits: { fileSize: 10 * 1024 * 1024, files: 320 } })
      .fields(fields)(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message || "File upload error" });
        next();
      });
  },
  bulkPassController.submitRowsDirectly
);

// ── Protected routes (verifyToken required) ────────────────────────────────

// Get bulk visitor types
router.get("/visitor-types", verifyToken, bulkPassController.getBulkVisitorTypes);

// Create intake (with optional work order file)
router.post(
  "/intake",
  verifyToken,
  upload.fields([{ name: "workOrder", maxCount: 1 }]),
  bulkPassController.createIntake
);

// List batches
router.get("/list", verifyToken, bulkPassController.listBatches);

// Internal endpoints called by approval-admin-service (service-to-service)
// MUST be declared before /:id to prevent "approval-queue" being parsed as an id
router.get("/approval-queue", bulkPassController.getApprovalQueue);

// Internal endpoint called by qr-service to fetch batch + persons for QR/PDF
// generation (no user auth — applicant viewing the approved pass isn't logged in)
router.get("/:id/qr-data", bulkPassController.getBatchQrData);

// PUBLIC scan endpoint — opened when anyone scans the bulk pass QR code.
// No auth required; serves full details for COMPLETED batches only.
router.get("/scan/:id", bulkPassController.getPublicScanData);

// ── Wildcard :id routes — keep these LAST among GET/POST on /:id ───────────

// Get batch detail
router.get("/:id", verifyToken, bulkPassController.getBatchDetail);

// Edit batch (DRAFT / REJECTED / RETURNED_TO_APPLICANT)
router.put("/:id", verifyToken, bulkPassController.updateBatch);

// Forward to Traffic Department approval
router.post("/:id/forward", verifyToken, bulkPassController.forwardToApproval);

// Resend invitation email to applicant
router.post("/:id/resend-invitation", verifyToken, bulkPassController.resendInvitation);

// Return to applicant (from SUBMITTED)
router.post("/:id/return", verifyToken, bulkPassController.returnToApplicant);

// Resubmit after rejection
router.post("/:id/resubmit", verifyToken, bulkPassController.resubmitBatch);

// Download QR PDF (COMPLETED batches)
router.get("/:id/pdf", verifyToken, bulkPassController.downloadPdf);

// Internal approve / reject called by approval-admin-service
router.post("/:id/approve", bulkPassController.approveBatch);
router.post("/:id/reject", bulkPassController.rejectBatch);

module.exports = router;
