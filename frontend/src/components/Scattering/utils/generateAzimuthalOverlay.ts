/**
 * This module handles the generation of visual overlays for azimuthal integration analysis.
 * It creates visual representations of Q-value arcs and azimuthal angle ranges.
 */

import { AzimuthalIntegration, AzimuthalData } from '../types';

// Input parameters interface defines all required data for overlay generation
interface GenerateAzimuthalOverlayParams {
    integration: AzimuthalIntegration;   // Contains integration settings like Q-range and azimuth range
    azimuthalData: AzimuthalData;        // Contains the actual Q-value data
    axisNumber: number;                   // Determines which axis set to use (1 or 2)
    factor: number;                       // Scaling factor for coordinates
    currentArray: number[][];            // Current data array being processed
    maxQValue: number;                   // Maximum Q-value in the dataset
    beamCenterX?: number;                // X-coordinate of the beam center
    beamCenterY?: number;                // Y-coordinate of the beam center
}

/**
 * Defines the structure for line-based visualization.
 * Used to create smooth arcs and radial lines.
 */
interface LineTrace {
    type: 'scatter';
    x: number[];
    y: number[];
    mode: 'lines';
    line: {
        color: string;
        width: number;
    };
    opacity: number;
    xaxis: string;
    yaxis: string;
    showlegend: boolean;
    hoverinfo: string;
}

type PlotTrace = LineTrace;

/**
 * Calculates a point on a circle at a given angle.
 * Uses screen coordinates where y increases downward.
 *
 * @param angle - Azimuthal angle in degrees (clockwise from top, 0° = up)
 * @param radius - Distance from beam center in pixels
 * @param beamCenter - Coordinates of the beam center
 * @returns Point coordinates in screen space
 */
function getPointOnCircle(
    angle: number,
    radius: number,
    beamCenter: { x: number; y: number }
): { x: number; y: number } {
    const radians = (angle * Math.PI) / 180;
    return {
        x: beamCenter.x + radius * Math.cos(-radians),
        y: beamCenter.y - radius * Math.sin(-radians)
    };
}

/**
 * Estimates the pixel radius for a given Q-value by sampling the qArray.
 * This is much faster than searching the entire array.
 *
 * Strategy: Sample along radial lines from beam center and interpolate.
 *
 * @param targetQ - The Q-value to find the radius for
 * @param qArray - 2D array of Q-values
 * @param beamCenter - Beam center coordinates
 * @param imageWidth - Width of the image
 * @param imageHeight - Height of the image
 * @returns Estimated radius in pixels, or null if not found
 */
