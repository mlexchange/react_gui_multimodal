/**
 * Calculates width in pixel space from q-space parameters for inclined linecuts
 *
 * @param qXPosition - Central X position in q-space
 * @param qYPosition - Central Y position in q-space
 * @param angle - Angle of the linecut in degrees
 * @param qWidth - Width in q-space units
 * @param qXVector - Vector mapping x pixel positions to q-values
 * @param qYVector - Vector mapping y pixel positions to q-values
 * @param beamCenterX - X coordinate of the beam center in pixels
 * @param beamCenterY - Y coordinate of the beam center in pixels
 * @returns Width in pixel units
 */
export const calculateInclinedQSpaceToPixelWidth = (
  qXPosition: number,
  qYPosition: number,
  angle: number,
  qWidth: number,
  qXVector: number[],
  qYVector: number[],
): number => {
  // If width is zero or vectors are empty, return 0
  if (qWidth <= 0 || !qXVector || !qYVector || qXVector.length === 0 || qYVector.length === 0) {
    return 0;
  }

  // Convert central position to image coordinates
  const [centerPixelX, centerPixelY] = qToPixel(qXPosition, qYPosition, qXVector, qYVector);

  // Calculate direction vectors based on angle
  const angleRad = (angle * Math.PI) / 180;
  const dirX = Math.cos(angleRad);
  const dirY = -Math.sin(angleRad); // Y-axis points downward in image coordinates

  // Perpendicular vector for width calculations
  const perpX = -dirY;
  const perpY = dirX;

  // Calculate point at half-width distance in q-space along the perpendicular vector
  const halfWidth = qWidth / 2;
  const qPoint1x = qXPosition + perpX * halfWidth;
  const qPoint1y = qYPosition + perpY * halfWidth;

  // Find pixel position for this q-space point
  const [pixel1X, pixel1Y] = qToPixel(qPoint1x, qPoint1y, qXVector, qYVector);

  // Calculate pixel distance between center and half-width point
  const pixelDistanceHalfWidth = Math.sqrt(
    Math.pow(pixel1X - centerPixelX, 2) +
    Math.pow(pixel1Y - centerPixelY, 2)
  );

  // Return the full width in pixels (twice the half-width)
  return pixelDistanceHalfWidth * 2;
};

/**
 * Convert q-space coordinates to pixel coordinates
 *
 * @param qX - X position in q-space
 * @param qY - Y position in q-space
 * @param qXVector - Vector mapping x pixel positions to q-values
 * @param qYVector - Vector mapping y pixel positions to q-values
 * @returns Pixel coordinates [x, y]
 */
export const qToPixel = (
  qX: number,
  qY: number,
  qXVector: number[],
  qYVector: number[]
): [number, number] => {
  // Find index of closest q-value in qXVector
  let xPixel = 0;
  let minDiffX = Math.abs(qXVector[0] - qX);

  for (let i = 1; i < qXVector.length; i++) {
    const diff = Math.abs(qXVector[i] - qX);
    if (diff < minDiffX) {
      minDiffX = diff;
      xPixel = i;
    }
  }

  // Find index of closest q-value in qYVector
  let yPixel = 0;
  let minDiffY = Math.abs(qYVector[0] - qY);

  for (let i = 1; i < qYVector.length; i++) {
    const diff = Math.abs(qYVector[i] - qY);
    if (diff < minDiffY) {
      minDiffY = diff;
      yPixel = i;
    }
  }

  return [xPixel, yPixel];
};
