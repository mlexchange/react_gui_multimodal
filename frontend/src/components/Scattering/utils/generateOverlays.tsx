/**
 * SVG-based overlay generation for H5Web visualization.
 *
 * Provides components for rendering linecut, inclined linecut, and azimuthal
 * integration overlays using H5Web's DataToHtml and SvgElement components
 * for proper coordinate transformation.
 */

import React, { useMemo, useId } from "react";
import { DataToHtml, SvgElement } from "@h5web/lib";
import { Vector3 } from "three";
import { calculateInclinedLineEndpoints } from "./calculateInclinedLinecutEndpoints";
import type { InclinedLinecut } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface AzimuthalSectorOverlayProps {
  integrations: Array<{
    qRange: [number, number] | null;
    azimuthRange: [number, number];
    color: string;
    hidden?: boolean;
  }>;
  qMagnitudeMatrix: number[][] | null;
  beamCenterX: number;
  beamCenterY: number;
  maxQValue: number;
  imageWidth: number;
  imageHeight: number;
}

export interface LinecutOverlayProps {
  linecuts: Array<{
    position: number; // pixel position
    width: number; // width in pixels
    color: string;
    type: "horizontal" | "vertical";
    hidden?: boolean;
  }>;
  rows: number;
  cols: number;
}

export interface InclinedLinecutOverlayProps {
  linecuts: Array<{
    angle: number;
    qWidth: number;
    qXPosition: number;
    qYPosition: number;
    color: string;
    hidden?: boolean;
  }>;
  rows: number;
  cols: number;
  beamCenterX: number;
  beamCenterY: number;
  pixelWidthCalculator: (
    qXPosition: number,
    qYPosition: number,
    angle: number,
    qWidth: number
  ) => number;
}

// ============================================================================
// Q-to-Radius Calculator
// ============================================================================

/**
 * Find pixel radius for a given Q-value by sampling along radial lines.
 * Uses the cached Q-magnitude matrix computed from qX and qY.
 *
 * Strategy: Sample along 8 radial directions from beam center and interpolate
 * to find the exact radius where Q = targetQ.
 *
 * @param targetQ - The Q-value to find the radius for
 * @param qMagnitudeMatrix - 2D array of Q-magnitude values (sqrt(qX^2 + qY^2))
 * @param beamCenterX - X-coordinate of beam center in pixels
 * @param beamCenterY - Y-coordinate of beam center in pixels
 * @param imageWidth - Width of the image in pixels
 * @param imageHeight - Height of the image in pixels
 * @returns Estimated radius in pixels, or null if not found
 */
function findRadiusForQValue(
  targetQ: number,
  qMagnitudeMatrix: number[][],
  beamCenterX: number,
  beamCenterY: number,
  imageWidth: number,
  imageHeight: number
): number | null {
  if (!qMagnitudeMatrix.length || !qMagnitudeMatrix[0]?.length) return null;

  // Sample along 8 radial directions (every 45 degrees)
  const sampleAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  const radiiFound: number[] = [];

  for (const angle of sampleAngles) {
    const radians = (angle * Math.PI) / 180;
    const dx = Math.cos(radians);
    const dy = Math.sin(radians);

    // Calculate maximum radius we can sample in this direction
    const maxRadius = Math.max(imageWidth, imageHeight);

    // Sample along this radial line
    let prevQ =
      qMagnitudeMatrix[Math.round(beamCenterY)]?.[Math.round(beamCenterX)] ?? 0;
    let prevRadius = 0;

    for (let r = 1; r < maxRadius; r += 2) {
      const x = Math.round(beamCenterX + r * dx);
      const y = Math.round(beamCenterY + r * dy);

      // Check bounds
      if (x < 0 || x >= imageWidth || y < 0 || y >= imageHeight) break;

      const currentQ = qMagnitudeMatrix[y]?.[x];
      if (currentQ === undefined || isNaN(currentQ)) continue;

      // Check if we crossed the target Q value
      if (
        (prevQ <= targetQ && currentQ >= targetQ) ||
        (prevQ >= targetQ && currentQ <= targetQ)
      ) {
        // Linear interpolation to estimate the exact radius
        const t = (targetQ - prevQ) / (currentQ - prevQ);
        const estimatedRadius = prevRadius + t * (r - prevRadius);
        radiiFound.push(estimatedRadius);
        break;
      }

      prevQ = currentQ;
      prevRadius = r;
    }
  }

  if (radiiFound.length === 0) return null;

  // Return the average of found radii
  return radiiFound.reduce((a, b) => a + b, 0) / radiiFound.length;
}

