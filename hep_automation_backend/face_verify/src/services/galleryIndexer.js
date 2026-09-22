const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const YuNetDetector = require('./yunetDetector');
const FaceAligner = require('./faceAligner');
const AuraFaceModel = require('./models/AuraFaceModel');

const DATASET_DIR = process.env.FACE_GALLERY_DIR || process.env.GALLERY_DATASET_DIR || '/home/cdac/Documents/lfw-apacs-processed-v2';
const OUTPUT_INDEX = path.join(__dirname, '../../models/gallery_index_auraface.json');

const SUPPORTED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.bmp', '.tiff', '.tif', '.gif']);

async function buildGallery() {
  console.log(`[GalleryIndexer] Starting standardized index build from ${DATASET_DIR}...`);
  if (!fs.existsSync(DATASET_DIR)) {
    console.error(`Dataset directory ${DATASET_DIR} does not exist!`);
    process.exit(1);
  }

  const files = fs.readdirSync(DATASET_DIR)
    .filter(f => SUPPORTED_IMAGE_EXTS.has(path.extname(f).toLowerCase()))
    .sort();

  console.log(`[GalleryIndexer] Found ${files.length} images to index.`);

  const detector = new YuNetDetector();
  await detector.initialize();
  const auraface = new AuraFaceModel();
  await auraface.initialize({ intraOpNumThreads: 8 });

  const gallery = [];
  const startTime = Date.now();
  let fallbackCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = path.join(DATASET_DIR, file);
    const rawName = path.parse(file).name;
    const formattedName = rawName.replace(/_/g, ' ');
    const passNumber = `APACS-PASS-2026-${String(i + 1).padStart(5, '0')}`;

    // Pass status simulation (2% expired)
    const isActive = (i % 50 !== 0);
    const expiryDate = isActive ? '2026-12-31T23:59:59Z' : '2026-08-01T00:00:00Z';

    try {
      const buffer = fs.readFileSync(fullPath);
      let detections = await detector.detect(buffer);

      let rawBgr;
      if (detections && detections.length > 0) {
        const aligned = await FaceAligner.alignCrop(buffer, detections[0].landmarks);
        rawBgr = aligned.rawBgr;
      } else {
        // Fallback: tightly cropped pass photo without strong detector landmarks
        fallbackCount++;
        const { data } = await sharp(buffer)
          .removeAlpha()
          .resize(112, 112, { fit: 'cover', position: 'center' })
          .raw()
          .toBuffer({ resolveWithObject: true });

        rawBgr = new Uint8Array(112 * 112 * 3);
        for (let p = 0; p < 112 * 112; p++) {
          rawBgr[p * 3 + 0] = data[p * 3 + 2]; // B
          rawBgr[p * 3 + 1] = data[p * 3 + 1]; // G
          rawBgr[p * 3 + 2] = data[p * 3 + 0]; // R
        }
      }

      const normEmb = await auraface.extractEmbedding(rawBgr);

      gallery.push({
        id: i + 1,
        name: formattedName,
        passNumber,
        isActive,
        expiryDate,
        fileName: file,
        embedding: Array.from(normEmb)
      });
    } catch (err) {
      console.error(`[GalleryIndexer] Error processing ${file}:`, err.message);
    }

    if ((i + 1) % 250 === 0 || (i + 1) === files.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = ((i + 1) / (elapsed || 1)).toFixed(1);
      console.log(`[GalleryIndexer] Processed ${i + 1}/${files.length} images (${elapsed}s, ${rate} img/s, fallbacks: ${fallbackCount})...`);
    }
  }

  console.log(`[GalleryIndexer] Saving gallery index with ${gallery.length} records to ${OUTPUT_INDEX}...`);
  fs.writeFileSync(OUTPUT_INDEX, JSON.stringify({
    version: '2.0.0',
    model: 'AuraFace-v1-ResNet100-512D',
    alignment: 'YuNet-5Point-Canonical-112x112',
    indexedAt: new Date().toISOString(),
    totalRecords: gallery.length,
    identities: gallery
  }, null, 2));

  console.log(`[GalleryIndexer] Complete! Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
}

if (require.main === module) {
  buildGallery().catch(console.error);
}

module.exports = { buildGallery };
