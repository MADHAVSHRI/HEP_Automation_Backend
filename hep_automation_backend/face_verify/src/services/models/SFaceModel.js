const path = require('path');
const ort = require('onnxruntime-node');
const FaceRecognitionModel = require('./FaceRecognitionModel');

const DEFAULT_SFACE_MODEL_PATH = path.join(__dirname, '../../../models/face_recognition_sface_2021dec.onnx');

class SFaceModel extends FaceRecognitionModel {
  constructor(modelPath = DEFAULT_SFACE_MODEL_PATH) {
    super('OpenCV-SFace-128D', 128);
    this.modelPath = modelPath;
    this.session = null;
  }

  async initialize() {
    if (this.session) return;
    this.session = await ort.InferenceSession.create(this.modelPath);
    this.isReady = true;
  }

  /**
   * Extract L2-normalized 128-D embedding from aligned 112x112 BGR data.
   * @param {Uint8Array} rawBgr - Uint8Array of length 112*112*3 in BGR order (interleaved)
   * @returns {Promise<Float32Array>}
   */
  async extractEmbedding(rawBgr) {
    if (!this.session) {
      await this.initialize();
    }

    const planeSize = 112 * 112;
    const floatArr = new Float32Array(3 * planeSize);

    // Convert interleaved BGR (B,G,R, B,G,R...) to planar BGR [3, 112, 112]
    for (let i = 0; i < planeSize; i++) {
      floatArr[0 * planeSize + i] = rawBgr[i * 3 + 0]; // B
      floatArr[1 * planeSize + i] = rawBgr[i * 3 + 1]; // G
      floatArr[2 * planeSize + i] = rawBgr[i * 3 + 2]; // R
    }

    const inputTensor = new ort.Tensor('float32', floatArr, [1, 3, 112, 112]);
    const results = await this.session.run({ data: inputTensor });
    const raw = results.fc1.data;

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

module.exports = SFaceModel;