// ============================================================================
// SVG Path Generators
// ============================================================================

/**
 * Generate arc points for SVG rendering.
 * Returns an array of Vector3 points along the arc.
 *
 * @param radius - Radius of the arc in pixels
 * @param startAngleDeg - Start angle in degrees (0 = up/north, clockwise)
 * @param endAngleDeg - End angle in degrees
 * @param beamCenterX - X-coordinate of beam center
 * @param beamCenterY - Y-coordinate of beam center
 * @param numPoints - Number of points to generate
 * @returns Array of Vector3 points along the arc
 */
function generateArcPoints(
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
  beamCenterX: number,
  beamCenterY: number,
  numPoints: number = 60
): Vector3[] {
  const points: Vector3[] = [];

  // Handle angle wrapping
  let angleDiff = endAngleDeg - startAngleDeg;
  if (angleDiff < 0) angleDiff += 360;
  if (angleDiff > 360) angleDiff = 360;

  const angleStep = angleDiff / (numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    const angleDeg = startAngleDeg + i * angleStep;
    // Convert to radians: 0 = up, clockwise positive
    // SVG/canvas uses 0 = right, counter-clockwise positive
    // So we need: -angleDeg + 90 to convert
    const radians = ((-angleDeg + 90) * Math.PI) / 180;
    const x = beamCenterX + radius * Math.cos(radians);
    const y = beamCenterY - radius * Math.sin(radians);
    points.push(new Vector3(x, y));
  }

  return points;
}

/**
 * Generate points for a radial line from beam center outward.
 *
 * @param angleDeg - Angle in degrees (0 = up/north, clockwise)
 * @param innerRadius - Inner radius in pixels
 * @param outerRadius - Outer radius in pixels
 * @param beamCenterX - X-coordinate of beam center
 * @param beamCenterY - Y-coordinate of beam center
 * @returns Array of two Vector3 points (start and end of line)
 */
