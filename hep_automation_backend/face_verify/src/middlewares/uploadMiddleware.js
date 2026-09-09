const multer = require("multer");

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 8 * 1024 * 1024);

/**
 * Memory storage, deliberately.
 *
 * Unvalidated bytes never touch the disk. The photograph is only written once
 * sharp has decoded it and confirmed it is the image it claims to be, so a file
 * that is not really an image is never given a name on the filesystem.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
      cb(null, true);
      return;
    }
    // A first, cheap filter only. The real check is the byte signature.
    const error = new Error("Unsupported file type.");
    error.code = "UNSUPPORTED_MEDIA_TYPE";
    cb(error);
  },
});

module.exports = { upload, MAX_UPLOAD_BYTES };
