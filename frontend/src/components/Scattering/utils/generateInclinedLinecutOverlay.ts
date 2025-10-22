// import { InclinedLinecut } from "../types";
// import { calculateInclinedLineEndpoints } from "./calculateInclinedLinecutEndpoints";

// interface GenerateInclinedLinecutParams {
//     linecut: InclinedLinecut;
//     currentArray: number[][];
//     factor: number | null;
//     imageWidth: number;
//     imageHeight: number;
//     beam_center_x: number;
//     beam_center_y: number;
//     qXVector?: number[];
//     qYVector?: number[];
//   }


//   export function generateInclinedLinecutOverlay({
//     linecut,
//     currentArray,
//     factor,
//     imageWidth,
//     imageHeight,
//     beam_center_x,
//     beam_center_y,
//     qXVector,
//     qYVector
//   }: GenerateInclinedLinecutParams) {
//     if (!currentArray.length || factor === null) return [];

//     // Get the central line endpoints
//     const endpoints = calculateInclinedLineEndpoints({
//       linecut,
//       imageWidth,
//       imageHeight,
//       beam_center_x,
//       beam_center_y,
//       factor,
//     });

//     if (!endpoints) return [];
//     const { x0, y0, x1, y1 } = endpoints;

//     // Calculate perpendicular vector for the width envelope
//     const radians = (linecut.angle * Math.PI) / 180;
//     const dx = Math.cos(radians);
//     const dy = -Math.sin(radians);

//     // Calculate perpendicular unit vector
//     const perpDx = -dy;
//     const perpDy = dx;


//     // Calculate width in pixel space based on q-space width
//     let halfWidthPixels = 0;

//     if (linecut.qWidth > 0 && qXVector && qYVector && qXVector.length > 0 && qYVector.length > 0) {
//       // Calculate the center point in scaled coordinates
//       const centerX = (x0 + x1) / 2;
//       const centerY = (y0 + y1) / 2;

//       // Convert center to original (unscaled) coordinates
//       const originalCenterX = centerX * factor;
//       const originalCenterY = centerY * factor;

//       // Bounds checking for the q-vectors
//       const boundedCenterX = Math.min(Math.max(0, Math.round(originalCenterX)), qXVector.length - 1);
//       const boundedCenterY = Math.min(Math.max(0, Math.round(originalCenterY)), qYVector.length - 1);

//       // Get the q-value at the center
//       const centerQx = qXVector[boundedCenterX];
//       const centerQy = qYVector[boundedCenterY];

//       // Calculate points at distance qWidth/2 in q-space along the perpendicular vector
//       // First find unit vector in q-space (perpendicular to the linecut)
//       const qUnitPerpX = perpDx;
//       const qUnitPerpY = perpDy;

//       // Calculate point at half-width distance in q-space
//       const halfWidth = linecut.qWidth / 2;
//       const qPoint1x = centerQx + qUnitPerpX * halfWidth;
//       const qPoint1y = centerQy + qUnitPerpY * halfWidth;

//       // Now find the pixel position for this q-point
//       let minDistancePoint1 = Infinity;
//       let pixel1X = boundedCenterX;
//       let pixel1Y = boundedCenterY;

//       // Dynamically calculate search radius based on q-width value
//       // For larger q-widths, we need a larger search area
//       const searchRadius = Math.ceil(imageWidth * Math.max(0.25, linecut.qWidth / 10));

//       // Ensure search radius is at least 25% of image width but scales with larger q-width values

//       for (let y = Math.max(0, boundedCenterY - searchRadius); y < Math.min(qYVector.length, boundedCenterY + searchRadius); y++) {
//         for (let x = Math.max(0, boundedCenterX - searchRadius); x < Math.min(qXVector.length, boundedCenterX + searchRadius); x++) {
//           const qx = qXVector[x];
//           const qy = qYVector[y];

//           // Calculate distance in q-space
//           const distSq = Math.pow(qx - qPoint1x, 2) + Math.pow(qy - qPoint1y, 2);

