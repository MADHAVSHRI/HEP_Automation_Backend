const fs = require('fs');
const path = require('path');
const YuNetDetector = require('./yunetDetector');
const FaceAligner = require('./faceAligner');
const FaceQualityGate = require('./faceQualityGate');
const AuraFaceModel = require('./models/AuraFaceModel');

const GALLERY_INDEX_PATH = path.join(__dirname, '../../models/gallery_index_auraface.json');
const DATASET_DIR = process.env.FACE_GALLERY_DIR || process.env.GALLERY_DATASET_DIR || '/home/cdac/Documents/lfw-apacs-processed-v2';
const SUPPORTED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.bmp', '.tiff', '.tif', '.gif']);

const isImageFile = (file) => {
  if (!file) return false;
  const ext = path.extname(file).toLowerCase();
  return SUPPORTED_IMAGE_EXTS.has(ext);
};

// Calibrated Acceptance Thresholds for 1:N Face Identification (AuraFace-v1 512-D ArcFace)
// Operational threshold: Similarity >= 48.0% (Cosine Distance <= 0.52)
// Leave-One-Out 1:N Impostor FAR across 3,465 identities: 1.24% (43 / 3,465)
// Genuine range: 48.84% (cross-age) to 99.8% (live/controlled)
const MATCH_THRESHOLD_SIMILARITY = 0.48;
const MIN_RANK_MARGIN = 0.03; // 3% margin between Rank-1 and Rank-2 for unambiguous 1:N

class RecognitionEngine {
  constructor() {
    this.detector = new YuNetDetector();
    this.recognitionModel = new AuraFaceModel();
    this.gallery = [];
    this.isReady = false;
    this.embeddingsMatrix = null;
    this.dim = 512;
    this.watcher = null;
    this.syncDebounceTimer = null;
    this.threshold = MATCH_THRESHOLD_SIMILARITY;
  }

  rebuildMatrix() {
    const total = this.gallery.length;
    this.embeddingsMatrix = new Float32Array(total * this.dim);
    for (let i = 0; i < total; i++) {
      const emb = this.gallery[i].embedding;
      for (let d = 0; d < this.dim; d++) {
        this.embeddingsMatrix[i * this.dim + d] = emb[d];
      }
    }
  }

  async initialize() {
    if (this.isReady) return;

    try {
      console.log('[RecognitionEngine] Initializing YuNet detector & AuraFace-v1 (512-D) model...');
      await this.detector.initialize();
      await this.recognitionModel.initialize();

      if (fs.existsSync(GALLERY_INDEX_PATH)) {
        console.log('[RecognitionEngine] Loading 512-D gallery index...');
        const data = JSON.parse(fs.readFileSync(GALLERY_INDEX_PATH, 'utf8'));
        this.gallery = data.identities || [];
        this.rebuildMatrix();
        console.log(`[RecognitionEngine] Gallery loaded with ${this.gallery.length} identities (512-D, θ=${(this.threshold * 100).toFixed(1)}%).`);
      } else {
        console.warn(`[RecognitionEngine] Gallery index not found at ${GALLERY_INDEX_PATH}.`);
      }

      // Warm up ONNX Runtime graph & memory pools
      const dummyBgr = new Uint8Array(112 * 112 * 3);
      await this.recognitionModel.extractEmbedding(dummyBgr);

      this.isReady = true;
      console.log('[RecognitionEngine] Recognition Engine initialized & warmed up successfully.');
      this.startDirectoryWatcher();
    } catch (err) {
      console.error('[RecognitionEngine] Initialization error:', err.message);
      throw err;
    }
  }

  startDirectoryWatcher() {
    if (this.watcher) return;

    if (!fs.existsSync(DATASET_DIR)) {
      console.log(`[RecognitionEngine] Notice: Gallery images folder "${DATASET_DIR}" not found. Live folder watch disabled (operating in pre-indexed mode). Configure FACE_GALLERY_DIR in .env if you have a local image folder.`);
      return;
    }

    try {
      this.watcher = fs.watch(DATASET_DIR, (eventType, filename) => {
        if (!filename) return;
        if (isImageFile(filename)) {
          console.log(`[RecognitionEngine] Detected file system event (${eventType}) for: ${filename}`);
          clearTimeout(this.syncDebounceTimer);
          this.syncDebounceTimer = setTimeout(() => {
            this.syncFolder().catch(console.error);
          }, 600);
        }
      });
      console.log(`[RecognitionEngine] Watching ${DATASET_DIR} for new face images...`);
    } catch (e) {
      console.warn('[RecognitionEngine] Directory watch error:', e.message);
    }
  }

