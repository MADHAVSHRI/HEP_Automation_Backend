const sharp = require('sharp');

/**
 * Standard SFace / ArcFace canonical 5-point facial landmark reference (112x112 coordinate space).
 * Order: [right_eye, left_eye, nose_tip, right_mouth_corner, left_mouth_corner]
 */
const CANONICAL_LANDMARKS_112 = [
  [38.2946, 51.6963],
  [73.5319, 51.6963],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.3655]
];

class FaceAligner {
  /**
   * Estimate 2D similarity transformation matrix (rotation, uniform scale, translation)
   * matching source detected landmarks to canonical target landmarks using least squares (Umeyama).
   * 
   * Maps source -> target: dst = M * src
   * @param {Array<[number, number]>} srcPoints 
   * @param {Array<[number, number]>} dstPoints 
   */
  static estimateSimilarityTransform(srcPoints, dstPoints = CANONICAL_LANDMARKS_112) {
    const n = srcPoints.length;
    let srcMeanX = 0, srcMeanY = 0, dstMeanX = 0, dstMeanY = 0;
    for (let i = 0; i < n; i++) {
      srcMeanX += srcPoints[i][0];
      srcMeanY += srcPoints[i][1];
      dstMeanX += dstPoints[i][0];
      dstMeanY += dstPoints[i][1];
    }
    srcMeanX /= n; srcMeanY /= n;
    dstMeanX /= n; dstMeanY /= n;

    let srcVar = 0;
    let sxx = 0, sxy = 0, syx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      const sX = srcPoints[i][0] - srcMeanX;
      const sY = srcPoints[i][1] - srcMeanY;
      const dX = dstPoints[i][0] - dstMeanX;
      const dY = dstPoints[i][1] - dstMeanY;

      srcVar += sX * sX + sY * sY;
      sxx += dX * sX;
      sxy += dX * sY;
      syx += dY * sX;
      syy += dY * sY;
    }

    if (srcVar < 1e-7) {
      return { a: 1, b: 0, tx: 0, ty: 0 };
    }

    const a = (sxx + syy) / srcVar;
    const b = (syx - sxy) / srcVar;

    const tx = dstMeanX - (a * srcMeanX - b * srcMeanY);
    const ty = dstMeanY - (b * srcMeanX + a * srcMeanY);

    return { a, b, tx, ty };
  }

  /**
   * Align and crop a face from an image buffer using 5 facial landmarks to a 112x112 aligned face chip.
   * 
   * @param {Buffer} imageBuffer - Raw image buffer
   * @param {Array<[number, number]>} landmarks - 5 detected facial points
   * @param {number} targetWidth - Target width (default 112)
   * @param {number} targetHeight - Target height (default 112)
   * @returns {Promise<{ alignedBuffer: Buffer, rawBgr: Uint8Array }>}
   */
  static async alignCrop(imageBuffer, landmarks, targetWidth = 112, targetHeight = 112) {
    const { data: rawPixels, info } = await sharp(imageBuffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .toColorspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true });

    const srcW = info.width;
    const srcH = info.height;
    const channels = info.channels; // usually 3 (RGB)

    const { a, b, tx, ty } = this.estimateSimilarityTransform(landmarks, CANONICAL_LANDMARKS_112);
    const denom = a * a + b * b;

    // Allocate 112x112 target RGB and BGR buffers
    const targetRgb = Buffer.alloc(targetWidth * targetHeight * 3);
    const rawBgr = new Uint8Array(targetWidth * targetHeight * 3);

    for (let dy = 0; dy < targetHeight; dy++) {
      for (let dx = 0; dx < targetWidth; dx++) {
        // Inverse transform from target (dx, dy) back to source (sx, sy)
        const xShift = dx - tx;
        const yShift = dy - ty;
        const sx = (a * xShift + b * yShift) / denom;
        const sy = (-b * xShift + a * yShift) / denom;

        let r = 0, g = 0, bVal = 0;

        if (sx >= 0 && sx < srcW - 1 && sy >= 0 && sy < srcH - 1) {
          // Bilinear interpolation
          const x0 = Math.floor(sx);
          const y0 = Math.floor(sy);
          const x1 = x0 + 1;
          const y1 = y0 + 1;

          const wx1 = sx - x0;
          const wx0 = 1.0 - wx1;
          const wy1 = sy - y0;
          const wy0 = 1.0 - wy1;

          const idx00 = (y0 * srcW + x0) * channels;
          const idx01 = (y0 * srcW + x1) * channels;
          const idx10 = (y1 * srcW + x0) * channels;
          const idx11 = (y1 * srcW + x1) * channels;

          r = Math.round(
            wy0 * (wx0 * rawPixels[idx00 + 0] + wx1 * rawPixels[idx01 + 0]) +
            wy1 * (wx0 * rawPixels[idx10 + 0] + wx1 * rawPixels[idx11 + 0])
          );
          g = Math.round(
            wy0 * (wx0 * rawPixels[idx00 + 1] + wx1 * rawPixels[idx01 + 1]) +
            wy1 * (wx0 * rawPixels[idx10 + 1] + wx1 * rawPixels[idx11 + 1])
          );
          bVal = Math.round(
            wy0 * (wx0 * rawPixels[idx00 + 2] + wx1 * rawPixels[idx01 + 2]) +
            wy1 * (wx0 * rawPixels[idx10 + 2] + wx1 * rawPixels[idx11 + 2])
          );
        }

        const outIdx = (dy * targetWidth + dx) * 3;
        targetRgb[outIdx + 0] = r;
        targetRgb[outIdx + 1] = g;
        targetRgb[outIdx + 2] = bVal;

        // BGR array for SFace
        rawBgr[outIdx + 0] = bVal; // B
        rawBgr[outIdx + 1] = g;    // G
        rawBgr[outIdx + 2] = r;    // R
      }
    }

    const alignedJpeg = await sharp(targetRgb, {
      raw: { width: targetWidth, height: targetHeight, channels: 3 }
    }).jpeg({ quality: 95 }).toBuffer();

    return {
      alignedBuffer: alignedJpeg,
      rawBgr,
      rawRgb: targetRgb
    };
  }
}

module.exports = FaceAligner;