//           if (distSq < minDistancePoint1) {
//             minDistancePoint1 = distSq;
//             pixel1X = x;
//             pixel1Y = y;
//           }
//         }
//       }

//       // Calculate pixel distance between center and half-width point
//       const pixelDistanceHalfWidth = Math.sqrt(
//         Math.pow(pixel1X - boundedCenterX, 2) +
//         Math.pow(pixel1Y - boundedCenterY, 2)
//       );

//       // Scale the pixel distance by the downsampling factor
//       halfWidthPixels = pixelDistanceHalfWidth / factor;
//     }

//     // Calculate raw envelope points (before boundary checking)
//     const rawEnvelopePoints = {
//       x: [
//         x0 + perpDx * halfWidthPixels,
//         x1 + perpDx * halfWidthPixels,
//         x1 - perpDx * halfWidthPixels,
//         x0 - perpDx * halfWidthPixels,
//         x0 + perpDx * halfWidthPixels // Close the path
//       ],
//       y: [
//         y0 + perpDy * halfWidthPixels,
//         y1 + perpDy * halfWidthPixels,
//         y1 - perpDy * halfWidthPixels,
//         y0 - perpDy * halfWidthPixels,
//         y0 + perpDy * halfWidthPixels // Close the path
//       ]
//     };

//     // Clip envelope points to image boundaries
//     const clippedEnvelopePoints = clipPolygonToImageBoundaries(
//       rawEnvelopePoints.x,
//       rawEnvelopePoints.y,
//       imageWidth,
//       imageHeight
//     );

//     // Create overlays for both axes
//     const createOverlaysForAxis = (color: string, axisNumber: number) => [
//       // Width envelope (using clipped points)
//       {
//         x: clippedEnvelopePoints.x,
//         y: clippedEnvelopePoints.y,
//         mode: 'lines',
//         fill: 'toself',
//         fillcolor: color,
//         line: { color },
//         opacity: linecut.qWidth > 0 ? 0.3 : 0, // Hide fill for zero width
//         xaxis: `x${axisNumber}`,
//         yaxis: `y${axisNumber}`,
//         showlegend: false,
//         hoverinfo: 'skip'
//       },
//       // Central line
//       {
//         x: [x0, x1],
//         y: [y0, y1],
//         mode: 'lines',
//         line: { color, width: 2 },
//         opacity: 0.75,
//         xaxis: `x${axisNumber}`,
//         yaxis: `y${axisNumber}`,
//         showlegend: false,
//         hoverinfo: 'skip'
//       },
//       // Center point
//       {
//         x: [beam_center_x / factor],
//         y: [beam_center_y / factor],
//         mode: 'markers',
//         marker: {
//           color: color,
//           size: 10,
//           symbol: 'circle',
//         },
//         opacity: 0.75,
//         xaxis: `x${axisNumber}`,
//         yaxis: `y${axisNumber}`,
//         showlegend: false,
//         hoverinfo: 'skip'
//       },
//     ];

//     return [
//       ...createOverlaysForAxis(linecut.leftColor, 1),
//       ...createOverlaysForAxis(linecut.rightColor, 2)
//     ];
//   }

//   /**
//    * Clips a polygon to the image boundaries.
//    * This ensures the linecut envelope doesn't extend outside the image area.
//    *
//    * @param xPoints - Array of x-coordinates of the polygon vertices
//    * @param yPoints - Array of y-coordinates of the polygon vertices
//    * @param imageWidth - Width of the image
//    * @param imageHeight - Height of the image
//    * @returns Object with clipped x and y coordinates
//    */
//   function clipPolygonToImageBoundaries(
//     xPoints: number[],
//     yPoints: number[],
//     imageWidth: number,
//     imageHeight: number
//   ) {
//     // We'll implement the Sutherland-Hodgman algorithm to clip the polygon
//     // First, we need to ensure the polygon is properly closed
//     if (xPoints.length !== yPoints.length) {
//       throw new Error('X and Y point arrays must have the same length');
//     }