  async syncFolder() {
    if (!fs.existsSync(DATASET_DIR)) {
      return { totalIdentities: this.gallery.length, added: 0 };
    }

    const files = fs.readdirSync(DATASET_DIR).filter(f => isImageFile(f));
    const existingFileNames = new Set(this.gallery.map(g => g.fileName));
    const newFiles = files.filter(f => !existingFileNames.has(f));

    if (newFiles.length === 0) {
      return { totalIdentities: this.gallery.length, added: 0 };
    }

    console.log(`[RecognitionEngine] Found ${newFiles.length} new images in folder. Computing aligned embeddings...`);
    let addedCount = 0;

    for (const file of newFiles) {
      try {
        const fullPath = path.join(DATASET_DIR, file);
        const buffer = fs.readFileSync(fullPath);
        const dets = await this.detector.detect(buffer);

        let rawBgr;
        if (dets && dets.length > 0) {
          const aligned = await FaceAligner.alignCrop(buffer, dets[0].landmarks);
          rawBgr = aligned.rawBgr;
        } else {
          continue;
        }

        const embedding = await this.recognitionModel.extractEmbedding(rawBgr);
        const rawName = path.parse(file).name;
        const formattedName = rawName.replace(/_/g, ' ');
        const id = this.gallery.length + 1;
        const passNumber = `APACS-PASS-2026-${String(id).padStart(5, '0')}`;

        this.gallery.push({
          id,
          name: formattedName,
          passNumber,
          isActive: true,
          expiryDate: '2026-12-31T23:59:59Z',
          fileName: file,
          embedding: Array.from(embedding)
        });
        addedCount++;
      } catch (err) {
        console.error(`[RecognitionEngine] Failed to process new file ${file}:`, err.message);
      }
    }

    if (addedCount > 0) {
      this.rebuildMatrix();
      fs.writeFileSync(GALLERY_INDEX_PATH, JSON.stringify({
        version: '2.0.0',
        model: 'AuraFace-v1-ResNet100-512D',
        indexedAt: new Date().toISOString(),
        totalRecords: this.gallery.length,
        identities: this.gallery
      }, null, 2));
      console.log(`[RecognitionEngine] Auto-indexed ${addedCount} new identities! Total gallery: ${this.gallery.length}`);
    }

    return { totalIdentities: this.gallery.length, added: addedCount };
  }

  /**
   * Enroll a new face identity directly into the gallery index.
   * 
   * @param {Buffer} imageBuffer - Raw face image
   * @param {object} meta - { name, passNumber, isActive, expiryDate }
   */
  async enrollIdentity(imageBuffer, meta = {}) {
    if (!this.isReady) {
      await this.initialize();
    }

    const name = (meta.name || '').trim();
    if (!name) {
      throw new Error('Name is required for biometric enrollment');
    }

    const detections = await this.detector.detect(imageBuffer);
    if (!detections || detections.length === 0) {
      throw new Error('NO_FACE_DETECTED: No valid face found in the provided image');
    }

    const primaryFace = detections[0];
    const { rawBgr } = await FaceAligner.alignCrop(imageBuffer, primaryFace.landmarks);
    const embedding = await this.recognitionModel.extractEmbedding(rawBgr);

    const id = this.gallery.length + 1;
    const passNumber = meta.passNumber || `APACS-PASS-2026-${String(id).padStart(5, '0')}`;
    const isActive = meta.isActive !== undefined ? Boolean(meta.isActive) : true;
    const expiryDate = meta.expiryDate || '2026-12-31T23:59:59Z';
    const fileName = `${name.replace(/\s+/g, '_')}.png`;

    const record = {
      id,
      name,
      passNumber,
      isActive,
      expiryDate,
      fileName,
      embedding: Array.from(embedding)
    };

    this.gallery.push(record);
    this.rebuildMatrix();

    // Persist to JSON index
    fs.writeFileSync(GALLERY_INDEX_PATH, JSON.stringify({
      version: '2.0.0',
      model: 'AuraFace-v1-ResNet100-512D',
      indexedAt: new Date().toISOString(),
      totalRecords: this.gallery.length,
      identities: this.gallery
    }, null, 2));

    console.log(`[RecognitionEngine] Enrolled new identity "${name}" (${passNumber})! Total gallery: ${this.gallery.length}`);

    return {
      success: true,
      identity: {
        id,
        name,
        passNumber,
        isActive,
        expiryDate,
        fileName
      },
      totalIdentities: this.gallery.length
    };
  }