function generateRadialLinePoints(
  angleDeg: number,
  innerRadius: number,
  outerRadius: number,
  beamCenterX: number,
  beamCenterY: number
): [Vector3, Vector3] {
  const radians = ((-angleDeg + 90) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const innerX = beamCenterX + innerRadius * cos;
  const innerY = beamCenterY - innerRadius * sin;
  const outerX = beamCenterX + outerRadius * cos;
  const outerY = beamCenterY - outerRadius * sin;

  return [new Vector3(innerX, innerY), new Vector3(outerX, outerY)];
}

/**
 * Generate polygon points for a filled ring sector.
 * Creates a closed shape: outer arc -> radial line -> inner arc (reversed) -> radial line back.
 *
 * For innerRadius = 0 (filled pie slice): outer arc + center point
 * For innerRadius > 0 (ring sector): outer arc + inner arc reversed
 *
 * @param innerRadius - Inner radius in pixels (0 for filled pie slice)
 * @param outerRadius - Outer radius in pixels
 * @param startAngleDeg - Start angle in degrees
 * @param endAngleDeg - End angle in degrees
 * @param beamCenterX - X-coordinate of beam center
 * @param beamCenterY - Y-coordinate of beam center
 * @param numPointsPerArc - Number of points per arc
 * @returns Array of Vector3 points forming the polygon
 */
function generateRingSectorPoints(
  innerRadius: number,
  outerRadius: number,
  startAngleDeg: number,
  endAngleDeg: number,
  beamCenterX: number,
  beamCenterY: number,
  numPointsPerArc: number = 30
): Vector3[] {
  // Generate outer arc (forward direction: startAngle to endAngle)
  const outerArc = generateArcPoints(
    outerRadius,
    startAngleDeg,
    endAngleDeg,
    beamCenterX,
    beamCenterY,
    numPointsPerArc
  );

  if (innerRadius <= 0) {
    // For filled pie slice (no hole), add center point to close the polygon
    return [...outerArc, new Vector3(beamCenterX, beamCenterY)];
  }

  // Generate inner arc (forward direction: startAngle to endAngle)
  const innerArc = generateArcPoints(
    innerRadius,
    startAngleDeg,
    endAngleDeg,
    beamCenterX,
    beamCenterY,
    numPointsPerArc
  );

  // Reverse the inner arc so we go: outer arc forward, then inner arc backward
  // This creates a proper closed polygon for the ring sector
  const innerArcReversed = [...innerArc].reverse();

  // Combine: outer arc forward, then inner arc reversed
  return [...outerArc, ...innerArcReversed];
}

/**
 * Generate polygon points for a filled circle (full 360 degrees).
 *
 * For innerRadius = 0: filled circle
 * For innerRadius > 0: filled ring shape
 *
 * Uses SVG evenodd fill-rule to create the hole in the ring.
 */
function generateCircleOrRingPoints(
  innerRadius: number,
  outerRadius: number,
  beamCenterX: number,
  beamCenterY: number,
  numPoints: number = 60
): { outerCircle: Vector3[]; innerCircle: Vector3[] } {
  // Generate outer circle
  const outerCircle = generateArcPoints(
    outerRadius,
    0,
    360,
    beamCenterX,
    beamCenterY,
    numPoints
  );

  // Generate inner circle (if there's a hole)
  const innerCircle =
    innerRadius > 0
      ? generateArcPoints(
          innerRadius,
          0,
          360,
          beamCenterX,
          beamCenterY,
          numPoints
        )
      : [];

  return { outerCircle, innerCircle };
}

// ============================================================================
// Azimuthal Sector Overlay Component
// ============================================================================

/**
 * SVG-based azimuthal sector overlay for H5Web visualization.
 *
 * Renders filled sectors and stroke arcs for azimuthal integrations.
 * Uses cached Q-magnitude matrix for exact radius calculations.
 */
export const AzimuthalSectorOverlay: React.FC<AzimuthalSectorOverlayProps> = ({
  integrations,
  qMagnitudeMatrix,
  beamCenterX,
  beamCenterY,
  maxQValue,
  imageWidth,
  imageHeight
}) => {
  // Generate unique ID for clipPath
  const clipId = useId();
  const clipPathId = `azimuthal-clip-${clipId}`;

  // Image corner points for clipping (in data coordinates)
  const clipCorners = useMemo(
    () => [
      new Vector3(0, 0),
      new Vector3(imageWidth, 0),
      new Vector3(imageWidth, imageHeight),
      new Vector3(0, imageHeight)
    ],
    [imageWidth, imageHeight]
  );

  // Filter visible integrations
  const visibleIntegrations = integrations.filter((int) => !int.hidden);

  // Compute overlay data for all visible integrations
  const overlayData = useMemo(() => {
    if (!qMagnitudeMatrix || visibleIntegrations.length === 0) {
      return [];
    }

    return visibleIntegrations.map((integration) => {
      const { qRange, azimuthRange, color } = integration;
      const [startAngle, endAngle] = azimuthRange;
      const isFullCircle = Math.abs(endAngle - startAngle) >= 360;

      // Get Q-values for inner and outer arcs
      const innerQ = qRange ? qRange[0] : 0;
      const outerQ = qRange ? qRange[1] : maxQValue;

      // Find radii for the Q-values
      const innerRadius =
        innerQ > 0
          ? (findRadiusForQValue(
              innerQ,
              qMagnitudeMatrix,
              beamCenterX,
              beamCenterY,
              imageWidth,
              imageHeight
            ) ?? 0)
          : 0;
      const outerRadius =
        findRadiusForQValue(
          outerQ,
          qMagnitudeMatrix,
          beamCenterX,
          beamCenterY,
          imageWidth,
          imageHeight
        ) ?? Math.max(imageWidth, imageHeight);

      // Generate points for filled sector
      const numPointsPerArc = isFullCircle
        ? 60
        : Math.max(20, Math.ceil(Math.abs(endAngle - startAngle) / 3));

      // For full circle, generate circle/ring points
      // For partial circle, generate ring sector points
      let sectorPoints: Vector3[] = [];
      let circleData: {
        outerCircle: Vector3[];
        innerCircle: Vector3[];
      } | null = null;

      if (isFullCircle) {
        // Full circle: use separate outer and inner circles with evenodd fill-rule
        circleData = generateCircleOrRingPoints(
          innerRadius,
          outerRadius,
          beamCenterX,
          beamCenterY,
          numPointsPerArc
        );
      } else {
        // Partial circle: use ring sector polygon
        sectorPoints = generateRingSectorPoints(
          innerRadius,
          outerRadius,
          startAngle,
          endAngle,
          beamCenterX,
          beamCenterY,
          numPointsPerArc
        );
      }

      // Generate arc stroke points
      const outerArcPoints = generateArcPoints(
        outerRadius,
        isFullCircle ? 0 : startAngle,
        isFullCircle ? 360 : endAngle,
        beamCenterX,
        beamCenterY,
        isFullCircle ? 60 : numPointsPerArc
      );

      const innerArcPoints =
        innerRadius > 0
          ? generateArcPoints(
              innerRadius,
              isFullCircle ? 0 : startAngle,
              isFullCircle ? 360 : endAngle,
              beamCenterX,
              beamCenterY,
              isFullCircle ? 60 : numPointsPerArc
            )
          : [];

      // Generate radial line points (only for non-full circles)
      let startRadialPoints: [Vector3, Vector3] | null = null;
      let endRadialPoints: [Vector3, Vector3] | null = null;

      if (!isFullCircle && innerRadius >= 0 && outerRadius > 0) {
        startRadialPoints = generateRadialLinePoints(
          startAngle,
          innerRadius,
          outerRadius,
          beamCenterX,
          beamCenterY
        );
        endRadialPoints = generateRadialLinePoints(
          endAngle,
          innerRadius,
          outerRadius,
          beamCenterX,
          beamCenterY
        );
      }

      return {
        color,
        isFullCircle,
        innerRadius,
        outerRadius,
        sectorPoints,
        circleData,
        outerArcPoints,
        innerArcPoints,
        startRadialPoints,
        endRadialPoints
      };
    });
  }, [
    visibleIntegrations,
    qMagnitudeMatrix,
    beamCenterX,
    beamCenterY,
    maxQValue,
    imageWidth,
    imageHeight
  ]);

  if (overlayData.length === 0) {
    return null;
  }

  return (
    <>
      {/* Define clipPath for constraining overlay to image bounds */}
      <DataToHtml points={clipCorners}>
        {(topLeft, topRight, bottomRight, bottomLeft) => (
          <SvgElement>
            <defs>
              <clipPath id={clipPathId}>
                <polygon
                  points={`${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}`}
                />
              </clipPath>
            </defs>
          </SvgElement>
        )}
      </DataToHtml>

      {overlayData.map((data, index) => {
        const {
          color,
          isFullCircle,
          sectorPoints,
          circleData,
          outerArcPoints,
          innerArcPoints,
          startRadialPoints,
          endRadialPoints
        } = data;

        return (
          <React.Fragment key={`azimuthal-sector-${index}`}>
            {/* Full filled circle */}
            {isFullCircle &&
              circleData &&
              circleData.outerCircle.length >= 3 && (
                <>
                  {/* If no inner circle (innerRadius = 0), draw filled circle */}
                  {circleData.innerCircle.length === 0 ? (
                    <DataToHtml points={circleData.outerCircle}>
                      {(...htmlPoints) => (
                        <SvgElement>
                          <g clipPath={`url(#${clipPathId})`}>
                            <polygon
                              points={htmlPoints
                                .map((p) => `${p.x},${p.y}`)
                                .join(" ")}
                              fill={color}
                              fillOpacity={0.2}
                              stroke="none"
                            />
                          </g>
                        </SvgElement>
                      )}
                    </DataToHtml>
                  ) : (
                    /* If inner circle exists (innerRadius > 0), draw using path with evenodd */
                    <DataToHtml
                      points={[
                        ...circleData.outerCircle,
                        ...circleData.innerCircle
                      ]}
                    >
                      {(...htmlPoints) => {
                        const outerLen = circleData.outerCircle.length;
                        const outerPoints = htmlPoints.slice(0, outerLen);
                        const innerPoints = htmlPoints.slice(outerLen);

                        // Build SVG path: outer circle (clockwise) + inner circle (counter-clockwise for hole)
                        const outerPath =
                          outerPoints
                            .map((p, i) =>
                              i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
                            )
                            .join(" ") + " Z";

                        const innerPath =
                          innerPoints
                            .map((p, i) =>
                              i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
                            )
                            .join(" ") + " Z";

                        return (
                          <SvgElement>
                            <g clipPath={`url(#${clipPathId})`}>
                              <path
                                d={`${outerPath} ${innerPath}`}
                                fill={color}
                                fillOpacity={0.2}
                                fillRule="evenodd"
                                stroke="none"
                              />
                            </g>
                          </SvgElement>
                        );
                      }}
                    </DataToHtml>
                  )}
                </>
              )}

            {/* Filled sector (only for non-full circles with valid sector points) */}
            {!isFullCircle && sectorPoints.length >= 3 && (
              <DataToHtml points={sectorPoints}>
                {(...htmlPoints) => (
                  <SvgElement>
                    <g clipPath={`url(#${clipPathId})`}>
                      <polygon
                        points={htmlPoints
                          .map((p) => `${p.x},${p.y}`)
                          .join(" ")}
                        fill={color}
                        fillOpacity={0.2}
                        stroke="none"
                      />
                    </g>
                  </SvgElement>
                )}
              </DataToHtml>
            )}

            {/* Outer arc stroke */}
            {outerArcPoints.length >= 2 && (
              <DataToHtml points={outerArcPoints}>
                {(...htmlPoints) => (
                  <SvgElement>
                    <g clipPath={`url(#${clipPathId})`}>
                      <polyline
                        points={htmlPoints
                          .map((p) => `${p.x},${p.y}`)
                          .join(" ")}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        strokeOpacity={0.75}
                      />
                    </g>
                  </SvgElement>
                )}
              </DataToHtml>
            )}

            {/* Inner arc stroke (only if inner radius > 0) */}
            {innerArcPoints.length >= 2 && (
              <DataToHtml points={innerArcPoints}>
                {(...htmlPoints) => (
                  <SvgElement>
                    <g clipPath={`url(#${clipPathId})`}>
                      <polyline
                        points={htmlPoints
                          .map((p) => `${p.x},${p.y}`)
                          .join(" ")}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        strokeOpacity={0.75}
                      />
                    </g>
                  </SvgElement>
                )}
              </DataToHtml>
            )}

            {/* Start radial line (only for non-full circles) */}
            {startRadialPoints && (
              <DataToHtml points={startRadialPoints}>
                {(start, end) => (
                  <SvgElement>
                    <g clipPath={`url(#${clipPathId})`}>
                      <line
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        stroke={color}
                        strokeWidth={2}
                        strokeOpacity={0.75}
                      />
                    </g>
                  </SvgElement>
                )}
              </DataToHtml>
            )}

            {/* End radial line (only for non-full circles) */}
            {endRadialPoints && (
              <DataToHtml points={endRadialPoints}>
                {(start, end) => (
                  <SvgElement>
                    <g clipPath={`url(#${clipPathId})`}>
                      <line
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        stroke={color}
                        strokeWidth={2}
                        strokeOpacity={0.75}
                      />
                    </g>
                  </SvgElement>
                )}
              </DataToHtml>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

// ============================================================================
// Mask Overlay Component
// ============================================================================

export interface MaskOverlayProps {
  /** Mask data as Uint8Array (0 = unmasked, 1 = masked) */
  maskData: Uint8Array;
  /** Shape of the mask as [height, width] */
  maskShape: [number, number];
  /** Width of the displayed image in pixels */
  imageWidth: number;
  /** Height of the displayed image in pixels */
  imageHeight: number;
}

/**
 * Rectangle representing a run of masked pixels in a row.
 */
interface MaskRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Build mask rectangles using run-length encoding to minimize SVG elements.
 * Groups adjacent masked pixels into horizontal rectangles.
 */
function buildMaskRectangles(
  maskData: Uint8Array,
  maskShape: [number, number],
  imageWidth: number,
  imageHeight: number
): MaskRectangle[] {
  const [maskHeight, maskWidth] = maskShape;
  const rectangles: MaskRectangle[] = [];

  // Calculate scale factors if mask doesn't match image dimensions
  const scaleX = imageWidth / maskWidth;
  const scaleY = imageHeight / maskHeight;

  for (let row = 0; row < maskHeight; row++) {
    let runStart: number | null = null;

    for (let col = 0; col <= maskWidth; col++) {
      const idx = row * maskWidth + col;
      const isMasked = col < maskWidth && maskData[idx] === 1;

      if (isMasked && runStart === null) {
        // Start of a new run
        runStart = col;
      } else if (!isMasked && runStart !== null) {
        // End of a run - create rectangle
        rectangles.push({
          x: runStart * scaleX,
          y: row * scaleY,
          width: (col - runStart) * scaleX,
          height: scaleY
        });
        runStart = null;
      }
    }
  }

  return rectangles;
}

/**
 * SVG-based mask overlay for H5Web visualization.
 *
 * Renders semi-transparent magenta rectangles over masked pixels.
 * Uses run-length encoding to minimize the number of SVG elements.
 */
export const MaskOverlay: React.FC<MaskOverlayProps> = ({
  maskData,
  maskShape,
  imageWidth,
  imageHeight
}) => {
  // Memoize rectangle computation
  const rectangles = useMemo(() => {
    return buildMaskRectangles(maskData, maskShape, imageWidth, imageHeight);
  }, [maskData, maskShape, imageWidth, imageHeight]);

  // Image corner points for clipping
  const clipId = useId();
  const clipPathId = `mask-clip-${clipId}`;
  const clipCorners = useMemo(
    () => [
      new Vector3(0, 0),
      new Vector3(imageWidth, 0),
      new Vector3(imageWidth, imageHeight),
      new Vector3(0, imageHeight)
    ],
    [imageWidth, imageHeight]
  );

  if (rectangles.length === 0) {
    return null;
  }

  // Group rectangles into batches to avoid too many DataToHtml calls
  // Each batch renders multiple rectangles
  const BATCH_SIZE = 500;
  const batches: MaskRectangle[][] = [];
  for (let i = 0; i < rectangles.length; i += BATCH_SIZE) {
    batches.push(rectangles.slice(i, i + BATCH_SIZE));
  }

  return (
    <>
      {/* Define clipPath for constraining overlay to image bounds */}
      <DataToHtml points={clipCorners}>
        {(topLeft, topRight, bottomRight, bottomLeft) => (
          <SvgElement>
            <defs>
              <clipPath id={clipPathId}>
                <polygon
                  points={`${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}`}
                />
              </clipPath>
            </defs>
          </SvgElement>
        )}
      </DataToHtml>

      {/* Render rectangles in batches */}
      {batches.map((batch, batchIndex) => {
        // Create points array for all corners of all rectangles in batch
        const points: Vector3[] = [];
        for (const rect of batch) {
          points.push(new Vector3(rect.x, rect.y)); // top-left
          points.push(new Vector3(rect.x + rect.width, rect.y + rect.height)); // bottom-right
        }

        return (
          <DataToHtml key={batchIndex} points={points}>
            {(...htmlPoints) => (
              <SvgElement>
                <g clipPath={`url(#${clipPathId})`}>
                  {batch.map((_rect, rectIndex) => {
                    const topLeft = htmlPoints[rectIndex * 2];
                    const bottomRight = htmlPoints[rectIndex * 2 + 1];
                    return (
                      <rect
                        key={rectIndex}
                        x={topLeft.x}
                        y={topLeft.y}
                        width={bottomRight.x - topLeft.x}
                        height={bottomRight.y - topLeft.y}
                        fill="#FF00FF"
                        fillOpacity={0.75}
                      />
                    );
                  })}
                </g>
              </SvgElement>
            )}
          </DataToHtml>
        );
      })}
    </>
  );
};

// ============================================================================
// Linecut Overlay Component
// ============================================================================

/**
 * SVG-based linecut overlay for H5Web visualization.
 * Renders horizontal/vertical linecut bands and center lines.
 */
export const LinecutOverlay: React.FC<LinecutOverlayProps> = ({
  linecuts,
  rows,
  cols
}) => {
  const visibleLinecuts = linecuts.filter((lc) => !lc.hidden);

  if (visibleLinecuts.length === 0) return null;

  return (
    <>
      {visibleLinecuts.map((linecut, index) => {
        const { position, width, color, type } = linecut;
        const halfWidth = width / 2;
        // Center of pixel N is at N + 0.5 in data coordinates
        const centerPosition = position + 0.5;

        if (type === "horizontal") {
          // Horizontal linecut: band spans full width, centered at pixel position
          // Band edges align with pixel edges:
          // (position - halfWidth to position + halfWidth + 1)
          const yTop = Math.max(0, centerPosition - halfWidth);
          const yBottom = Math.min(rows, centerPosition + halfWidth);

          return (
            <DataToHtml
              key={`h-linecut-${index}`}
              points={[
                new Vector3(0, yTop),
                new Vector3(cols, yTop),
                new Vector3(cols, yBottom),
                new Vector3(0, yBottom),
                new Vector3(0, centerPosition),
                new Vector3(cols, centerPosition)
              ]}
            >
              {(p0, p1, p2, p3, lineStart, lineEnd) => (
                <SvgElement>
                  {/* Width band with transparency */}
                  {width > 0 && (
                    <polygon
                      points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
                      fill={color}
                      fillOpacity={0.3}
                      stroke="none"
                    />
                  )}
                  {/* Center line */}
                  <line
                    x1={lineStart.x}
                    y1={lineStart.y}
                    x2={lineEnd.x}
                    y2={lineEnd.y}
                    stroke={color}
                    strokeWidth={1}
                    strokeOpacity={0.75}
                  />
                </SvgElement>
              )}
            </DataToHtml>
          );
        } else {
          // Vertical linecut: band spans full height, centered at pixel position
          // Band edges align with pixel edges
          const xLeft = Math.max(0, centerPosition - halfWidth);
          const xRight = Math.min(cols, centerPosition + halfWidth);

          return (
            <DataToHtml
              key={`v-linecut-${index}`}
              points={[
                new Vector3(xLeft, 0),
                new Vector3(xRight, 0),
                new Vector3(xRight, rows),
                new Vector3(xLeft, rows),
                new Vector3(centerPosition, 0),
                new Vector3(centerPosition, rows)
              ]}
            >
              {(p0, p1, p2, p3, lineStart, lineEnd) => (
                <SvgElement>
                  {/* Width band with transparency */}
                  {width > 0 && (
                    <polygon
                      points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
                      fill={color}
                      fillOpacity={0.3}
                      stroke="none"
                    />
                  )}
                  {/* Center line */}
                  <line
                    x1={lineStart.x}
                    y1={lineStart.y}
                    x2={lineEnd.x}
                    y2={lineEnd.y}
                    stroke={color}
                    strokeWidth={1}
                    strokeOpacity={0.75}
                  />
                </SvgElement>
              )}
            </DataToHtml>
          );
        }
      })}
    </>
  );
};

// ============================================================================
// Inclined Linecut Overlay Component
// ============================================================================

/**
 * Sutherland-Hodgman polygon clipping to image boundaries.
 */
const clipPolygonToImageBoundaries = (
  points: Array<{ x: number; y: number }>,
  imageWidth: number,
  imageHeight: number
): Array<{ x: number; y: number }> => {
  if (points.length < 3) return points;

  const isInside = (
    p: { x: number; y: number },
    edge: { x1: number; y1: number; x2: number; y2: number }
  ) => {
    const dx = edge.x2 - edge.x1;
    const dy = edge.y2 - edge.y1;
    const cross = (p.x - edge.x1) * dy - (p.y - edge.y1) * dx;
    return cross <= 0;
  };

  const getIntersection = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    edge: { x1: number; y1: number; x2: number; y2: number }
  ) => {
    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;
    const dx2 = edge.x2 - edge.x1;
    const dy2 = edge.y2 - edge.y1;
    const det = dx1 * dy2 - dy1 * dx2;
    if (det === 0) return { x: edge.x1, y: edge.y1 };
    const t = ((edge.x1 - p1.x) * dy2 - (edge.y1 - p1.y) * dx2) / det;
    return { x: p1.x + t * dx1, y: p1.y + t * dy1 };
  };

  const edges = [
    { x1: 0, y1: 0, x2: imageWidth, y2: 0 },
    { x1: imageWidth, y1: 0, x2: imageWidth, y2: imageHeight },
    { x1: imageWidth, y1: imageHeight, x2: 0, y2: imageHeight },
    { x1: 0, y1: imageHeight, x2: 0, y2: 0 }
  ];

  let clipped = [...points, points[0]]; // Close polygon

  for (const edge of edges) {
    const input = clipped;
    clipped = [];

    for (let i = 0; i < input.length - 1; i++) {
      const current = input[i];
      const next = input[i + 1];
      const currentInside = isInside(current, edge);
      const nextInside = isInside(next, edge);

      if (currentInside && nextInside) {
        clipped.push(next);
      } else if (currentInside && !nextInside) {
        clipped.push(getIntersection(current, next, edge));
      } else if (!currentInside && nextInside) {
        clipped.push(getIntersection(current, next, edge));
        clipped.push(next);
      }
    }

    if (clipped.length > 0) {
      clipped.push(clipped[0]); // Close polygon
    }
    if (clipped.length < 3) return [];
  }

  return clipped.slice(0, -1); // Remove closing point
};

/**
 * SVG-based inclined linecut overlay for H5Web visualization.
 * Renders inclined linecut bands with beam center marker.
 */
export const InclinedLinecutOverlay: React.FC<InclinedLinecutOverlayProps> = ({
  linecuts,
  rows,
  cols,
  beamCenterX,
  beamCenterY,
  pixelWidthCalculator
}) => {
  const visibleLinecuts = linecuts.filter((lc) => !lc.hidden);

  if (visibleLinecuts.length === 0) return null;

  return (
    <>
      {visibleLinecuts.map((linecut, index) => {
        const { angle, qWidth, qXPosition, qYPosition, color } = linecut;

        // Calculate endpoints
        const endpoints = calculateInclinedLineEndpoints({
          linecut: { angle } as InclinedLinecut,
          imageWidth: cols,
          imageHeight: rows,
          beam_center_x: beamCenterX,
          beam_center_y: beamCenterY
        });

        if (!endpoints) return null;
        const { x0, y0, x1, y1 } = endpoints;

        // Calculate perpendicular vector for width envelope
        const radians = (angle * Math.PI) / 180;
        const dx = Math.cos(radians);
        const dy = -Math.sin(radians);
        const perpDx = -dy;
        const perpDy = dx;

        // Calculate pixel width from q-space width (position and angle aware)
        const pixelWidth = pixelWidthCalculator(
          qXPosition,
          qYPosition,
          angle,
          qWidth
        );
        const halfWidthPixels = pixelWidth / 2;

        // Calculate envelope corners and clip to image boundaries
        const rawEnvelope = [
          {
            x: x0 + perpDx * halfWidthPixels,
            y: y0 + perpDy * halfWidthPixels
          },
          {
            x: x1 + perpDx * halfWidthPixels,
            y: y1 + perpDy * halfWidthPixels
          },
          {
            x: x1 - perpDx * halfWidthPixels,
            y: y1 - perpDy * halfWidthPixels
          },
          { x: x0 - perpDx * halfWidthPixels, y: y0 - perpDy * halfWidthPixels }
        ];

        const clippedEnvelope = clipPolygonToImageBoundaries(
          rawEnvelope,
          cols,
          rows
        );

        // Beam center position
        const beamX = beamCenterX;
        const beamY = beamCenterY;

        // Build points array for DataToHtml
        const dataPoints = [
          new Vector3(x0, y0),
          new Vector3(x1, y1),
          new Vector3(beamX, beamY),
          ...clippedEnvelope.map((p) => new Vector3(p.x, p.y))
        ];

        return (
          <DataToHtml key={`inclined-linecut-${index}`} points={dataPoints}>
            {(...htmlPoints) => {
              const [lineStart, lineEnd, center, ...envPoints] = htmlPoints;
              return (
                <SvgElement>
                  {/* Clipped width envelope */}
                  {qWidth > 0 && envPoints.length >= 3 && (
                    <polygon
                      points={envPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill={color}
                      fillOpacity={0.3}
                      stroke="none"
                    />
                  )}
                  {/* Central line */}
                  <line
                    x1={lineStart.x}
                    y1={lineStart.y}
                    x2={lineEnd.x}
                    y2={lineEnd.y}
                    stroke={color}
                    strokeWidth={2}
                    strokeOpacity={0.75}
                  />
                  {/* Beam center marker */}
                  <circle
                    cx={center.x}
                    cy={center.y}
                    r={5}
                    fill={color}
                    fillOpacity={0.75}
                  />
                </SvgElement>
              );
            }}
          </DataToHtml>
        );
      })}
    </>
  );
};

// ============================================================================
// Beam Center Overlay Component
// ============================================================================

export interface BeamCenterOverlayProps {
  beamCenterX: number;
  beamCenterY: number;
}

/*
 * BeamCenterOverlay - Renders a crosshair marker at the beam center position.
 */
export const BeamCenterOverlay: React.FC<BeamCenterOverlayProps> = ({
  beamCenterX,
  beamCenterY
}) => {
  // Beam center position in pixel/data coordinates
  const beamPosition = useMemo(
    () => ({ x: beamCenterX, y: beamCenterY }),
    [beamCenterX, beamCenterY]
  );

  // Crosshair size (in screen pixels)
  const crosshairSize = 10;
  const crosshairThickness = 1;

  return (
    <DataToHtml points={[new Vector3(beamPosition.x, beamPosition.y)]}>
      {(centerHtml) => (
        <SvgElement>
          {/* Outer circle */}
          <circle
            cx={centerHtml.x}
            cy={centerHtml.y}
            r={crosshairSize}
            fill="none"
            stroke="magenta"
            strokeWidth={crosshairThickness}
            strokeOpacity={0.9}
          />
          {/* Horizontal line */}
          <line
            x1={centerHtml.x - crosshairSize - 5}
            y1={centerHtml.y}
            x2={centerHtml.x + crosshairSize + 5}
            y2={centerHtml.y}
            stroke="magenta"
            strokeWidth={crosshairThickness}
            strokeOpacity={0.9}
          />
          {/* Vertical line */}
          <line
            x1={centerHtml.x}
            y1={centerHtml.y - crosshairSize - 5}
            x2={centerHtml.x}
            y2={centerHtml.y + crosshairSize + 5}
            stroke="magenta"
            strokeWidth={crosshairThickness}
            strokeOpacity={0.9}
          />
          {/* Center dot */}
          <circle
            cx={centerHtml.x}
            cy={centerHtml.y}
            r={3}
            fill="magenta"
            fillOpacity={0.9}
          />
        </SvgElement>
      )}
    </DataToHtml>
  );
};
