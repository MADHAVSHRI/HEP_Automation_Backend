/**
 * Base Abstract Face Recognition Model interface.
 * Designed to allow seamless benchmarking and swapping of SFace, AdaFace, MobileFaceNet+ArcFace.
 */
class FaceRecognitionModel {
  constructor(modelName, embeddingDim) {
    if (new.target === FaceRecognitionModel) {
      throw new TypeError("Cannot instantiate abstract class FaceRecognitionModel directly.");
    }
    this.modelName = modelName;
    this.embeddingDim = embeddingDim;
    this.isReady = false;
  }

  async initialize() {
    throw new Error("Method 'initialize()' must be implemented.");
  }

  /**
   * Extract L2-normalized embedding vector from raw BGR array [3 * 112 * 112] or aligned buffer.
   * @param {Uint8Array|Buffer} rawBgr - Aligned 112x112 BGR data
   * @returns {Promise<Float32Array>} 
   */
  async extractEmbedding(rawBgr) {
    throw new Error("Method 'extractEmbedding()' must be implemented.");
  }

  getEmbeddingDimension() {
    return this.embeddingDim;
  }

  getModelName() {
    return this.modelName;
  }
}

module.exports = FaceRecognitionModel;