  /**
   * Perform end-to-end 1:N face identification with quality gate and APACS authorization.
   * 
   * @param {Buffer} imageBuffer - Raw camera frame
   * @param {object} options - Optional config (topK, includeDebug)
   */
  async identify(imageBuffer, options = {}) {
    const t0 = Date.now();
    const topK = options.topK || 5;
    const includeDebug = options.includeDebug || false;

    if (!this.isReady) {
      await this.initialize();
    }

    if (!this.gallery || this.gallery.length === 0) {
      return {
        biometric_status: 'NO_MATCH',
        decision: 'DENY',
        reason: 'GALLERY_EMPTY',
        similarity: 0,
        candidates: [],
        latency_ms: Date.now() - t0
      };
    }

    // 1. Face Detection
    const tDetectStart = Date.now();
    const detections = await this.detector.detect(imageBuffer);
    const detectLatencyMs = Date.now() - tDetectStart;

    // 2. Face Quality Gate
    const quality = await FaceQualityGate.validate(imageBuffer, detections);
    if (!quality.pass) {
      return {
        biometric_status: 'RECAPTURE_REQUIRED',
        decision: 'RECAPTURE',
        reason: quality.reason,
        quality_details: quality.details,
        candidates: [],
        latency_ms: Date.now() - t0,
        latency_breakdown: { detection: detectLatencyMs }
      };
    }

    const primaryFace = detections[0];

    // 3. 5-Point Affine Alignment to Canonical 112x112
    const tAlignStart = Date.now();
    const { alignedBuffer, rawBgr } = await FaceAligner.alignCrop(imageBuffer, primaryFace.landmarks);
    const alignLatencyMs = Date.now() - tAlignStart;

    // 4. AuraFace Feature Extraction & Normalization (512-D ArcFace)
    const tInferStart = Date.now();
    const queryEmb = await this.recognitionModel.extractEmbedding(rawBgr);

    // Also compute horizontally flipped face embedding for mirror/selfie invariance
    let flippedEmb = null;
    try {
      const flippedRawBgr = new Uint8Array(112 * 112 * 3);
      for (let y = 0; y < 112; y++) {
        for (let x = 0; x < 112; x++) {
          const srcIdx = (y * 112 + x) * 3;
          const dstIdx = (y * 112 + (111 - x)) * 3;
          flippedRawBgr[dstIdx + 0] = rawBgr[srcIdx + 0];
          flippedRawBgr[dstIdx + 1] = rawBgr[srcIdx + 1];
          flippedRawBgr[dstIdx + 2] = rawBgr[srcIdx + 2];
        }
      }
      flippedEmb = await this.recognitionModel.extractEmbedding(flippedRawBgr);
    } catch (e) {}

    const inferLatencyMs = Date.now() - tInferStart;

    // 5. 1:N Vector Cosine Similarity Search across Gallery
    const tSearchStart = Date.now();
    const numIdentities = this.gallery.length;
    const scores = new Array(numIdentities);

    for (let i = 0; i < numIdentities; i++) {
      const offset = i * this.dim;
      let dot1 = 0;
      let dot2 = 0;
      for (let d = 0; d < this.dim; d++) {
        const gal = this.embeddingsMatrix[offset + d];
        dot1 += queryEmb[d] * gal;
        if (flippedEmb) dot2 += flippedEmb[d] * gal;
      }
      const similarity = Math.max(0, dot1, dot2);
      const distance = 1.0 - similarity;
      scores[i] = { index: i, distance, similarity };
    }

    // Sort descending by similarity
    scores.sort((a, b) => b.similarity - a.similarity);

    const candidates = scores.slice(0, topK).map(s => {
      const identity = this.gallery[s.index];
      return {
        id: identity.id,
        name: identity.name,
        passNumber: identity.passNumber,
        isActive: identity.isActive,
        expiryDate: identity.expiryDate,
        distance: Number(s.distance.toFixed(4)),
        similarityPercent: Number((s.similarity * 100).toFixed(2)),
        similarity: Number(s.similarity.toFixed(4))
      };
    });

    const searchLatencyMs = Date.now() - tSearchStart;
    const totalLatencyMs = Date.now() - t0;
    const rank1 = candidates[0];
    const rank2 = candidates[1];

    const debugInfo = includeDebug ? {
      detected_bbox: primaryFace.bbox,
      landmarks: primaryFace.landmarks,
      quality_details: quality.details,
      aligned_face_base64: alignedBuffer.toString('base64')
    } : undefined;

    // 6. Threshold Evaluation: Biometric Decision
    if (rank1.similarity < this.threshold) {
      return {
        biometric_status: 'NO_MATCH',
        decision: 'DENY',
        reason: 'NO_MATCH_FOUND_OR_BELOW_THRESHOLD',
        matched: false,
        similarity: rank1.similarity,
        confidence: rank1.similarityPercent,
        topCandidate: rank1,
        candidates,
        latency_ms: totalLatencyMs,
        latency_breakdown: {
          detection: detectLatencyMs,
          alignment: alignLatencyMs,
          inference: inferLatencyMs,
          search: searchLatencyMs
        },
        debug: debugInfo
      };
    }

    // 7. Margin / Ambiguity Check
    if (rank2 && (rank1.similarity - rank2.similarity) < MIN_RANK_MARGIN) {
      return {
        biometric_status: 'AMBIGUOUS_MATCH',
        decision: 'DENY',
        reason: 'AMBIGUOUS_MULTIPLE_CLOSE_CANDIDATES',
        matched: false,
        similarity: rank1.similarity,
        confidence: rank1.similarityPercent,
        topCandidate: rank1,
        candidates,
        latency_ms: totalLatencyMs,
        latency_breakdown: {
          detection: detectLatencyMs,
          alignment: alignLatencyMs,
          inference: inferLatencyMs,
          search: searchLatencyMs
        },
        debug: debugInfo
      };
    }

    // 8. APACS Business Authorization Check
    const isPassActive = rank1.isActive;
    const isNotExpired = new Date(rank1.expiryDate) > new Date();
    const isAuthorized = isPassActive && isNotExpired;

    if (!isAuthorized) {
      return {
        biometric_status: 'MATCH',
        authorization_status: isNotExpired ? 'PASS_SUSPENDED' : 'PASS_EXPIRED',
        decision: 'DENY',
        person_id: String(rank1.id),
        pass_id: rank1.passNumber,
        name: rank1.name,
        similarity: rank1.similarity,
        confidence: rank1.similarityPercent,
        matched: true,
        topCandidate: rank1,
        candidates,
        latency_ms: totalLatencyMs,
        latency_breakdown: {
          detection: detectLatencyMs,
          alignment: alignLatencyMs,
          inference: inferLatencyMs,
          search: searchLatencyMs
        },
        debug: debugInfo
      };
    }

    return {
      biometric_status: 'MATCH',
      authorization_status: 'AUTHORIZED',
      decision: 'ALLOW',
      person_id: String(rank1.id),
      pass_id: rank1.passNumber,
      name: rank1.name,
      similarity: rank1.similarity,
      confidence: rank1.similarityPercent,
      matched: true,
      topCandidate: rank1,
      candidates,
      latency_ms: totalLatencyMs,
      latency_breakdown: {
        detection: detectLatencyMs,
        alignment: alignLatencyMs,
        inference: inferLatencyMs,
        search: searchLatencyMs
      },
      debug: debugInfo
    };
  }

  getGalleryStats() {
    return {
      totalIdentities: this.gallery.length,
      model: this.recognitionModel.getModelName(),
      dimension: this.dim,
      ready: this.isReady,
      matchThresholdSimilarity: this.threshold,
      matchThresholdDistance: Number((1.0 - this.threshold).toFixed(4)),
      minRankMargin: MIN_RANK_MARGIN
    };
  }
}

const instance = new RecognitionEngine();
module.exports = instance;
