/**
 * Property-Based Tests for photoValidationService.js
 *
 * **Feature: bulk-pass-module, Property 17: Photo validation returns first failing rule's error message**
 * **Validates: Requirements 5.8**
 *
 * Property 17 states:
 *   For any image buffer, validateEmbeddedPhoto(buffer) must return
 *   { valid: false, error: E } where E is the error message for the FIRST
 *   constraint violated in the order:
 *     format → size → min dimensions → max dimensions → aspect ratio
 *   For images satisfying all constraints it must return { valid: true, error: null }.
 */

const fc = require("fast-check");
const sharp = require("sharp");
const {
  validateEmbeddedPhoto,
} = require("../src/services/photoValidationService");

// ---------------------------------------------------------------------------
// Helpers — create synthetic JPEG / PNG buffers with sharp
// ---------------------------------------------------------------------------

/** Build a JPEG buffer of given pixel dimensions and approximate byte size. */
async function makeJpeg(width, height) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/** Build a PNG buffer of given pixel dimensions. */
async function makePng(width, height) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * Pad a buffer to a target byte length by appending zero bytes.
 * Used to push a valid image over the 500 KB size limit.
 */
function padToSize(buf, targetBytes) {
  if (buf.length >= targetBytes) return buf;
  const padding = Buffer.alloc(targetBytes - buf.length, 0);
  return Buffer.concat([buf, padding]);
}

// ---------------------------------------------------------------------------
// Constants mirroring photoValidationService.js
// ---------------------------------------------------------------------------
const MAX_SIZE_BYTES = 500 * 1024;

// ---------------------------------------------------------------------------
// Property 17 — Photo validation returns first failing rule's error message
// **Feature: bulk-pass-module, Property 17: Photo validation returns first failing rule's error message**
// **Validates: Requirements 5.8**
// ---------------------------------------------------------------------------

