const express = require("express");
const router = express.Router();
const blacklistController = require("../controllers/blacklistController");
const verifyToken = require("../middlewares/verifyToken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directory exists
const uploadDir = "uploads/blacklist";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5000 * 1024 } // 5MB limit
});

// All blacklist routes require authentication
router.use(verifyToken);

// CRUD
router.post("/create", upload.single("supporting_document"), blacklistController.createBlacklistEntry);
router.get("/list", blacklistController.getBlacklistEntries);
router.get("/my-blacklist", blacklistController.getMyBlacklistEntries);
router.get("/stats", blacklistController.getBlacklistStats);
router.get("/check", blacklistController.checkBlacklisted);
router.get("/:id", blacklistController.getBlacklistById);

// Workflow transitions
router.patch("/:id/pay-penalty", blacklistController.payPenalty);
router.patch("/:id/submit-compliance", blacklistController.submitCompliance);
router.patch("/:id/request-unblacklist", blacklistController.requestUnblacklist);
router.patch("/:id/approve-unblacklist", blacklistController.approveUnblacklist);
router.patch("/:id/reject-unblacklist", blacklistController.rejectUnblacklist);
router.patch("/:id/approve-blacklist", blacklistController.approveBlacklist);
router.patch("/:id/reject-blacklist", blacklistController.rejectBlacklist);
router.patch("/:id/direct-unblock", blacklistController.directUnblock);
router.patch("/:id/reinstate", blacklistController.reinstateCompany);
router.post("/use-gate-out", blacklistController.useGateOut);

module.exports = router;
