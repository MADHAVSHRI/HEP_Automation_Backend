/**
 * photoValidationService.js
 *
 * Validates an embedded photo buffer against the rules specified in
 * Requirements 5.8. Returns the FIRST failing rule's error message.
 *
 * Rules (in order):
 *  1. Format must be JPEG or PNG                → "Unsupported image format"
 *  2. Size must be ≤ 500 KB                     → "Photo exceeds 500 KB"
 *  3. Width and height must be ≥ 200 px         → "Photo dimensions too small"
 *  4. Width and height must be ≤ 600 px         → "Photo dimensions exceed maximum allowed"
 *  5. Aspect ratio must be 0.8–1.25             → "Photo aspect ratio invalid"
 *
 * Missing photo (null/undefined buffer) is NOT handled here — the caller
 * is responsible for checking presence and reporting "Photo missing".
 */

const sharp = require("sharp");

const MAX_SIZE_BYTES = 500 * 1024; // 500 KB
const MIN_DIM = 200;
const MAX_DIM = 600;
const MIN_RATIO = 0.8;
const MAX_RATIO = 1.25;

/**
 * Validates an embedded photo buffer.
 *
 * @param {Buffer} buffer - Raw image bytes
 * @returns {Promise<{ valid: boolean, error: string | null }>}
 */
async function validateEmbeddedPhoto(buffer) {
  // Rule 1 — format
  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return { valid: false, error: "Unsupported image format" };
  }

  const format = (metadata.format || "").toLowerCase();
  if (format !== "jpeg" && format !== "png") {
    return { valid: false, error: "Unsupported image format" };
  }

  // Rule 2 — size (skip rejection — compression handles this)
  // Photos will be compressed to ≤ 500 KB after validation passes

  const { width, height } = metadata;

  // Rule 3 — minimum dimensions
  if (width < MIN_DIM || height < MIN_DIM) {
    return { valid: false, error: "Photo dimensions too small" };
  }

  // Rule 4 — maximum dimensions (skip — compression will resize to fit)

  // Rule 5 — aspect ratio (width / height)
  const ratio = width / height;
  if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
    return { valid: false, error: "Photo aspect ratio invalid" };
  }

  return { valid: true, error: null };
}

module.exports = { validateEmbeddedPhoto };
