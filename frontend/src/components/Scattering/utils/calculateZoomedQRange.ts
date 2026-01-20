/**
 * Utilities for calculating visible Q ranges when the image is zoomed.
 */

import { InclinedLinecut } from "../types";

interface CalculateZoomedAzimuthalQRangeParams {
  zoomedXPixelRange: [number, number];
  zoomedYPixelRange: [number, number];
  qMagnitudeMatrix: number[][];
}

interface CalculateZoomedInclinedQRangeParams {
  linecut: InclinedLinecut;
  zoomedXPixelRange: [number, number];
  zoomedYPixelRange: [number, number];
  qXVector: number[];
  qYVector: number[];
  beamCenterX: number;
  beamCenterY: number;
}

function normalizePixelBounds(
  xRange: [number, number],
  yRange: [number, number],
  maxX: number,
  maxY: number
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  return {
    xMin: Math.max(0, Math.floor(Math.min(xRange[0], xRange[1]))),
    xMax: Math.min(maxX, Math.ceil(Math.max(xRange[0], xRange[1]))),
    yMin: Math.max(0, Math.floor(Math.min(yRange[0], yRange[1]))),
    yMax: Math.min(maxY, Math.ceil(Math.max(yRange[0], yRange[1])))
  };
}

/**
 * Finds where a line intersects with a rectangular region.
 * Returns the t parameters of entry and exit points, or null if no intersection.
 */
function findLineRectIntersection(
  centerX: number,
  centerY: number,
  dx: number,
  dy: number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number
): [number, number] | null {
  const isInBounds = (x: number, y: number) =>
    x >= xMin - 0.5 && x <= xMax + 0.5 && y >= yMin - 0.5 && y <= yMax + 0.5;

  const validTimes: number[] = [];

  if (Math.abs(dx) > 1e-10) {
    const tLeft = (xMin - centerX) / dx;
    const yLeft = centerY + tLeft * dy;
    if (isInBounds(xMin, yLeft)) validTimes.push(tLeft);

    const tRight = (xMax - centerX) / dx;
    const yRight = centerY + tRight * dy;
    if (isInBounds(xMax, yRight)) validTimes.push(tRight);
  }

  if (Math.abs(dy) > 1e-10) {
    const tTop = (yMin - centerY) / dy;
    const xTop = centerX + tTop * dx;
    if (isInBounds(xTop, yMin)) validTimes.push(tTop);

    const tBottom = (yMax - centerY) / dy;
    const xBottom = centerX + tBottom * dx;
    if (isInBounds(xBottom, yMax)) validTimes.push(tBottom);
  }

  if (validTimes.length < 2) {
    return null;
  }

  validTimes.sort((a, b) => a - b);
  return [validTimes[0], validTimes[validTimes.length - 1]];
}

function computeSignedQRadial(
  pixelX: number,
  pixelY: number,
  qXVector: number[],
  qYVector: number[],
  beamCenterX: number,
  beamCenterY: number,
  isVertical: boolean
): number {
  const boundedX = Math.min(
    Math.max(0, Math.round(pixelX)),
    qXVector.length - 1
  );
  const boundedY = Math.min(
    Math.max(0, Math.round(pixelY)),
    qYVector.length - 1
  );

  const qX = qXVector[boundedX];
  const qY = qYVector[boundedY];

  if (isVertical) {
    const qYCenter =
      qYVector[
        Math.min(Math.max(0, Math.round(beamCenterY)), qYVector.length - 1)
      ];
    return qY - qYCenter;
  } else {
    const qRadial = Math.sqrt(qX * qX + qY * qY);
    const isLeftOfBeamCenter = pixelX < beamCenterX;
    return isLeftOfBeamCenter ? -qRadial : qRadial;
  }
}

/**
 * Calculates visible Q-magnitude range for azimuthal integration.
 * Scans all pixels in the visible region and finds min/max Q values.
 */
export function calculateZoomedAzimuthalQRange({
  zoomedXPixelRange,
  zoomedYPixelRange,
  qMagnitudeMatrix
}: CalculateZoomedAzimuthalQRangeParams): [number, number] | null {
  if (!qMagnitudeMatrix || qMagnitudeMatrix.length === 0) {
    return null;
  }

  const { xMin, xMax, yMin, yMax } = normalizePixelBounds(
    zoomedXPixelRange,
    zoomedYPixelRange,
    qMagnitudeMatrix[0]?.length - 1 || 0,
    qMagnitudeMatrix.length - 1
  );

  let minQ = Infinity;
  let maxQ = -Infinity;

  for (let y = yMin; y <= yMax; y++) {
    const row = qMagnitudeMatrix[y];
    if (!row) continue;

    for (let x = xMin; x <= xMax; x++) {
      const q = row[x];
      if (q !== undefined && Number.isFinite(q)) {
        minQ = Math.min(minQ, q);
        maxQ = Math.max(maxQ, q);
      }
    }
  }

  if (!Number.isFinite(minQ) || !Number.isFinite(maxQ) || minQ >= maxQ) {
    return null;
  }

  return [minQ, maxQ];
}

/**
 * Calculates visible signed q-radial range for an inclined linecut.
 * Finds where the line intersects the zoomed region and computes q-radial at those points.
 */
export function calculateZoomedInclinedQRange({
  linecut,
  zoomedXPixelRange,
  zoomedYPixelRange,
  qXVector,
  qYVector,
  beamCenterX,
  beamCenterY
}: CalculateZoomedInclinedQRangeParams): [number, number] | null {
  if (!qXVector.length || !qYVector.length) {
    return null;
  }

  const radians = (linecut.angle * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = -Math.sin(radians);

  const xMin = Math.min(zoomedXPixelRange[0], zoomedXPixelRange[1]);
  const xMax = Math.max(zoomedXPixelRange[0], zoomedXPixelRange[1]);
  const yMin = Math.min(zoomedYPixelRange[0], zoomedYPixelRange[1]);
  const yMax = Math.max(zoomedYPixelRange[0], zoomedYPixelRange[1]);

  const intersection = findLineRectIntersection(
    beamCenterX,
    beamCenterY,
    dx,
    dy,
    xMin,
    xMax,
    yMin,
    yMax
  );

  if (!intersection) {
    return null;
  }

  const [t1, t2] = intersection;
  const x1 = beamCenterX + t1 * dx;
  const y1 = beamCenterY + t1 * dy;
  const x2 = beamCenterX + t2 * dx;
  const y2 = beamCenterY + t2 * dy;

  const isVertical = Math.abs(Math.abs(linecut.angle) - 90) < 1;

  const qRadial1 = computeSignedQRadial(
    x1,
    y1,
    qXVector,
    qYVector,
    beamCenterX,
    beamCenterY,
    isVertical
  );
  const qRadial2 = computeSignedQRadial(
    x2,
    y2,
    qXVector,
    qYVector,
    beamCenterX,
    beamCenterY,
    isVertical
  );

  return qRadial1 < qRadial2 ? [qRadial1, qRadial2] : [qRadial2, qRadial1];
}
