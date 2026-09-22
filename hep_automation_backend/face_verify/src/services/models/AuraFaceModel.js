const path = require('path');
const ort = require('onnxruntime-node');
const FaceRecognitionModel = require('./FaceRecognitionModel');

const DEFAULT_AURAFACE_MODEL_PATH = path.join(__dirname, '../../../models/auraface_v1.onnx');

class AuraFaceModel extends FaceRecognitionModel {
  constructor(modelPath = DEFAULT_AURAFACE_MODEL_PATH) {
    super('AuraFace-v1-ResNet100-512D', 512);
    this.modelPath = modelPath;
    this.session = null;
    this.inputName = null;
    this.outputName = null;
  }

  async initialize(options = {}) {
    if (this.session) return;
    const sessionOptions = {
      intraOpNumThreads: options.intraOpNumThreads || 8,
      graphOptimizationLevel: options.graphOptimizationLevel || 'all',
      ...options
    };
    this.session = await ort.InferenceSession.create(this.modelPath, sessionOptions);
    this.inputName = this.session.inputNames[0];
    this.outputName = this.session.outputNames[0];
    this.isReady = true;
  }

  /**
   * Extract L2-normalized 512-D embedding from aligned 112x112 RGB/BGR data.
   * Standard InsightFace / AuraFace normalization: (pixel - 127.5) / 127.5, RGB planar [1, 3, 112, 112].
   * 
   * @param {Uint8Array} rawBgr - Interleaved BGR bytes (from faceAligner)
   * @returns {Promise<Float32Array>}
   */
  async extractEmbedding(rawBgr) {
    if (!this.session) {
      await this.initialize();
    }

    const planeSize = 112 * 112;
    const floatArr = new Float32Array(3 * planeSize);

    // Convert interleaved BGR (B,G,R) to normalized RGB planar [3, 112, 112]
    // Normalized to [-1.0, 1.0]: (x - 127.5) / 127.5
    for (let i = 0; i < planeSize; i++) {
      const b = rawBgr[i * 3 + 0];
      const g = rawBgr[i * 3 + 1];
      const r = rawBgr[i * 3 + 2];

      floatArr[0 * planeSize + i] = (r - 127.5) / 127.5; // R
      floatArr[1 * planeSize + i] = (g - 127.5) / 127.5; // G
      floatArr[2 * planeSize + i] = (b - 127.5) / 127.5; // B
    }

    const inputTensor = new ort.Tensor('float32', floatArr, [1, 3, 112, 112]);
    const feeds = {};
    feeds[this.inputName] = inputTensor;

    const results = await this.session.run(feeds);
    const raw = results[this.outputName].data;

    // L2 Unit Normalization
    let norm = 0;
    for (let i = 0; i < raw.length; i++) {
      norm += raw[i] * raw[i];
    }
    norm = Math.sqrt(norm);

    const normEmb = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      normEmb[i] = raw[i] / (norm || 1);
    }

    return normEmb;
  }
}

module.exports = AuraFaceModel;
