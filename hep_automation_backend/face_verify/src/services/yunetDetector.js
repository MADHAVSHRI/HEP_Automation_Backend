const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ort = require('onnxruntime-node');

const DEFAULT_MODEL_PATH = path.join(__dirname, '../../models/face_detection_yunet_2023mar.onnx');

class YuNetDetector {
  constructor(modelPath = DEFAULT_MODEL_PATH) {
    this.modelPath = modelPath;
    this.session = null;
    this.inputWidth = 640;
    this.inputHeight = 640;
    this.scoreThreshold = 0.6;
    this.nmsThreshold = 0.3;
  }

  async initialize() {
    if (this.session) return;
    this.session = await ort.InferenceSession.create(this.modelPath);
  }

  /**
   * Detect faces in an image buffer.
   * @param {Buffer} imageBuffer - Raw image buffer (JPEG, PNG, etc.)
   * @returns {Promise<Array<{bbox: [x, y, w, h], score: number, landmarks: Array<[x, y]>}>>}
   */
  async detect(imageBuffer) {
    if (!this.session) {
      await this.initialize();
    }

    const metadata = await sharp(imageBuffer).metadata();
    const origW = metadata.width;
    const origH = metadata.height;

    // Resize maintaining aspect ratio with letterboxing into 640x640
    const scale = Math.min(this.inputWidth / origW, this.inputHeight / origH);
    const scaledW = Math.round(origW * scale);
    const scaledH = Math.round(origH * scale);
    const padX = Math.floor((this.inputWidth - scaledW) / 2);
    const padY = Math.floor((this.inputHeight - scaledH) / 2);

    const { data: rawRgb } = await sharp(imageBuffer)
      .resize(scaledW, scaledH, { fit: 'fill' })
      .extend({
        top: padY,
        bottom: this.inputHeight - scaledH - padY,
        left: padX,
        right: this.inputWidth - scaledW - padX,
        background: { r: 0, g: 0, b: 0 }
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Convert RGB to BGR planar Float32Array [1, 3, 640, 640]
    const planeSize = this.inputWidth * this.inputHeight;
    const floatArr = new Float32Array(3 * planeSize);
    for (let i = 0; i < planeSize; i++) {
      floatArr[0 * planeSize + i] = rawRgb[i * 3 + 2]; // B
      floatArr[1 * planeSize + i] = rawRgb[i * 3 + 1]; // G
      floatArr[2 * planeSize + i] = rawRgb[i * 3 + 0]; // R
    }

    const inputTensor = new ort.Tensor('float32', floatArr, [1, 3, this.inputHeight, this.inputWidth]);
    const results = await this.session.run({ input: inputTensor });

    // Decode anchors across strides [8, 16, 32]
    const candidates = [];
    for (const stride of [8, 16, 32]) {
      const cls = results[`cls_${stride}`].data;
      const obj = results[`obj_${stride}`].data;
      const bbox = results[`bbox_${stride}`].data;
      const kps = results[`kps_${stride}`].data;

      const cols = this.inputWidth / stride;
      const totalAnchors = cls.length;

      for (let idx = 0; idx < totalAnchors; idx++) {
        const clsScore = cls[idx];
        const objScore = obj[idx];
        const score = Math.sqrt(Math.max(0, clsScore) * Math.max(0, objScore));

        if (score < this.scoreThreshold) continue;

        const col = idx % cols;
        const row = Math.floor(idx / cols);

        // Bbox decode
        const dx = bbox[idx * 4 + 0];
        const dy = bbox[idx * 4 + 1];
        const dw = bbox[idx * 4 + 2];
        const dh = bbox[idx * 4 + 3];

        const cxNet = (col + dx) * stride;
        const cyNet = (row + dy) * stride;
        const wNet = Math.exp(dw) * stride;
        const hNet = Math.exp(dh) * stride;

        // Map back from 640x640 letterbox coordinates to original image coordinates
        const xOrig = (cxNet - wNet / 2 - padX) / scale;
        const yOrig = (cyNet - hNet / 2 - padY) / scale;
        const wOrig = wNet / scale;
        const hOrig = hNet / scale;

        // Landmarks decode: 5 points: right eye, left eye, nose, right mouth, left mouth
        const landmarks = [];
        for (let k = 0; k < 5; k++) {
          const kxNet = (col + kps[idx * 10 + k * 2 + 0]) * stride;
          const kyNet = (row + kps[idx * 10 + k * 2 + 1]) * stride;
          const kxOrig = (kxNet - padX) / scale;
          const kyOrig = (kyNet - padY) / scale;
          landmarks.push([kxOrig, kyOrig]);
        }

        candidates.push({
          bbox: [xOrig, yOrig, wOrig, hOrig],
          score,
          landmarks
        });
      }
    }

    // Apply Non-Maximum Suppression (NMS)
    const detections = this.nms(candidates, this.nmsThreshold);
    return detections;
  }

  iou(boxA, boxB) {
    const xA = Math.max(boxA[0], boxB[0]);
    const yA = Math.max(boxA[1], boxB[1]);
    const xB = Math.min(boxA[0] + boxA[2], boxB[0] + boxB[2]);
    const yB = Math.min(boxA[1] + boxA[3], boxB[1] + boxB[3]);

    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const boxAArea = boxA[2] * boxA[3];
    const boxBArea = boxB[2] * boxB[3];
    const unionArea = boxAArea + boxBArea - interArea;

    return unionArea > 0 ? interArea / unionArea : 0;
  }

  nms(candidates, iouThreshold) {
    candidates.sort((a, b) => b.score - a.score);
    const picked = [];
    const suppressed = new Uint8Array(candidates.length);

    for (let i = 0; i < candidates.length; i++) {
      if (suppressed[i]) continue;
      picked.push(candidates[i]);

      for (let j = i + 1; j < candidates.length; j++) {
        if (suppressed[j]) continue;
        if (this.iou(candidates[i].bbox, candidates[j].bbox) > iouThreshold) {
          suppressed[j] = 1;
        }
      }
    }

    return picked;
  }
}

module.exports = YuNetDetector;
