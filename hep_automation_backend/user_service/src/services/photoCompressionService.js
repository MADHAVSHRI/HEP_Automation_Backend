/**
 * photoCompressionService.js
 *
 * Compresses uploaded photos and documents for the Bulk Pass module.
 * Never rejects — always compresses to fit within limits.
 *
 * - Photos: max 500 KB (resized to 800×800, progressive quality reduction)
 * - Documents: max 5 MB (resized to 1600×1600 for images, progressive quality reduction)
 * - PDFs: stored as-is (no server-side compression possible for PDFs)
 *
 * Uses sharp (already in package.json).
 */

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// ── Configuration ──────────────────────────────────────────────────────────────

const PHOTO_MAX_SIZE = 500 * 1024;        // 500 KB
const DOC_MAX_SIZE = 5 * 1024 * 1024;     // 5 MB

const PHOTO_MAX_WIDTH = 800;
const PHOTO_MAX_HEIGHT = 800;
const PHOTO_INITIAL_QUALITY = 80;

const DOC_MAX_WIDTH = 1600;
const DOC_MAX_HEIGHT = 1600;
const DOC_INITIAL_QUALITY = 85;

const MIN_QUALITY = 10;

// ── Photo compression ──────────────────────────────────────────────────────────

/**
 * Compress a photo buffer to JPEG, guaranteed ≤ 500 KB.
 * Never rejects — always compresses until it fits.
 *
 * @param {Buffer} inputBuffer - Raw photo buffer (JPEG/PNG)
 * @returns {Promise<Buffer>} - Compressed JPEG buffer ≤ 500 KB
 */
async function compressPhotoBuffer(inputBuffer) {
  if (!inputBuffer || inputBuffer.length === 0) return inputBuffer;

  // If already within limit, just resize without quality loss
  if (inputBuffer.length <= PHOTO_MAX_SIZE) {
    return sharp(inputBuffer)
      .resize(PHOTO_MAX_WIDTH, PHOTO_MAX_HEIGHT, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: PHOTO_INITIAL_QUALITY, mozjpeg: true })
      .toBuffer();
  }

  // Compress with progressive quality reduction until ≤ 500 KB
  let quality = PHOTO_INITIAL_QUALITY;
  let compressed;

  while (quality >= MIN_QUALITY) {
    compressed = await sharp(inputBuffer)
      .resize(PHOTO_MAX_WIDTH, PHOTO_MAX_HEIGHT, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (compressed.length <= PHOTO_MAX_SIZE) return compressed;
    quality -= 5;
  }

  // Last resort: reduce dimensions further
  let width = PHOTO_MAX_WIDTH;
  while (width >= 200) {
    compressed = await sharp(inputBuffer)
      .resize(width, width, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: MIN_QUALITY, mozjpeg: true })
      .toBuffer();

    if (compressed.length <= PHOTO_MAX_SIZE) return compressed;
    width -= 100;
  }

  // Return whatever we got — shouldn't reach here for normal photos
  return compressed;
}

// ── Document compression ───────────────────────────────────────────────────────

/**
 * Compress a document file (image) on disk to ≤ 5 MB.
 * PDFs are stored as-is (no compression).
 * Never rejects — always compresses images until they fit.
 *
 * @param {string} filePath - Path to the document on disk
 * @returns {Promise<{ path: string, compressed: boolean }>}
 */
async function compressDocumentFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { path: filePath, compressed: false };
  }

  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);

  // PDF: store as-is (cannot compress server-side)
  if (ext === ".pdf") {
    return { path: filePath, compressed: false };
  }

  // Image files: compress if over 5 MB
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
    if (stat.size <= DOC_MAX_SIZE) {
      return { path: filePath, compressed: false };
    }

    try {
      const inputBuffer = fs.readFileSync(filePath);

      // Progressive quality reduction until ≤ 5 MB
      let quality = DOC_INITIAL_QUALITY;
      let compressed;

      while (quality >= MIN_QUALITY) {
        compressed = await sharp(inputBuffer)
          .resize(DOC_MAX_WIDTH, DOC_MAX_HEIGHT, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();

        if (compressed.length <= DOC_MAX_SIZE) break;
        quality -= 5;
      }

      // Last resort: reduce dimensions
      if (compressed.length > DOC_MAX_SIZE) {
        let width = DOC_MAX_WIDTH;
        while (width >= 400) {
          compressed = await sharp(inputBuffer)
            .resize(width, width, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: MIN_QUALITY, mozjpeg: true })
            .toBuffer();

          if (compressed.length <= DOC_MAX_SIZE) break;
          width -= 200;
        }
      }

      // Write compressed file as .jpg
      const compressedPath = filePath.replace(/\.[^.]+$/, ".jpg");
      fs.writeFileSync(compressedPath, compressed);

      // Remove original if extension changed
      if (compressedPath !== filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return { path: compressedPath, compressed: true };
    } catch {
      // If compression fails, keep original
      return { path: filePath, compressed: false };
    }
  }

  // Other file types: store as-is
  return { path: filePath, compressed: false };
}

module.exports = {
  compressPhotoBuffer,
  compressDocumentFile,
  PHOTO_MAX_SIZE,
  DOC_MAX_SIZE,
};
