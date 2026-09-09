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
 * The declared type is set by the client and means nothing. A shell script
 * named evil.jpg arrives as image/jpeg for the asking.
 */
const signatureOf = (buffer) => {
  if (buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return "png";
  return null;
};

/**
 * Validates, normalises and stores one captured photograph.
 *
 * The file is written to a temporary name and renamed into place, so a crash
 * mid-write cannot leave a half-image that the portal would later try to show.
 */
const processAndStore = async (buffer, directory, baseName) => {
  const signature = signatureOf(buffer);
  if (!signature) {
    throw new ImageError("PHOTO_INVALID", "That image could not be read.");
  }

  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new ImageError("PHOTO_INVALID", "That image could not be read.");
  }

  // The container must agree with its own header. A mismatch means the file is
  // not what it claims and should not be decoded further.
  if (metadata.format !== signature) {
    throw new ImageError("PHOTO_INVALID", "That image could not be read.");
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
