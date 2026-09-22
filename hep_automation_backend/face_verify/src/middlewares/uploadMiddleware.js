const multer = require("multer");

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 8 * 1024 * 1024);

const ALLOWED_MIMETYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/bmp",
  "image/x-ms-bmp",
  "image/tiff",
  "image/gif",
]);

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
    if (ALLOWED_MIMETYPES.has(file.mimetype) || (file.mimetype && file.mimetype.startsWith("image/"))) {
      cb(null, true);
      return;
    }
    // A first, cheap filter only. The real check is the byte signature.
    const error = new Error("Unsupported file type. Please upload a valid image (JPEG, PNG, WebP, AVIF, BMP, TIFF, GIF).");
    error.code = "UNSUPPORTED_MEDIA_TYPE";
    cb(error);
  },
});

module.exports = { upload, MAX_UPLOAD_BYTES };
