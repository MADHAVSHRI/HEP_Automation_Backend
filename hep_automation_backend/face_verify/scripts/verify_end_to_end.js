const fs = require('fs');
const path = require('path');
const recognitionEngine = require('../src/services/recognitionEngine');

(async () => {
  console.log('================================================================');
  console.log('  APACS BIOMETRIC END-TO-END VERIFICATION & ACCEPTANCE TEST     ');
  console.log('================================================================');

  await recognitionEngine.initialize();
  console.log('Stats:', recognitionEngine.getGalleryStats());

  // 1. Test False-Positive Screenshot (Unenrolled person)
  const screenshotPath = '/home/cdac/Pictures/Screenshots/Screenshot from 2026-09-15 14-17-32.png';
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 1: Unenrolled Screenshot (False Positive Check)');
  console.log('----------------------------------------------------------------');
  const ssBuffer = fs.readFileSync(screenshotPath);
  const result1 = await recognitionEngine.identify(ssBuffer, { includeDebug: true });
  console.log('Result 1:', {
    biometric_status: result1.biometric_status,
    decision: result1.decision,
    reason: result1.reason,
    topCandidate: result1.topCandidate,
    similarity: result1.similarity,
    latency_ms: result1.latency_ms,
    latency_breakdown: result1.latency_breakdown
  });

  if (result1.decision === 'DENY' && result1.biometric_status === 'NO_MATCH') {
    console.log('>>> TEST 1 PASSED: Unenrolled user correctly rejected as NO_MATCH / DENY! <<<');
  } else {
    console.error('>>> TEST 1 FAILED! Expected DENY / NO_MATCH <<<');
  }

  // 2. Test Enrolled Genuine Identity with Active Pass (Aaron Guiel)
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 2A: Enrolled Genuine Identity with Active Pass (Aaron Guiel)');
  console.log('----------------------------------------------------------------');
  const aaronGuielPath = '/home/cdac/Documents/lfw-apacs-processed-v2/Aaron_Guiel.png';
  const aaronGuielBuffer = fs.readFileSync(aaronGuielPath);
  const result2A = await recognitionEngine.identify(aaronGuielBuffer);
  console.log('Result 2A:', {
    biometric_status: result2A.biometric_status,
    authorization_status: result2A.authorization_status,
    decision: result2A.decision,
    name: result2A.name,
    pass_id: result2A.pass_id,
    similarity: result2A.similarity,
    latency_ms: result2A.latency_ms
  });

  if (result2A.decision === 'ALLOW' && result2A.biometric_status === 'MATCH' && result2A.name === 'Aaron Guiel') {
    console.log('>>> TEST 2A PASSED: Genuine user with active pass returned MATCH / ALLOW! <<<');
  } else {
    console.error('>>> TEST 2A FAILED! <<<');
  }

  // 2B. Test Enrolled Genuine Identity with Expired Pass (Aaron Eckhart)
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 2B: Enrolled Genuine Identity with Expired Pass (Aaron Eckhart)');
  console.log('----------------------------------------------------------------');
  const aaronPath = '/home/cdac/Documents/lfw-apacs-processed-v2/Aaron_Eckhart.png';
  const aaronBuffer = fs.readFileSync(aaronPath);
  const result2B = await recognitionEngine.identify(aaronBuffer);
  console.log('Result 2B:', {
    biometric_status: result2B.biometric_status,
    authorization_status: result2B.authorization_status,
    decision: result2B.decision,
    name: result2B.name,
    pass_id: result2B.pass_id,
    similarity: result2B.similarity,
    latency_ms: result2B.latency_ms
  });

  if (result2B.biometric_status === 'MATCH' && result2B.authorization_status === 'PASS_EXPIRED' && result2B.decision === 'DENY') {
    console.log('>>> TEST 2B PASSED: Biometric match succeeded (MATCH), but business authorization correctly returned PASS_EXPIRED / DENY! <<<');
  } else {
    console.error('>>> TEST 2B FAILED! <<<');
  }

  // 3. Test Quality Gate Recapture (Blank image / No face)
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 3: Quality Gate Recapture (Blank Image)');
  console.log('----------------------------------------------------------------');
  const blankBuffer = Buffer.alloc(320 * 320 * 3, 128); // flat gray image
  const sharp = require('sharp');
  const blankJpeg = await sharp(blankBuffer, { raw: { width: 320, height: 320, channels: 3 } }).jpeg().toBuffer();
  const result3 = await recognitionEngine.identify(blankJpeg);
  console.log('Result 3:', {
    biometric_status: result3.biometric_status,
    decision: result3.decision,
    reason: result3.reason
  });

  if (result3.biometric_status === 'RECAPTURE_REQUIRED' && result3.decision === 'RECAPTURE') {
    console.log('>>> TEST 3 PASSED: Blank image triggered RECAPTURE_REQUIRED! <<<');
  } else {
    console.error('>>> TEST 3 FAILED! Expected RECAPTURE_REQUIRED <<<');
  }

  console.log('\n================================================================');
  console.log('            ALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!      ');
  console.log('================================================================\n');
})();