function estimateRadiusForQValue(
    targetQ: number,
    qArray: number[][],
    beamCenter: { x: number; y: number },
    imageWidth: number,
    imageHeight: number
): number | null {
    if (!qArray.length || !qArray[0]?.length) return null;

    // Sample along 8 radial directions (every 45 degrees)
    const sampleAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    const radiiFound: number[] = [];

    for (const angle of sampleAngles) {
        const radians = (angle * Math.PI) / 180;
        const dx = Math.cos(-radians);
        const dy = -Math.sin(-radians);

        // Calculate maximum radius we can sample in this direction
        const maxRadius = Math.max(imageWidth, imageHeight);

        // Sample along this radial line
        let prevQ = qArray[Math.round(beamCenter.y)]?.[Math.round(beamCenter.x)] ?? 0;
        let prevRadius = 0;

        for (let r = 1; r < maxRadius; r += 2) {
            const x = Math.round(beamCenter.x + r * dx);
            const y = Math.round(beamCenter.y + r * dy);

            // Check bounds
            if (x < 0 || x >= imageWidth || y < 0 || y >= imageHeight) break;

            const currentQ = qArray[y]?.[x];
            if (currentQ === undefined || isNaN(currentQ)) continue;

            // Check if we crossed the target Q value
            if ((prevQ <= targetQ && currentQ >= targetQ) ||
                (prevQ >= targetQ && currentQ <= targetQ)) {
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

/**
 * Generates points along an arc, clipped to image boundaries.
 *
 * @param radius - Radius of the arc
 * @param startAngle - Start angle in degrees
 * @param endAngle - End angle in degrees
 * @param beamCenter - Beam center coordinates
 * @param imageWidth - Image width for clipping
 * @param imageHeight - Image height for clipping
 * @param factor - Scaling factor
 * @param numPoints - Number of points to generate
 * @returns Arrays of x and y coordinates
 */
function generateArcPoints(
    radius: number,
    startAngle: number,
    endAngle: number,
    beamCenter: { x: number; y: number },
    imageWidth: number,
    imageHeight: number,
    factor: number,
    numPoints: number = 100
): { x: number[]; y: number[] } {
    const xPoints: number[] = [];
    const yPoints: number[] = [];

    // Handle angle wrapping (e.g., -180 to 180)
    let angleDiff = endAngle - startAngle;
    if (angleDiff < 0) angleDiff += 360;
    if (angleDiff > 360) angleDiff = 360;

    const angleStep = angleDiff / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
        const angle = startAngle + i * angleStep;
        const point = getPointOnCircle(angle, radius, beamCenter);

        // Scale and check bounds
        const scaledX = point.x / factor;
        const scaledY = point.y / factor;

        // Clip to image boundaries - use NaN for out-of-bounds to create gaps
        if (scaledX >= 0 && scaledX <= imageWidth / factor &&
            scaledY >= 0 && scaledY <= imageHeight / factor) {
            xPoints.push(scaledX);
            yPoints.push(scaledY);
        } else {
            // Add NaN to create a gap in the line
            xPoints.push(NaN);
            yPoints.push(NaN);
        }
    }

    return { x: xPoints, y: yPoints };
}

/**
 * Generates points along a radial line from inner to outer radius.
 *
 * @param angle - Angle of the radial line in degrees
 * @param innerRadius - Inner radius
 * @param outerRadius - Outer radius
 * @param beamCenter - Beam center coordinates
 * @param imageWidth - Image width for clipping
 * @param imageHeight - Image height for clipping
 * @param factor - Scaling factor
 * @returns Arrays of x and y coordinates
 */
function generateRadialLinePoints(
    angle: number,
    innerRadius: number,
    outerRadius: number,
    beamCenter: { x: number; y: number },
    imageWidth: number,
    imageHeight: number,
    factor: number
): { x: number[]; y: number[] } {
    const innerPoint = getPointOnCircle(angle, innerRadius, beamCenter);
    const outerPoint = getPointOnCircle(angle, outerRadius, beamCenter);

    // Scale points
    const x1 = innerPoint.x / factor;
    const y1 = innerPoint.y / factor;
    const x2 = outerPoint.x / factor;
    const y2 = outerPoint.y / factor;

    // Clip line to image boundaries
    const clipped = clipLineToRect(
        x1, y1, x2, y2,
        0, 0, imageWidth / factor, imageHeight / factor
    );

    if (!clipped) {
        return { x: [], y: [] };
    }

    return {
        x: [clipped.x1, clipped.x2],
        y: [clipped.y1, clipped.y2]
    };
}

/**
 * Clips a line segment to a rectangle using Cohen-Sutherland algorithm.
 */
function clipLineToRect(
    x1: number, y1: number, x2: number, y2: number,
    xmin: number, ymin: number, xmax: number, ymax: number
): { x1: number; y1: number; x2: number; y2: number } | null {
    const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;

    function computeCode(x: number, y: number): number {
        let code = INSIDE;
        if (x < xmin) code |= LEFT;
        else if (x > xmax) code |= RIGHT;
        if (y < ymin) code |= TOP;
        else if (y > ymax) code |= BOTTOM;
        return code;
    }

    let code1 = computeCode(x1, y1);
    let code2 = computeCode(x2, y2);

    while (true) {
        if (!(code1 | code2)) {
            // Both inside
            return { x1, y1, x2, y2 };
        }
        if (code1 & code2) {
            // Both outside same region
            return null;
        }

        const codeOut = code1 ? code1 : code2;
        let x = 0, y = 0;

        if (codeOut & BOTTOM) {
            x = x1 + (x2 - x1) * (ymax - y1) / (y2 - y1);
            y = ymax;
        } else if (codeOut & TOP) {
            x = x1 + (x2 - x1) * (ymin - y1) / (y2 - y1);
            y = ymin;
        } else if (codeOut & RIGHT) {
            y = y1 + (y2 - y1) * (xmax - x1) / (x2 - x1);
            x = xmax;
        } else if (codeOut & LEFT) {
            y = y1 + (y2 - y1) * (xmin - x1) / (x2 - x1);
            x = xmin;
        }

        if (codeOut === code1) {
            x1 = x;
            y1 = y;
            code1 = computeCode(x1, y1);
        } else {
            x2 = x;
            y2 = y;
            code2 = computeCode(x2, y2);
        }
    }
}

/**
 * Main function that generates the visual overlay for azimuthal integration.
 * Creates smooth arcs for Q-value boundaries and radial lines for azimuth limits.
 */
export function generateAzimuthalOverlay({
    integration,
    azimuthalData,
    axisNumber,
    factor,
    currentArray,
    maxQValue,
    beamCenterX = 0,
    beamCenterY = 0,
}: GenerateAzimuthalOverlayParams): PlotTrace[] {
    // Return empty array if no data is available
    if (!currentArray.length || !azimuthalData?.qArray) return [];

    const imageHeight = currentArray.length;
    const imageWidth = currentArray[0]?.length || 0;

    const beamCenter = {
        x: beamCenterX ?? 0,
        y: beamCenterY ?? 0
    };

    // Get Q-range
    const innerQ = integration.qRange ? integration.qRange[0] : 0;
    const outerQ = integration.qRange ? integration.qRange[1] : maxQValue;

    // Estimate radii for inner and outer Q-values (optimized - no full array scan)
    const innerRadius = estimateRadiusForQValue(
        innerQ, azimuthalData.qArray, beamCenter, imageWidth, imageHeight
    ) ?? 0;
    const outerRadius = estimateRadiusForQValue(
        outerQ, azimuthalData.qArray, beamCenter, imageWidth, imageHeight
    ) ?? Math.max(imageWidth, imageHeight);

    // Get angular range
    const [startAngle, endAngle] = integration.azimuthRange;
    const isFullCircle = Math.abs(endAngle - startAngle) >= 360;
    const color = axisNumber === 1 ? integration.leftColor : integration.rightColor;

    const traces: PlotTrace[] = [];

    // Number of points for smooth arcs (more points = smoother but more expensive)
    const arcPoints = isFullCircle ? 360 : Math.max(50, Math.abs(endAngle - startAngle));

    // Generate inner arc (only if innerRadius > 0)
    if (innerRadius > 0) {
        const innerArc = generateArcPoints(
            innerRadius,
            isFullCircle ? 0 : startAngle,
            isFullCircle ? 360 : endAngle,
            beamCenter,
            imageWidth,
            imageHeight,
            factor,
            arcPoints
        );

        if (innerArc.x.length > 0) {
            traces.push({
                type: 'scatter',
                x: innerArc.x,
                y: innerArc.y,
                mode: 'lines',
                line: { color, width: 2 },
                opacity: 0.75,
                xaxis: `x${axisNumber}`,
                yaxis: `y${axisNumber}`,
                showlegend: false,
                hoverinfo: 'skip'
            });
        }
    }

    // Generate outer arc
    if (outerRadius > 0) {
        const outerArc = generateArcPoints(
            outerRadius,
            isFullCircle ? 0 : startAngle,
            isFullCircle ? 360 : endAngle,
            beamCenter,
            imageWidth,
            imageHeight,
            factor,
            arcPoints
        );

        if (outerArc.x.length > 0) {
            traces.push({
                type: 'scatter',
                x: outerArc.x,
                y: outerArc.y,
                mode: 'lines',
                line: { color, width: 2 },
                opacity: 0.75,
                xaxis: `x${axisNumber}`,
                yaxis: `y${axisNumber}`,
                showlegend: false,
                hoverinfo: 'skip'
            });
        }
    }

    // Add radial lines if not a full circle
    if (!isFullCircle && innerRadius >= 0 && outerRadius > 0) {
        // Start angle radial line
        const startLine = generateRadialLinePoints(
            startAngle,
            innerRadius,
            outerRadius,
            beamCenter,
            imageWidth,
            imageHeight,
            factor
        );

        if (startLine.x.length > 0) {
            traces.push({
                type: 'scatter',
                x: startLine.x,
                y: startLine.y,
                mode: 'lines',
                line: { color, width: 2 },
                opacity: 0.75,
                xaxis: `x${axisNumber}`,
                yaxis: `y${axisNumber}`,
                showlegend: false,
                hoverinfo: 'skip'
            });
        }

        // End angle radial line
        const endLine = generateRadialLinePoints(
            endAngle,
            innerRadius,
            outerRadius,
            beamCenter,
            imageWidth,
            imageHeight,
            factor
        );

        if (endLine.x.length > 0) {
            traces.push({
                type: 'scatter',
                x: endLine.x,
                y: endLine.y,
                mode: 'lines',
                line: { color, width: 2 },
                opacity: 0.75,
                xaxis: `x${axisNumber}`,
                yaxis: `y${axisNumber}`,
                showlegend: false,
                hoverinfo: 'skip'
            });
        }
    }

    return traces;
}
