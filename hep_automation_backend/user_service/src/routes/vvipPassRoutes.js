const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const verifyToken = require("../middlewares/verifyToken");
const vvipPassController = require("../controllers/vvipPassController");

const router = express.Router();

const VVIP_UPLOAD_DIR = "uploads/vvipPassDocs";
if (!fs.existsSync(VVIP_UPLOAD_DIR)) {
  fs.mkdirSync(VVIP_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VVIP_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${timestamp}_${safeName}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExt = [".pdf", ".jpg", ".jpeg", ".png"];
  const allowedMime = ["application/pdf", "image/jpeg", "image/png"];

  if (!allowedExt.includes(ext) || !allowedMime.includes(file.mimetype)) {
    return cb(new Error("Only PDF, JPG, JPEG, PNG files are allowed."));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 40,
  },
});

const handleUpload = (req, res, next) => {
  upload.any()(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message || "Invalid VVIP document upload.",
      });
    }
    next();
  });
};

router.post("/", verifyToken, handleUpload, vvipPassController.createVvipPass);
router.get("/", verifyToken, vvipPassController.listVvipPasses);
router.get("/queue", verifyToken, vvipPassController.listVvipPasses);
router.get("/:id/qr-data", vvipPassController.getVvipQrData);
router.get("/:id/pdf", verifyToken, vvipPassController.downloadVvipPdf);
router.get("/:id", verifyToken, vvipPassController.getVvipPass);
router.post("/:id/resubmit", verifyToken, handleUpload, vvipPassController.resubmitVvipPass);
router.post("/:id/approve", verifyToken, vvipPassController.approveVvipPass);
router.post("/:id/reject", verifyToken, vvipPassController.rejectVvipPass);
router.post("/:id/return", verifyToken, vvipPassController.returnVvipPass);

module.exports = router;
