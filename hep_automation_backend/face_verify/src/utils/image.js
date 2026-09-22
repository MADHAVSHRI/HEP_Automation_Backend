const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MAX_DIMENSION = 1600;
const MIN_DIMENSION = 240;
const JPEG_QUALITY = 90;

class ImageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ImageError";
    this.code = code;
  }
}

/**
 * Checks the leading bytes rather than trusting Content-Type.
 *
 * Supported formats: JPEG, PNG, WebP, AVIF/HEIC, BMP, TIFF, GIF.
 */
const signatureOf = (buffer) => {
  if (!buffer || buffer.length < 4) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return "png";
  // WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  )
    return "webp";
  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38
  )
    return "gif";
  // BMP: BM
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return "bmp";
  // TIFF: II*. or MM.*
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
    (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
  )
    return "tiff";
  // AVIF / HEIC / ISO Base Media: ftyp box at offset 4..7
  if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    const ftyp = buffer.slice(8, 12).toString('ascii');
    if (ftyp.includes('avif') || ftyp.includes('avis')) return "avif";
    if (ftyp.includes('heic') || ftyp.includes('heix') || ftyp.includes('mif1')) return "heif";
  }
  return null;
};

/**
 * Validates, normalises and stores one captured photograph.
 *
 * The file is written to a temporary name and renamed into place, so a crash
 * mid-write cannot leave a half-image that the portal would later try to show.
 */
const processAndStore = async (buffer, directory, baseName) => {
  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new ImageError("PHOTO_INVALID", "That image could not be read.");
  }

  const signature = signatureOf(buffer);
  const detectedFormat = metadata.format;

  // Verify container integrity: signature must match or sharp must recognize a supported image format
  const validFormats = new Set(["jpeg", "png", "webp", "avif", "heif", "bmp", "tiff", "gif", "svg"]);
  if (!detectedFormat || !validFormats.has(detectedFormat)) {
    throw new ImageError("PHOTO_INVALID", "That image format is not supported.");
  }

  if (signature && signature !== detectedFormat && !(signature === 'heif' && detectedFormat === 'avif') && !(signature === 'avif' && detectedFormat === 'heif')) {
    throw new ImageError("PHOTO_INVALID", "That image container header does not match its contents.");
  }

  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < MIN_DIMENSION ||
    metadata.height < MIN_DIMENSION
  ) {
    throw new ImageError("PHOTO_TOO_SMALL", "The photo is too small.");
  }

  /*
   * Re-encoded, never passed through.
   *
   * Dropping all metadata removes the EXIF block, which on a phone routinely
   * carries GPS coordinates — the applicant's home address, travelling with a
   * pass application. Bounding the dimensions also caps decompression cost.
   */
  const output = await sharp(buffer)
    .rotate() // honour EXIF orientation before it is stripped
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const fileName = `${baseName}.jpg`;
  const finalPath = path.join(directory, fileName);
  const tempPath = `${finalPath}.${crypto.randomBytes(6).toString("hex")}.tmp`;

  await fs.promises.writeFile(tempPath, output);
  await fs.promises.rename(tempPath, finalPath);

  return { path: finalPath, fileName, bytes: output.length };
};

module.exports = { processAndStore, ImageError };
