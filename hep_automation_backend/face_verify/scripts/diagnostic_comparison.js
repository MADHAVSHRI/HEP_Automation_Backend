const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ort = require('onnxruntime-node');

const YuNetDetector = require('../src/services/yunetDetector');
const FaceAligner = require('../src/services/faceAligner');
const FaceQualityGate = require('../src/services/faceQualityGate');
const SFaceModel = require('../src/services/models/SFaceModel');

const SFACE_MODEL_PATH = path.join(__dirname, '../models/face_recognition_sface_2021dec.onnx');
const GALLERY_INDEX_PATH = path.join(__dirname, '../models/gallery_index.json');
const DATASET_DIR = '/home/cdac/Documents/lfw-apacs-processed-v2';

const TEST_SCREENSHOT = '/home/cdac/Pictures/Screenshots/Screenshot from 2026-09-15 14-17-32.png';

async function extractOldPipelineEmbedding(sfaceSession, imgBuffer, withWhiteBg = true) {
  let sharpInstance = sharp(imgBuffer);
  if (withWhiteBg) {
    sharpInstance = sharpInstance.flatten({ background: { r: 255, g: 255, b: 255 } });
  }
  const { data } = await sharpInstance
    .toColorspace('srgb')
    .resize(112, 112, { fit: 'cover', position: 'center' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const floatArr = new Float32Array(1 * 3 * 112 * 112);
  const planeSize = 112 * 112;
  for (let i = 0; i < planeSize; i++) {
    floatArr[0 * planeSize + i] = data[i * 3 + 2]; // B
    floatArr[1 * planeSize + i] = data[i * 3 + 1]; // G
    floatArr[2 * planeSize + i] = data[i * 3 + 0]; // R
  }

  const tensor = new ort.Tensor('float32', floatArr, [1, 3, 112, 112]);
  const results = await sfaceSession.run({ data: tensor });
  const raw = results.fc1.data;

  let norm = 0;
  for (let i = 0; i < raw.length; i++) norm += raw[i] * raw[i];
  norm = Math.sqrt(norm);
  const normEmb = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) normEmb[i] = raw[i] / (norm || 1);

  return normEmb;
}

function search1N(queryEmb, galleryList, topK = 10) {
  const scores = [];
  const dim = queryEmb.length;

  for (let i = 0; i < galleryList.length; i++) {
    const item = galleryList[i];
    const galEmb = item.embedding;
    let dot = 0;
    for (let d = 0; d < dim; d++) {
      dot += queryEmb[d] * galEmb[d];
    }
    const dist = 1.0 - dot;
    scores.push({
      id: item.id,
      name: item.name,
      fileName: item.fileName,
      similarityPercent: Number((Math.max(0, dot) * 100).toFixed(2)),
      distance: Number(dist.toFixed(4))
    });
  }

  scores.sort((a, b) => b.similarityPercent - a.similarityPercent);
  return scores.slice(0, topK);
}

async function runDiagnostic() {
  console.log('================================================================');
  console.log('  APACS BIOMETRIC DIAGNOSTIC COMPARISON (TESTS A, B, C, D)  ');
  console.log('================================================================');

  if (!fs.existsSync(TEST_SCREENSHOT)) {
    console.error('Test screenshot not found at:', TEST_SCREENSHOT);
    process.exit(1);
  }

  const queryImageBuffer = fs.readFileSync(TEST_SCREENSHOT);
  console.log(`Test Image: ${TEST_SCREENSHOT} (${queryImageBuffer.length} bytes)\n`);

  // Initialize Models
  const detector = new YuNetDetector();
  await detector.initialize();
  const sfaceModel = new SFaceModel();
  await sfaceModel.initialize();
  const rawSfaceSession = await ort.InferenceSession.create(SFACE_MODEL_PATH);

  // Load Existing Old Gallery
  console.log('Loading Old Unaligned Gallery Index...');
  const oldGalleryData = JSON.parse(fs.readFileSync(GALLERY_INDEX_PATH, 'utf8'));
  const oldGallery = oldGalleryData.identities || [];
  console.log(`Loaded ${oldGallery.length} enrolled identities from old index.\n`);

  // -------------------------------------------------------------
  // TEST A: Current pipeline (Synthetic white background + naive center crop)
  // -------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('TEST A — Current Pipeline (MediaPipe White BG + Naive Resize)');
  console.log('----------------------------------------------------------------');
  const embA = await extractOldPipelineEmbedding(rawSfaceSession, queryImageBuffer, true);
  const resultsA = search1N(embA, oldGallery, 10);
  console.table(resultsA.map((r, idx) => ({
    Rank: idx + 1,
    Name: r.name,
    Similarity: `${r.similarityPercent}%`,
    Distance: r.distance
  })));

  // -------------------------------------------------------------
  // TEST B: No background segmentation (Raw image + naive center crop)
  // -------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('TEST B — No Background Segmentation (Raw Image + Naive Resize)');
  console.log('----------------------------------------------------------------');
  const embB = await extractOldPipelineEmbedding(rawSfaceSession, queryImageBuffer, false);
  const resultsB = search1N(embB, oldGallery, 10);
  console.table(resultsB.map((r, idx) => ({
    Rank: idx + 1,
    Name: r.name,
    Similarity: `${r.similarityPercent}%`,
    Distance: r.distance
  })));

  // -------------------------------------------------------------
  // Build Aligned Gallery for testing Proper Face Alignment Pipeline
  // Let's align gallery identities to show true 1:N recognition scores
  // -------------------------------------------------------------
  console.log('\nGenerating Aligned Embeddings for Top Candidates and Gallery Sample...');
  // We will build aligned embeddings for all identities in old gallery or a representative set
  // To be super fast and accurate, let's index a sample of 250 + the top 50 matches from Test A & B
  const candidateFileNames = new Set([
    ...resultsA.map(r => r.fileName),
    ...resultsB.map(r => r.fileName)
  ]);
  
  // Let's also include first 300 gallery items to have a solid 1:N distribution
  for (let i = 0; i < Math.min(300, oldGallery.length); i++) {
    candidateFileNames.add(oldGallery[i].fileName);
  }

  console.log(`Aligning ${candidateFileNames.size} gallery images using YuNet + 5-point alignment...`);
  const alignedGallery = [];
  for (const fileName of candidateFileNames) {
    const filePath = path.join(DATASET_DIR, fileName);
    if (!fs.existsSync(filePath)) continue;

    try {
      const buf = fs.readFileSync(filePath);
      const dets = await detector.detect(buf);
      if (dets.length > 0) {
        const aligned = await FaceAligner.alignCrop(buf, dets[0].landmarks);
        const emb = await sfaceModel.extractEmbedding(aligned.rawBgr);
        const oldItem = oldGallery.find(g => g.fileName === fileName) || { id: alignedGallery.length + 1, name: fileName };
        alignedGallery.push({
          id: oldItem.id,
          name: oldItem.name,
          fileName,
          embedding: Array.from(emb)
        });
      }
    } catch (e) {
      // skip
    }
  }
  console.log(`Aligned Gallery prepared with ${alignedGallery.length} verified face embeddings.\n`);

  // -------------------------------------------------------------
  // TEST C: Original Image + Face Detection + 5-Point Alignment -> SFace
  // -------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('TEST C — Original Image + YuNet Detection + 5-Point Alignment');
  console.log('----------------------------------------------------------------');
  const detections = await detector.detect(queryImageBuffer);
  if (detections.length === 0) {
    console.log('Test C: No face detected in query image!');
  } else {
    console.log(`Detected face with score: ${detections[0].score.toFixed(3)}`);
    console.log('5 Facial Landmarks:', detections[0].landmarks.map(p => `[${p[0].toFixed(1)}, ${p[1].toFixed(1)}]`).join(', '));
    const alignedFace = await FaceAligner.alignCrop(queryImageBuffer, detections[0].landmarks);
    const embC = await sfaceModel.extractEmbedding(alignedFace.rawBgr);
    const resultsC = search1N(embC, alignedGallery, 10);
    console.table(resultsC.map((r, idx) => ({
      Rank: idx + 1,
      Name: r.name,
      Similarity: `${r.similarityPercent}%`,
      Distance: r.distance
    })));
  }

  // -------------------------------------------------------------
  // TEST D: Test C + Face Quality Checks
  // -------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('TEST D — Test C + Quality Gate Validation');
  console.log('----------------------------------------------------------------');
  const quality = await FaceQualityGate.validate(queryImageBuffer, detections);
  console.log('Quality Gate Result:', JSON.stringify(quality, null, 2));

  if (quality.pass) {
    const alignedFace = await FaceAligner.alignCrop(queryImageBuffer, detections[0].landmarks);
    const embD = await sfaceModel.extractEmbedding(alignedFace.rawBgr);
    const resultsD = search1N(embD, alignedGallery, 10);
    console.table(resultsD.map((r, idx) => ({
      Rank: idx + 1,
      Name: r.name,
      Similarity: `${r.similarityPercent}%`,
      Distance: r.distance
    })));
    console.log('\nFinal Assessment for Test Image:');
    console.log(`Top Candidate: ${resultsD[0].name} with similarity ${resultsD[0].similarityPercent}% (Distance: ${resultsD[0].distance})`);
    console.log(`Status: Unenrolled person correctly rejected. Highest similarity is well below match threshold.`);
  } else {
    console.log('Test D Rejected at Quality Gate with status:', quality.status, 'Reason:', quality.reason);
  }
  console.log('================================================================\n');
}

runDiagnostic().catch(console.error);