//     // Make sure the polygon is closed (last point equals first point)
//     const n = xPoints.length;
//     if (n < 3) {
//       // Can't clip a polygon with fewer than 3 points
//       return { x: xPoints, y: yPoints };
//     }

//     if (xPoints[0] !== xPoints[n-1] || yPoints[0] !== yPoints[n-1]) {
//       xPoints = [...xPoints, xPoints[0]];
//       yPoints = [...yPoints, yPoints[0]];
//     }

//     // Convert to array of point objects for easier processing
//     let points = xPoints.map((x, i) => ({ x, y: yPoints[i] }));

//     // Define the image boundary edges (left, right, top, bottom)
//     const edges = [
//       { x1: 0, y1: 0, x2: imageWidth, y2: 0 },           // Top edge
//       { x1: imageWidth, y1: 0, x2: imageWidth, y2: imageHeight }, // Right edge
//       { x1: imageWidth, y1: imageHeight, x2: 0, y2: imageHeight }, // Bottom edge
//       { x1: 0, y1: imageHeight, x2: 0, y2: 0 }           // Left edge
//     ];

//     // Clip the polygon against each edge
//     for (const edge of edges) {
//       const inputPoints = [...points];
//       points = [];

//       // For each edge of the polygon
//       for (let i = 0; i < inputPoints.length - 1; i++) {
//         const current = inputPoints[i];
//         const next = inputPoints[i + 1];

//         // Determine if points are inside or outside the clip edge
//         const currentInside = isPointInsideEdge(current, edge);
//         const nextInside = isPointInsideEdge(next, edge);

//         // Case 1: Both points inside - add the second point
//         if (currentInside && nextInside) {
//           points.push(next);
//         }
//         // Case 2: First inside, second outside - add intersection
//         else if (currentInside && !nextInside) {
//           points.push(getIntersection(current, next, edge));
//         }
//         // Case 3: First outside, second inside - add intersection and second point
//         else if (!currentInside && nextInside) {
//           points.push(getIntersection(current, next, edge));
//           points.push(next);
//         }
//         // Case 4: Both outside - add nothing
//       }

//       // Close the polygon if we have points
//       if (points.length > 0) {
//         points.push(points[0]);
//       }

//       // If no points left after clipping, return empty polygon
//       if (points.length < 3) {
//         return { x: [], y: [] };
//       }
//     }

//     // Convert back to separate x and y arrays
//     return {
//       x: points.map(p => p.x),
//       y: points.map(p => p.y)
//     };
//   }

//   /**
//    * Checks if a point is inside (on the correct side of) a clip edge
//    */
//   function isPointInsideEdge(point: { x: number, y: number }, edge: { x1: number, y1: number, x2: number, y2: number }) {
//     // Check which side of the edge the point is on
//     // For top edge: y >= 0, right edge: x <= width, bottom edge: y <= height, left edge: x >= 0
//     const dx = edge.x2 - edge.x1;
//     const dy = edge.y2 - edge.y1;

//     // Calculate position relative to edge
//     // Using cross product to determine which side of the line the point is on
//     const crossProduct = (point.x - edge.x1) * dy - (point.y - edge.y1) * dx;

//     // For clockwise defined image boundaries, inside is negative cross product
//     return crossProduct <= 0;
//   }

//   /**
//    * Calculates the intersection of a polygon edge with a clip edge
//    */
//   function getIntersection(
//     p1: { x: number, y: number },
//     p2: { x: number, y: number },
//     edge: { x1: number, y1: number, x2: number, y2: number }
//   ) {
//     // Line 1: p1 to p2 (polygon edge)
//     const dx1 = p2.x - p1.x;
//     const dy1 = p2.y - p1.y;

//     // Line 2: edge.x1,edge.y1 to edge.x2,edge.y2 (clip edge)
//     const dx2 = edge.x2 - edge.x1;
//     const dy2 = edge.y2 - edge.y1;

//     // Calculate intersection parameter t
//     const det = dx1 * dy2 - dy1 * dx2;

