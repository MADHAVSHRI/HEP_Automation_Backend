const fs = require('fs');
const path = require('path');
const YuNetDetector = require('../src/services/yunetDetector');
const FaceAligner = require('../src/services/faceAligner');
const AuraFaceModel = require('../src/services/models/AuraFaceModel');

const GALLERY_INDEX_PATH = path.join(__dirname, '../models/gallery_index.json');
const AURAFACE_INDEX_PATH = path.join(__dirname, '../models/gallery_index_auraface.json');
const DATASET_DIR = '/home/cdac/Documents/lfw-apacs-processed-v2';

async function buildAuraFaceIndex() {
  console.log('Initializing YuNet & AuraFace models...');
  const detector = new YuNetDetector();
  await detector.initialize();
  const auraface = new AuraFaceModel();
  await auraface.initialize();

  const galleryData = JSON.parse(fs.readFileSync(GALLERY_INDEX_PATH, 'utf8'));
  const gallery = galleryData.identities || [];
  const N = gallery.length;

  console.log(`Extracting AuraFace 512-D embeddings for all ${N} identities in parallel...`);
  const t0 = Date.now();
  const auraGallery = [];

  const BATCH_SIZE = 8;
  for (let i = 0; i < N; i += BATCH_SIZE) {
    const batch = gallery.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(async (item) => {
      const p = path.join(DATASET_DIR, item.fileName);
      try {
        const buf = fs.readFileSync(p);
        const dets = await detector.detect(buf);
        if (dets && dets.length > 0) {
          const { rawBgr } = await FaceAligner.alignCrop(buf, dets[0].landmarks);
          const emb = await auraface.extractEmbedding(rawBgr);
          return {
            id: item.id,
            name: item.name,
            fileName: item.fileName,
            embedding: Array.from(emb)
          };
        }
      } catch (err) {
        console.error(`Error processing ${item.fileName}:`, err.message);
      }
      return null;
    }));

    for (const r of results) {
      if (r) auraGallery.push(r);
    }

    if ((i + BATCH_SIZE) % 200 === 0 || i + BATCH_SIZE >= N) {
      const count = Math.min(i + BATCH_SIZE, N);
      const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  [Progress] Processed ${count}/${N} identities (${elapsedSec}s elapsed)...`);
    }
  }

  const totalTimeMs = Date.now() - t0;
  console.log(`\nSuccessfully extracted ${auraGallery.length}/${N} AuraFace embeddings in ${(totalTimeMs / 1000).toFixed(2)}s (${(totalTimeMs / auraGallery.length).toFixed(2)} ms/face avg).`);

  fs.writeFileSync(AURAFACE_INDEX_PATH, JSON.stringify({ identities: auraGallery }, null, 2));
  console.log(`Saved AuraFace index to ${AURAFACE_INDEX_PATH}`);
}

buildAuraFaceIndex().catch(console.error);