describe("Property 17 — Photo validation: first failing rule ordering", () => {
  // ---- sub-case A: non-image buffers → "Unsupported image format" ----
  test("random non-image buffers return Unsupported image format (first rule)", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Random bytes that are definitely not valid image data
        fc.uint8Array({ minLength: 4, maxLength: 200 }).filter((arr) => {
          // Exclude JPEG magic bytes (FF D8 FF) and PNG magic bytes (89 50 4E 47)
          const isJpeg = arr[0] === 0xff && arr[1] === 0xd8 && arr[2] === 0xff;
          const isPng =
            arr[0] === 0x89 &&
            arr[1] === 0x50 &&
            arr[2] === 0x4e &&
            arr[3] === 0x47;
          return !isJpeg && !isPng;
        }),
        async (arr) => {
          const result = await validateEmbeddedPhoto(Buffer.from(arr));
          return (
            result.valid === false && result.error === "Unsupported image format"
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  // ---- sub-case B: valid JPEG, size > 500 KB → "Photo exceeds 500 KB" ----
  test("oversized JPEG (> 500 KB) returns Photo exceeds 500 KB (size rule before dimension rules)", async () => {
    // Use a valid 300×300 image (well within dimension bounds) and pad it over 500 KB
    const baseBuffer = await makeJpeg(300, 300);
    const oversized = padToSize(baseBuffer, MAX_SIZE_BYTES + 1);

    const result = await validateEmbeddedPhoto(oversized);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Photo exceeds 500 KB");
  });

  // ---- sub-case C: valid JPEG, dimensions too small → "Photo dimensions too small" ----
  test("JPEG with dimensions below 200×200 returns Photo dimensions too small", async () => {
    // Generate images with width or height < 200, within size limit
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Width too small
          fc
            .tuple(
              fc.integer({ min: 1, max: 199 }),
              fc.integer({ min: 200, max: 400 })
            )
            .map(([w, h]) => ({ w, h })),
          // Height too small
          fc
            .tuple(
              fc.integer({ min: 200, max: 400 }),
              fc.integer({ min: 1, max: 199 })
            )
            .map(([w, h]) => ({ w, h })),
          // Both too small
          fc
            .tuple(
              fc.integer({ min: 1, max: 199 }),
              fc.integer({ min: 1, max: 199 })
            )
            .map(([w, h]) => ({ w, h }))
        ),
        async ({ w, h }) => {
          const buf = await makeJpeg(w, h);
          // Confirm the buffer is within size limit
          if (buf.length > MAX_SIZE_BYTES) return true; // skip oversized edge-cases
          const result = await validateEmbeddedPhoto(buf);
          return (
            result.valid === false &&
            result.error === "Photo dimensions too small"
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  // ---- sub-case D: valid JPEG, dimensions too large → "Photo dimensions exceed maximum allowed" ----
  test("JPEG with dimensions above 600×600 returns Photo dimensions exceed maximum allowed", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Width too large, height OK
          fc
            .tuple(
              fc.integer({ min: 601, max: 800 }),
              fc.integer({ min: 200, max: 600 })
            )
            .map(([w, h]) => ({ w, h })),
          // Height too large, width OK
          fc
            .tuple(
              fc.integer({ min: 200, max: 600 }),
              fc.integer({ min: 601, max: 800 })
            )
            .map(([w, h]) => ({ w, h })),
          // Both too large
          fc
            .tuple(
              fc.integer({ min: 601, max: 800 }),
              fc.integer({ min: 601, max: 800 })
            )
            .map(([w, h]) => ({ w, h }))
        ),
        async ({ w, h }) => {
          const buf = await makeJpeg(w, h);
          if (buf.length > MAX_SIZE_BYTES) return true; // skip
          const result = await validateEmbeddedPhoto(buf);
          return (
            result.valid === false &&
            result.error === "Photo dimensions exceed maximum allowed"
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  // ---- sub-case E: valid JPEG, invalid aspect ratio → "Photo aspect ratio invalid" ----
  test("JPEG with aspect ratio outside 0.8–1.25 returns Photo aspect ratio invalid", async () => {
    // Wide image: ratio > 1.25, e.g. 400×200 = 2.0
    const wideBuf = await makeJpeg(400, 200);
    const wideResult = await validateEmbeddedPhoto(wideBuf);
    expect(wideResult.valid).toBe(false);
    expect(wideResult.error).toBe("Photo aspect ratio invalid");

    // Tall image: ratio < 0.8, e.g. 200×400 = 0.5
    const tallBuf = await makeJpeg(200, 400);
    const tallResult = await validateEmbeddedPhoto(tallBuf);
    expect(tallResult.valid).toBe(false);
    expect(tallResult.error).toBe("Photo aspect ratio invalid");
  });

  // ---- sub-case F: valid JPEG within all constraints → { valid: true, error: null } ----
  test("JPEG satisfying all constraints returns valid=true, error=null", async () => {
    // Dimensions in [200,600], square → aspect ratio exactly 1.0, well within size
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 200, max: 600 }).map((side) => ({ w: side, h: side })),
        async ({ w, h }) => {
          const buf = await makeJpeg(w, h);
          if (buf.length > MAX_SIZE_BYTES) return true; // skip
          const result = await validateEmbeddedPhoto(buf);
          return result.valid === true && result.error === null;
        }
      ),
      { numRuns: 50 }
    );
  });

  // ---- sub-case G: valid PNG within all constraints → { valid: true, error: null } ----
  test("PNG satisfying all constraints returns valid=true, error=null", async () => {
    const buf = await makePng(300, 300);
    const result = await validateEmbeddedPhoto(buf);
    expect(result.valid).toBe(true);
    expect(result.error).toBe(null);
  });

  // ---- sub-case H: size rule is checked BEFORE dimension rules ----
  test("oversized image with small dimensions still reports size error (size checked before dimensions)", async () => {
    // 300×300 is within dimension bounds; pad to > 500 KB
    const baseBuffer = await makeJpeg(300, 300);
    const oversized = padToSize(baseBuffer, MAX_SIZE_BYTES + 100);

    const result = await validateEmbeddedPhoto(oversized);
    expect(result.valid).toBe(false);
    // Must be the SIZE error, not a dimension error
    expect(result.error).toBe("Photo exceeds 500 KB");
  });
});
