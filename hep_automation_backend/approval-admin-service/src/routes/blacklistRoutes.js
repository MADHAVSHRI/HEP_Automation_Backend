const express = require("express");
const router = express.Router();
const blacklistController = require("../controllers/blacklistController");
const verifyToken = require("../middlewares/verifyToken");
const authorizeToken = require("../middlewares/authorizeToken");
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

// CRUD & read endpoints
router.post("/create", upload.single("supporting_document"), blacklistController.createBlacklistEntry);
router.get("/list", blacklistController.getBlacklistEntries);
router.get("/my-blacklist", blacklistController.getMyBlacklistEntries);
router.get("/stats", blacklistController.getBlacklistStats);
router.get("/check", blacklistController.checkBlacklisted);
router.get("/reports", blacklistController.getReports);
router.get("/penalty-config", blacklistController.getPenaltyConfig);

// ATM/Admin can update penalty config amounts
router.put("/penalty-config/:reasonCode", authorizeToken("ATM", "Admin", "Administrator"), blacklistController.updatePenaltyConfig);

router.post("/share-penalty-link", blacklistController.sharePenaltyLink);
router.get("/:id", blacklistController.getBlacklistById);

// Agent self-service transitions (open beyond verifyToken — agents pay & request unblacklist)
router.patch("/:id/pay-penalty", blacklistController.payPenalty);
router.patch("/:id/submit-compliance", blacklistController.submitCompliance);
router.patch("/:id/request-unblacklist", blacklistController.requestUnblacklist);

// ATM-only: approve or reject a PENDING_BLACKLIST entry
router.patch("/:id/approve-blacklist", authorizeToken("ATM"), blacklistController.approveBlacklist);
router.patch("/:id/reject-blacklist", authorizeToken("ATM"), blacklistController.rejectBlacklist);

// ATM + Admin + Administrator: reinstatement decisions
router.patch("/:id/approve-unblacklist", authorizeToken("ATM", "Admin", "Administrator"), blacklistController.approveUnblacklist);
router.patch("/:id/reject-unblacklist", authorizeToken("ATM", "Admin", "Administrator"), blacklistController.rejectUnblacklist);
router.patch("/:id/direct-unblock", authorizeToken("ATM", "Admin", "Administrator"), blacklistController.directUnblock);
router.patch("/:id/reinstate", authorizeToken("ATM", "Admin", "Administrator"), blacklistController.reinstateCompany);

router.post("/use-gate-out", blacklistController.useGateOut);

module.exports = router;