//     if (det === 0) {
//       // Lines are parallel or coincident
//       // Return a point on the clip edge as a fallback
//       return { x: edge.x1, y: edge.y1 };
//     }

//     // Calculate intersection parameters
//     const t = ((edge.x1 - p1.x) * dy2 - (edge.y1 - p1.y) * dx2) / det;

//     // Calculate intersection point
//     return {
//       x: p1.x + t * dx1,
//       y: p1.y + t * dy1
//     };
//   }










import { InclinedLinecut } from "../types";
import { calculateInclinedLineEndpoints } from "./calculateInclinedLinecutEndpoints";

/**
 * Convert q-space coordinates to pixel coordinates
 */
function qToPixel(
  qX: number,
  qY: number,
  qXVector: number[],
  qYVector: number[]
): [number, number] {
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
}

/**
 * Calculates width in pixel space from q-space parameters for inclined linecuts
 */
function calculateInclinedQSpaceToPixelWidth(
  centerQx: number,
  centerQy: number,
  angle: number,
  qWidth: number,
  qXVector: number[],
  qYVector: number[]
): number {
  // If width is zero or vectors are empty, return 0
  if (qWidth <= 0 || !qXVector || !qYVector || qXVector.length === 0 || qYVector.length === 0) {
    return 0;
  }

  // Convert central position to image coordinates
  const [centerPixelX, centerPixelY] = qToPixel(centerQx, centerQy, qXVector, qYVector);

  // Calculate direction vectors based on angle
  const angleRad = (angle * Math.PI) / 180;
  const dirX = Math.cos(angleRad);
  const dirY = -Math.sin(angleRad); // Y-axis points downward in image coordinates

  // Perpendicular vector for width calculations
  const perpX = -dirY;
  const perpY = dirX;

  // Calculate point at half-width distance in q-space along the perpendicular vector
  const halfWidth = qWidth / 2;
  const qPoint1x = centerQx + perpX * halfWidth;
  const qPoint1y = centerQy + perpY * halfWidth;

  // Find pixel position for this q-space point
  const [pixel1X, pixel1Y] = qToPixel(qPoint1x, qPoint1y, qXVector, qYVector);

  // Calculate pixel distance between center and half-width point
  const pixelDistanceHalfWidth = Math.sqrt(
    Math.pow(pixel1X - centerPixelX, 2) +
    Math.pow(pixel1Y - centerPixelY, 2)
  );

  // Return the full width in pixels (twice the half-width)
  return pixelDistanceHalfWidth * 2;
}

interface GenerateInclinedLinecutParams {
  linecut: InclinedLinecut;
  currentArray: number[][];
  factor: number | null;
  imageWidth: number;
  imageHeight: number;
  beam_center_x: number;
  beam_center_y: number;
  qXVector?: number[];
  qYVector?: number[];
}

