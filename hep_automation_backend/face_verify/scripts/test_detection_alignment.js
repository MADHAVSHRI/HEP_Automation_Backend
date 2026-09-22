const fs = require('fs');
const path = require('path');
const YuNetDetector = require('../src/services/yunetDetector');
const FaceAligner = require('../src/services/faceAligner');
const FaceQualityGate = require('../src/services/faceQualityGate');
const SFaceModel = require('../src/services/models/SFaceModel');

(async () => {
  try {
    console.log('--- Initializing Modules ---');
    const detector = new YuNetDetector();
    await detector.initialize();
    const sface = new SFaceModel();
    await sface.initialize();

    const testImagePath = '/home/cdac/Documents/lfw-apacs-processed-v2/Aaron_Eckhart.png';
    console.log('Testing on gallery image:', testImagePath);
    const imgBuffer = fs.readFileSync(testImagePath);

    console.log('1. Running YuNet Detection...');
    const detections = await detector.detect(imgBuffer);
    console.log(`Detected ${detections.length} faces.`);
    if (detections.length === 0) {
      console.error('No faces detected!');
      process.exit(1);
    }
    const face = detections[0];
    console.log('Bbox:', face.bbox);
    console.log('Score:', face.score);
    console.log('Landmarks (5 points):', face.landmarks);

    console.log('2. Running Quality Gate...');
    const quality = await FaceQualityGate.validate(imgBuffer, detections);
    console.log('Quality result:', quality);

    console.log('3. Running 5-Point Affine Alignment...');
    const aligned = await FaceAligner.alignCrop(imgBuffer, face.landmarks);
    console.log('Aligned crop generated. Buffer size:', aligned.alignedBuffer.length, 'BGR size:', aligned.rawBgr.length);

    console.log('4. Extracting SFace Embedding...');
    const embedding = await sface.extractEmbedding(aligned.rawBgr);
    console.log('Embedding extracted! Dimension:', embedding.length);
    let norm = 0;
    for (let i = 0; i < embedding.length; i++) norm += embedding[i] * embedding[i];
    console.log('L2 Norm of embedding:', Math.sqrt(norm).toFixed(4));

    // Also test on the false positive screenshot image
    const screenshotPath = '/home/cdac/Pictures/Screenshots/Screenshot from 2026-09-15 14-17-32.png';
    if (fs.existsSync(screenshotPath)) {
      console.log('\nTesting on false-positive screenshot:', screenshotPath);
      const ssBuffer = fs.readFileSync(screenshotPath);
      const ssDetections = await detector.detect(ssBuffer);
      console.log(`Detected ${ssDetections.length} faces in screenshot.`);
      if (ssDetections.length > 0) {
        console.log('Screenshot Bbox:', ssDetections[0].bbox);
        console.log('Screenshot Score:', ssDetections[0].score);
        console.log('Screenshot Landmarks:', ssDetections[0].landmarks);
        const ssQuality = await FaceQualityGate.validate(ssBuffer, ssDetections);
        console.log('Screenshot Quality result:', ssQuality);
        const ssAligned = await FaceAligner.alignCrop(ssBuffer, ssDetections[0].landmarks);
        const ssEmb = await sface.extractEmbedding(ssAligned.rawBgr);
        console.log('Screenshot Embedding extracted! Dimension:', ssEmb.length);
      }
    }

    console.log('\n--- Pipeline Verification SUCCESS ---');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
})();
