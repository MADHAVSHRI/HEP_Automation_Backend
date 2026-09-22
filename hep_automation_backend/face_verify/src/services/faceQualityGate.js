const sharp = require('sharp');

class FaceQualityGate {
  /**
   * Evaluate face capture quality.
   * @param {Buffer} imageBuffer - Original raw image buffer
   * @param {Array<object>} detections - List of detected faces from YuNet
   * @param {object} options - Threshold configurations
   * @returns {Promise<{ pass: boolean, status: string, reason: string|null, details: object }>}
   */
  static async validate(imageBuffer, detections, options = {}) {
    const minFaceSize = options.minFaceSize || 75; // minimum width/height in px
    const minConfidence = options.minConfidence || 0.70;
    const maxRollDeg = options.maxRollDeg || 25;
    const minBrightness = options.minBrightness || 35;
    const maxBrightness = options.maxBrightness || 235;
    const minLaplacianVar = options.minLaplacianVar || 3.0;

    // 1. Face Count Validation
    if (!detections || detections.length === 0) {
      return {
        pass: false,
        status: 'RECAPTURE_REQUIRED',
        reason: 'NO_FACE_DETECTED',
        details: { faceCount: 0 }
      };
    }

    if (detections.length > 1) {
      // Check if secondary faces are prominent
      const secondaryHighConf = detections.slice(1).some(d => d.score > 0.65);
      if (secondaryHighConf) {
        return {
          pass: false,
          status: 'RECAPTURE_REQUIRED',
          reason: 'MULTIPLE_FACES_DETECTED',
          details: { faceCount: detections.length }
        };
      }
    }

    const primaryFace = detections[0];

    // 2. Detection Confidence
    if (primaryFace.score < minConfidence) {
      return {
        pass: false,
        status: 'RECAPTURE_REQUIRED',
        reason: 'LOW_DETECTION_CONFIDENCE',
        details: { score: Number(primaryFace.score.toFixed(3)), minRequired: minConfidence }
      };
    }

    // 3. Face Bounding Box Size
    const [fx, fy, fw, fh] = primaryFace.bbox;
    if (fw < minFaceSize || fh < minFaceSize) {
      return {
        pass: false,
        status: 'RECAPTURE_REQUIRED',
        reason: 'FACE_TOO_SMALL_OR_FAR',
        details: { width: Math.round(fw), height: Math.round(fh), minRequired: minFaceSize }
      };
    }

    // 4. Facial Pose Estimation (Roll, Yaw, Pitch)
    const [rEye, lEye, nose, rMouth, lMouth] = primaryFace.landmarks;

    // Roll angle (in-plane tilt)
    const dxEyes = lEye[0] - rEye[0];
    const dyEyes = lEye[1] - rEye[1];
    const rollRad = Math.atan2(dyEyes, dxEyes);
    const rollDeg = Math.abs((rollRad * 180) / Math.PI);

    if (rollDeg > maxRollDeg) {
      return {
        pass: false,
        status: 'RECAPTURE_REQUIRED',
        reason: 'EXCESSIVE_HEAD_TILT',
        details: { rollDegrees: Number(rollDeg.toFixed(1)), maxAllowed: maxRollDeg }
      };
    }

    // Yaw asymmetry estimation (out-of-plane head turn)
    const distToRightEye = Math.hypot(nose[0] - rEye[0], nose[1] - rEye[1]);
    const distToLeftEye = Math.hypot(nose[0] - lEye[0], nose[1] - lEye[1]);
    const yawRatio = Math.max(distToRightEye, distToLeftEye) / (Math.min(distToRightEye, distToLeftEye) || 1);

    if (yawRatio > 2.8) {
      return {
        pass: false,
        status: 'RECAPTURE_REQUIRED',
        reason: 'EXCESSIVE_HEAD_YAW',
        details: { yawRatio: Number(yawRatio.toFixed(2)), maxAllowed: 2.8 }
      };
    }

    // 5. Illumination & Blur Checks on Cropped Face Region
    try {
      const metadata = await sharp(imageBuffer).metadata();
      const cropX = Math.max(0, Math.floor(fx));
      const cropY = Math.max(0, Math.floor(fy));
      const cropW = Math.min(metadata.width - cropX, Math.floor(fw));
      const cropH = Math.min(metadata.height - cropY, Math.floor(fh));

      if (cropW > 10 && cropH > 10) {
        const { data: grayData, info } = await sharp(imageBuffer)
          .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
          .grayscale()
          .raw()
          .toBuffer({ resolveWithObject: true });

        const numPixels = info.width * info.height;
        let sumBrightness = 0;
        for (let i = 0; i < numPixels; i++) {
          sumBrightness += grayData[i];
        }
        const meanBrightness = sumBrightness / numPixels;

        if (meanBrightness < minBrightness) {
          return {
            pass: false,
            status: 'RECAPTURE_REQUIRED',
            reason: 'IMAGE_TOO_DARK',
            details: { meanBrightness: Math.round(meanBrightness), minRequired: minBrightness }
          };
        }

        if (meanBrightness > maxBrightness) {
          return {
            pass: false,
            status: 'RECAPTURE_REQUIRED',
            reason: 'IMAGE_OVEREXPOSED',
            details: { meanBrightness: Math.round(meanBrightness), maxAllowed: maxBrightness }
          };
        }

        // Laplacian Variance for Blur Check
        const w = info.width;
        const h = info.height;
        let lapSum = 0;
        let lapSumSq = 0;
        let count = 0;

        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const center = grayData[y * w + x];
            const up = grayData[(y - 1) * w + x];
            const down = grayData[(y + 1) * w + x];
            const left = grayData[y * w + (x - 1)];
            const right = grayData[y * w + (x + 1)];

            const lap = Math.abs(4 * center - up - down - left - right);
            lapSum += lap;
            lapSumSq += lap * lap;
            count++;
          }
        }

        const lapMean = count > 0 ? lapSum / count : 0;
        const lapVariance = count > 0 ? (lapSumSq / count) - (lapMean * lapMean) : 0;

        if (lapVariance < minLaplacianVar) {
          return {
            pass: false,
            status: 'RECAPTURE_REQUIRED',
            reason: 'IMAGE_TOO_BLURRY',
            details: { blurVariance: Math.round(lapVariance), minRequired: minLaplacianVar }
          };
        }
      }
    } catch (e) {
      // Non-fatal, proceed if sharp image extraction fails
    }

    return {
      pass: true,
      status: 'QUALITY_ACCEPTED',
      reason: null,
      details: {
        score: Number(primaryFace.score.toFixed(3)),
        rollDeg: Number(rollDeg.toFixed(1)),
        yawRatio: Number(yawRatio.toFixed(2)),
        faceBox: [Math.round(fx), Math.round(fy), Math.round(fw), Math.round(fh)]
      }
    };
  }
}

module.exports = FaceQualityGate;
