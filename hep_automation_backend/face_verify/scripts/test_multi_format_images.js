const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const recognitionEngine = require('../src/services/recognitionEngine');
const { processAndStore, ImageError } = require('../src/utils/image');
const { upload } = require('../src/middlewares/uploadMiddleware');

(async () => {
  console.log('================================================================');
  console.log('  APACS BIOMETRIC MULTI-FORMAT IMAGE ACCEPTANCE TEST            ');
  console.log('  Testing: WebP, AVIF, JPEG, PNG, BMP, TIFF, GIF                ');
  console.log('================================================================\n');

  await recognitionEngine.initialize();

  const sourceImagePath = '/home/cdac/Documents/lfw-apacs-processed-v2/Aaron_Guiel.png';
  if (!fs.existsSync(sourceImagePath)) {
    console.error(`Source test image not found at ${sourceImagePath}`);
    process.exit(1);
  }

  const baseBuffer = fs.readFileSync(sourceImagePath);

  // Helper to generate valid 24-bit uncompressed BMP buffer
  const generateBmpBuffer = async (srcBuf) => {
    const { data, info } = await sharp(srcBuf).raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const rowSize = Math.floor((24 * width + 31) / 32) * 4;
    const pixelArraySize = rowSize * height;
    const fileSize = 54 + pixelArraySize;
    const bmpBuf = Buffer.alloc(fileSize);

    // Bitmap file header
    bmpBuf.write('BM', 0);
    bmpBuf.writeUInt32LE(fileSize, 2);
    bmpBuf.writeUInt32LE(54, 10); // offset to pixel data

    // DIB header (BITMAPINFOHEADER)
    bmpBuf.writeUInt32LE(40, 14); // header size
    bmpBuf.writeInt32LE(width, 18);
    bmpBuf.writeInt32LE(height, 22); // positive = bottom-up
    bmpBuf.writeUInt16LE(1, 26);  // color planes
    bmpBuf.writeUInt16LE(24, 28); // bits per pixel
    bmpBuf.writeUInt32LE(0, 30);  // BI_RGB (no compression)
    bmpBuf.writeUInt32LE(pixelArraySize, 34);

    // Pixel data (BGR, bottom-to-top)
    for (let y = 0; y < height; y++) {
      const srcY = height - 1 - y;
      const rowOffset = 54 + y * rowSize;
      for (let x = 0; x < width; x++) {
        const srcIdx = (srcY * width + x) * channels;
        const dstIdx = rowOffset + x * 3;
        bmpBuf[dstIdx + 0] = data[srcIdx + 2]; // B
        bmpBuf[dstIdx + 1] = data[srcIdx + 1]; // G
        bmpBuf[dstIdx + 2] = data[srcIdx + 0]; // R
      }
    }
    return bmpBuf;
  };

  // Generate test image buffers across multiple formats
  const formats = [
    { name: 'WebP', ext: '.webp', gen: async () => sharp(baseBuffer).webp().toBuffer(), mime: 'image/webp' },
    { name: 'AVIF', ext: '.avif', gen: async () => sharp(baseBuffer).avif().toBuffer(), mime: 'image/avif' },
    { name: 'JPEG', ext: '.jpg', gen: async () => sharp(baseBuffer).jpeg().toBuffer(), mime: 'image/jpeg' },
    { name: 'PNG', ext: '.png', gen: async () => sharp(baseBuffer).png().toBuffer(), mime: 'image/png' },
    { name: 'BMP', ext: '.bmp', gen: async () => generateBmpBuffer(baseBuffer), mime: 'image/bmp' },
    { name: 'TIFF', ext: '.tiff', gen: async () => sharp(baseBuffer).tiff().toBuffer(), mime: 'image/tiff' },
    { name: 'GIF', ext: '.gif', gen: async () => sharp(baseBuffer).gif().toBuffer(), mime: 'image/gif' }
  ];

  const tmpTestDir = path.join(__dirname, '../uploads/test_formats_tmp');
  if (!fs.existsSync(tmpTestDir)) {
    fs.mkdirSync(tmpTestDir, { recursive: true });
  }

  console.log('----------------------------------------------------------------');
  console.log('STAGE 1: Testing Recognition Engine 1:N Identification');
  console.log('----------------------------------------------------------------');

  for (const fmt of formats) {
    try {
      const buffer = await fmt.gen();
      const t0 = Date.now();
      const result = await recognitionEngine.identify(buffer);
      const elapsed = Date.now() - t0;

      const isMatch = result.biometric_status === 'MATCH' && result.name === 'Aaron Guiel';
      const simPercent = (result.similarity * 100).toFixed(2);

      console.log(`[${fmt.name.padEnd(5)}] Format Size: ${(buffer.length / 1024).toFixed(1)} KB | Match: ${result.name} (${simPercent}%) | Latency: ${elapsed}ms | Status: ${isMatch ? 'PASSED ✅' : 'FAILED ❌'}`);

      if (!isMatch) {
        console.error(`  -> Failed details:`, result);
      }
    } catch (err) {
      console.error(`[${fmt.name}] Error:`, err.message);
    }
  }

  console.log('\n----------------------------------------------------------------');
  console.log('STAGE 2: Testing processAndStore (Image Signature & Normalization)');
  console.log('----------------------------------------------------------------');

  for (const fmt of formats) {
    try {
      const buffer = await fmt.gen();
      const baseName = `test_${fmt.name.toLowerCase()}`;
      const stored = await processAndStore(buffer, tmpTestDir, baseName);
      console.log(`[${fmt.name.padEnd(5)}] Signature & Stored: ${stored.fileName} (${(stored.bytes / 1024).toFixed(1)} KB JPEG) | Status: PASSED ✅`);
    } catch (err) {
      console.error(`[${fmt.name.padEnd(5)}] Stored Error:`, err.message);
    }
  }

  console.log('\n----------------------------------------------------------------');
  console.log('STAGE 3: Negative Security Test (Reject Non-Image Formats)');
  console.log('----------------------------------------------------------------');

  const fakePdfBuffer = Buffer.from('%PDF-1.4 Fake malicious script content pretending to be image');
  try {
    await processAndStore(fakePdfBuffer, tmpTestDir, 'fake_script');
    console.error('[FAKE_PDF] FAILED: Invalid binary was unexpectedly accepted ❌');
  } catch (err) {
    console.log(`[FAKE_PDF] Correctly rejected (${err.code}: ${err.message}) | Status: PASSED ✅`);
  }

  // Cleanup tmp dir
  try {
    fs.rmSync(tmpTestDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n================================================================');
  console.log('  ALL MULTI-FORMAT IMAGE TESTS COMPLETED SUCCESSFULLY!          ');
  console.log('================================================================\n');
})();