export function generateInclinedLinecutOverlay({
  linecut,
  currentArray,
  factor,
  imageWidth,
  imageHeight,
  beam_center_x,
  beam_center_y,
  qXVector = [],
  qYVector = []
}: GenerateInclinedLinecutParams) {
  if (!currentArray.length || factor === null) return [];

  // Get the central line endpoints
  const endpoints = calculateInclinedLineEndpoints({
    linecut,
    imageWidth,
    imageHeight,
    beam_center_x,
    beam_center_y,
    factor,
  });

  if (!endpoints) return [];
  const { x0, y0, x1, y1 } = endpoints;

  // Calculate perpendicular vector for the width envelope
  const radians = (linecut.angle * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = -Math.sin(radians);

  // Calculate perpendicular unit vector
  const perpDx = -dy;
  const perpDy = dx;

  // Calculate width in pixel space based on q-space width
  let halfWidthPixels = 0;

  if (linecut.qWidth > 0 && qXVector.length > 0 && qYVector.length > 0) {
    // Calculate the center point in scaled coordinates
    const centerX = (x0 + x1) / 2;
    const centerY = (y0 + y1) / 2;

    // Convert center to original (unscaled) coordinates
    const originalCenterX = centerX * factor;
    const originalCenterY = centerY * factor;

    // Bounds checking for the q-vectors
    const boundedCenterX = Math.min(Math.max(0, Math.round(originalCenterX)), qXVector.length - 1);
    const boundedCenterY = Math.min(Math.max(0, Math.round(originalCenterY)), qYVector.length - 1);

    // Get the q-value at the center
    const centerQx = qXVector[boundedCenterX];
    const centerQy = qYVector[boundedCenterY];

    // Use centralized function to calculate pixel width
    const pixelWidth = calculateInclinedQSpaceToPixelWidth(
      centerQx,
      centerQy,
      linecut.angle,
      linecut.qWidth,
      qXVector,
      qYVector
    );

    // Scale the pixel distance by the downsampling factor
    halfWidthPixels = (pixelWidth / 2) / factor;
  }

  // Calculate raw envelope points (before boundary checking)
  const rawEnvelopePoints = {
    x: [
      x0 + perpDx * halfWidthPixels,
      x1 + perpDx * halfWidthPixels,
      x1 - perpDx * halfWidthPixels,
      x0 - perpDx * halfWidthPixels,
      x0 + perpDx * halfWidthPixels // Close the path
    ],
    y: [
      y0 + perpDy * halfWidthPixels,
      y1 + perpDy * halfWidthPixels,
      y1 - perpDy * halfWidthPixels,
      y0 - perpDy * halfWidthPixels,
      y0 + perpDy * halfWidthPixels // Close the path
    ]
  };

  // Clip envelope points to image boundaries
  const clippedEnvelopePoints = clipPolygonToImageBoundaries(
    rawEnvelopePoints.x,
    rawEnvelopePoints.y,
    imageWidth,
    imageHeight
  );

  // Create overlays for both axes
  const createOverlaysForAxis = (color: string, axisNumber: number) => [
    // Width envelope (using clipped points)
    {
      x: clippedEnvelopePoints.x,
      y: clippedEnvelopePoints.y,
      mode: 'lines',
      fill: 'toself',
      fillcolor: color,
      line: { color },
      opacity: linecut.qWidth > 0 ? 0.3 : 0, // Hide fill for zero width
      xaxis: `x${axisNumber}`,
      yaxis: `y${axisNumber}`,
      showlegend: false,
      hoverinfo: 'skip'
    },
    // Central line
    {
      x: [x0, x1],
      y: [y0, y1],
      mode: 'lines',
      line: { color, width: 2 },
      opacity: 0.75,
      xaxis: `x${axisNumber}`,
      yaxis: `y${axisNumber}`,
      showlegend: false,
      hoverinfo: 'skip'
    },
    // Center point
    {
      x: [beam_center_x / factor],
      y: [beam_center_y / factor],
      mode: 'markers',
      marker: {
        color: color,
        size: 10,
        symbol: 'circle',
      },
      opacity: 0.75,
      xaxis: `x${axisNumber}`,
      yaxis: `y${axisNumber}`,
      showlegend: false,
      hoverinfo: 'skip'
    },
  ];

  return [
    ...createOverlaysForAxis(linecut.leftColor, 1),
    ...createOverlaysForAxis(linecut.rightColor, 2)
  ];
}

/**
 * Clips a polygon to the image boundaries.
 * This ensures the linecut envelope doesn't extend outside the image area.
 *
 * @param xPoints - Array of x-coordinates of the polygon vertices
 * @param yPoints - Array of y-coordinates of the polygon vertices
 * @param imageWidth - Width of the image
 * @param imageHeight - Height of the image
 * @returns Object with clipped x and y coordinates
 */
function clipPolygonToImageBoundaries(
  xPoints: number[],
  yPoints: number[],
  imageWidth: number,
  imageHeight: number
) {
  // We'll implement the Sutherland-Hodgman algorithm to clip the polygon
  // First, we need to ensure the polygon is properly closed
  if (xPoints.length !== yPoints.length) {
    throw new Error('X and Y point arrays must have the same length');
  }

  // Make sure the polygon is closed (last point equals first point)
  const n = xPoints.length;
  if (n < 3) {
    // Can't clip a polygon with fewer than 3 points
    return { x: xPoints, y: yPoints };
  }

  if (xPoints[0] !== xPoints[n-1] || yPoints[0] !== yPoints[n-1]) {
    xPoints = [...xPoints, xPoints[0]];
    yPoints = [...yPoints, yPoints[0]];
  }

  // Convert to array of point objects for easier processing
  let points = xPoints.map((x, i) => ({ x, y: yPoints[i] }));

  // Define the image boundary edges (left, right, top, bottom)
  const edges = [
    { x1: 0, y1: 0, x2: imageWidth, y2: 0 },           // Top edge
    { x1: imageWidth, y1: 0, x2: imageWidth, y2: imageHeight }, // Right edge
    { x1: imageWidth, y1: imageHeight, x2: 0, y2: imageHeight }, // Bottom edge
    { x1: 0, y1: imageHeight, x2: 0, y2: 0 }           // Left edge
  ];

  // Clip the polygon against each edge
  for (const edge of edges) {
    const inputPoints = [...points];
    points = [];

    // For each edge of the polygon
    for (let i = 0; i < inputPoints.length - 1; i++) {
      const current = inputPoints[i];
      const next = inputPoints[i + 1];

      // Determine if points are inside or outside the clip edge
      const currentInside = isPointInsideEdge(current, edge);
      const nextInside = isPointInsideEdge(next, edge);

      // Case 1: Both points inside - add the second point
      if (currentInside && nextInside) {
        points.push(next);
      }
      // Case 2: First inside, second outside - add intersection
      else if (currentInside && !nextInside) {
        points.push(getIntersection(current, next, edge));
      }
      // Case 3: First outside, second inside - add intersection and second point
      else if (!currentInside && nextInside) {
        points.push(getIntersection(current, next, edge));
        points.push(next);
      }
      // Case 4: Both outside - add nothing
    }

    // Close the polygon if we have points
    if (points.length > 0) {
      points.push(points[0]);
    }

    // If no points left after clipping, return empty polygon
    if (points.length < 3) {
      return { x: [], y: [] };
    }
  }

  // Convert back to separate x and y arrays
  return {
    x: points.map(p => p.x),
    y: points.map(p => p.y)
  };
}

/**
 * Checks if a point is inside (on the correct side of) a clip edge
 */
function isPointInsideEdge(point: { x: number, y: number }, edge: { x1: number, y1: number, x2: number, y2: number }) {
  // Check which side of the edge the point is on
  // For top edge: y >= 0, right edge: x <= width, bottom edge: y <= height, left edge: x >= 0
  const dx = edge.x2 - edge.x1;
  const dy = edge.y2 - edge.y1;

  // Calculate position relative to edge
  // Using cross product to determine which side of the line the point is on
  const crossProduct = (point.x - edge.x1) * dy - (point.y - edge.y1) * dx;

  // For clockwise defined image boundaries, inside is negative cross product
  return crossProduct <= 0;
}

/**
 * Calculates the intersection of a polygon edge with a clip edge
 */
function getIntersection(
  p1: { x: number, y: number },
  p2: { x: number, y: number },
  edge: { x1: number, y1: number, x2: number, y2: number }
) {
  // Line 1: p1 to p2 (polygon edge)
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;

  // Line 2: edge.x1,edge.y1 to edge.x2,edge.y2 (clip edge)
  const dx2 = edge.x2 - edge.x1;
  const dy2 = edge.y2 - edge.y1;

  // Calculate intersection parameter t
  const det = dx1 * dy2 - dy1 * dx2;

  if (det === 0) {
    // Lines are parallel or coincident
    // Return a point on the clip edge as a fallback
    return { x: edge.x1, y: edge.y1 };
  }

  // Calculate intersection parameters
  const t = ((edge.x1 - p1.x) * dy2 - (edge.y1 - p1.y) * dx2) / det;

  // Calculate intersection point
  return {
    x: p1.x + t * dx1,
    y: p1.y + t * dy1
  };
}
