/**
 * This module handles the generation of visual overlays for azimuthal integration analysis.
 * It creates visual representations of Q-value circles and azimuthal angle ranges.
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
 * Defines the structure for circular point visualization.
 * Used to create scatter plots showing Q-value circles.
 */
interface PointTrace {
    type: 'scatter';                     // Plotly scatter plot type
    x: number[];                         // X-coordinates of points
    y: number[];                         // Y-coordinates of points
    mode: 'markers';                     // Display as markers/points
    marker: {
        color: string;                   // Color of the markers
        size: number;                    // Size of the markers
    };
    opacity: number;                     // Transparency of the markers
    xaxis: string;                       // Which x-axis to use
    yaxis: string;                       // Which y-axis to use
    showlegend: boolean;                 // Whether to show in legend
}

/**
 * Defines the structure for vector-based markers.
 * Used to show directional markers for azimuthal angles.
 */
interface VectorMarkerTrace extends Omit<PointTrace, 'marker'> {
    marker: {
        color: string;
        size: number;
        symbol: string;                  // Shape of the marker
        angle: number;                   // Rotation angle of the marker
    };
}

// Union type for all possible trace types
type PlotTrace = PointTrace | VectorMarkerTrace;

/**
 * Calculates the intersection point between a circle and a line at a given angle.
 * This function uses parametric circle equations to find points in a 2D detector space.
 *
 * Mathematical background:
 * - Uses parametric form of a circle: x = h + r*cos(θ), y = k + r*sin(θ)
 * - Converts between screen coordinates (origin at top-left) and mathematical coordinates
 * - Handles two coordinate systems:
 *   1. Screen coords: (0,0) at top-left, y increases downward
 *   2. Math coords: origin at beam center, y increases upward
 *
 * The function applies these transformations:
 * 1. Converts input angle from degrees to radians
 * 2. Uses negative angle in cos() to make angles go clockwise
 * 3. Negates sin() term to flip y-coordinate for screen space
 * 4. Translates coordinates relative to beam center
 *
 * In X-ray diffraction context:
 * - Beam center = point where X-ray beam hits detector
 * - Radius = corresponds to specific Q-value (momentum transfer)
 * - Angle = azimuthal angle around beam center
 *
 * @param angle - Azimuthal angle in degrees (clockwise from top)
 * @param radius - Distance from beam center in detector pixels
 * @param beamCenter - Coordinates of the beam center in detector space
 * @returns Point of intersection in detector coordinates
 */
function findIntersectionPoint(angle: number, radius: number, beamCenter: {x: number, y: number}): {x: number, y: number} {
    // Convert angle to radians for Math functions
    const radians = (angle * Math.PI) / 180;
    // Calculate intersection using parametric circle equations
    return {
        x: beamCenter.x + radius * Math.cos(-radians),
        y: beamCenter.y - radius * Math.sin(-radians)  // Negative sine for screen coordinates
    };
}

/**
 * Calculates the distance between a point and the beam center.
 * Used to determine radii for Q-value circles.
 */
function calculateRadius(point: {x: number, y: number}, beamCenter: {x: number, y: number}): number {
    const dx = point.x - beamCenter.x;
    const dy = point.y - beamCenter.y;
    return Math.sqrt(dx * dx + dy * dy);  // Pythagorean theorem
}

/**
 * Searches a 2D array for values matching a condition.
 * Returns arrays of matching x and y indices.
 * Used to find points that match specific Q-values.
 */
function findWhere(array2D: number[][], condition: (val: number) => boolean): [number[], number[]] {
    const xIndices = [];
    const yIndices = [];

    // Iterate through the 2D array
    for (let i = 0; i < array2D.length; i++) {
        for (let j = 0; j < array2D[i].length; j++) {
            if (condition(array2D[i][j])) {
                yIndices.push(i);
                xIndices.push(j);
            }
        }
    }

    return [yIndices, xIndices];
}

/**
 * Creates an array of evenly spaced numbers.
 * Used to generate points along azimuthal lines.
 */
function generatePoints(start: number, end: number, count: number): number[] {
    const points = [];
    const step = (end - start) / (count - 1);
    for (let i = 0; i < count; i++) {
        points.push(start + step * i);
    }
    return points;
}

/**
 * Main function that generates the visual overlay for azimuthal integration.
 * Creates a series of traces that can be plotted to show:
 * 1. Inner and outer Q-value circles
 * 2. Azimuthal angle range indicators
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
    if (!currentArray.length || !azimuthalData) return [];



    // Set up Q-value parameters for finding circle points
    const qArray = azimuthalData.qArray;
    const tolerance = 0.1;  // Tolerance for Q-value matching
    const innerQ = integration.qRange ? integration.qRange[0] : 0;
    const outerQ = integration.qRange ? integration.qRange[1] : maxQValue;

    // Find points that match inner and outer Q-values
    const [innerY, innerX] = findWhere(qArray, val => Math.abs(val - innerQ) < tolerance);
    const [outerY, outerX] = findWhere(qArray, val => Math.abs(val - outerQ) < tolerance);

    // Calculate the actual radii from the beam center
    // Using non-null beam center coordinates with defaults
    const beamCenter = {
        x: beamCenterX ?? 0,  // Use nullish coalescing to provide fallback
        y: beamCenterY ?? 0
    };
    let innerRadius = Infinity;
    let outerRadius = 0;

    // Find minimum radius for inner circle
    for (let i = 0; i < innerX.length; i++) {
        const radius = calculateRadius({x: innerX[i], y: innerY[i]}, beamCenter);
        innerRadius = Math.min(innerRadius, radius);
    }

    // Find maximum radius for outer circle
    for (let i = 0; i < outerX.length; i++) {
        const radius = calculateRadius({x: outerX[i], y: outerY[i]}, beamCenter);
        outerRadius = Math.max(outerRadius, radius);
    }

    // Get angular range and determine if it's a full circle
    const [startAngle, endAngle] = integration.azimuthRange;
    const isFullCircle = Math.abs(endAngle - startAngle) >= 360;
    const color = axisNumber === 1 ? integration.leftColor : integration.rightColor;

    // Create base traces for Q-value circles
    const traces: PlotTrace[] = [
        // Inner circle points trace
        {
            type: 'scatter',
            x: innerX.map(x => x / factor),  // Scale coordinates by factor
            y: innerY.map(y => y / factor),
            mode: 'markers',
            marker: { color, size: 2 },
            opacity: 0.75,
            xaxis: `x${axisNumber}`,
            yaxis: `y${axisNumber}`,
            showlegend: false,
        },
        // Outer circle points trace
        {
            type: 'scatter',
            x: outerX.map(x => x / factor),
            y: outerY.map(y => y / factor),
            mode: 'markers',
            marker: { color, size: 2 },
            opacity: 0.75,
            xaxis: `x${axisNumber}`,
            yaxis: `y${axisNumber}`,
            showlegend: false,
        }
    ];

    // Add azimuthal lines if not a full circle
    if (!isFullCircle) {
        const numPoints = 100;  // Number of points along each azimuthal line

        // Generate evenly spaced radii
        const radii = generatePoints(innerRadius, outerRadius, numPoints);

        // Calculate points for start angle line
        const startPoints = radii.map(radius => {
            const point = findIntersectionPoint(startAngle, radius, beamCenter);
            // Ensure points are within array bounds
            return {
                x: point.x / factor < 0 ? NaN :
                   point.x / factor > currentArray[0].length ? NaN :
                   point.x / factor,
                y: point.y / factor < 0 ? NaN :
                   point.y / factor > currentArray.length ? NaN :
                   point.y / factor
            };
        });

        // Calculate points for end angle line
        const endPoints = radii.map(radius => {
            const point = findIntersectionPoint(endAngle, radius, beamCenter);
            // Ensure points are within array bounds
            return {
                x: point.x / factor < 0 ? NaN :
                   point.x / factor > currentArray[0].length ? NaN :
                   point.x / factor,
                y: point.y / factor < 0 ? NaN :
                   point.y / factor > currentArray.length ? NaN :
                   point.y / factor
            };
        });

        // Create traces for start and end angle lines
        const startLineMarkers: VectorMarkerTrace = {
            type: 'scatter',
            x: startPoints.map(p => p.x),
            y: startPoints.map(p => p.y),
            mode: 'markers',
            marker: {
                color,
                size: 4,
                symbol: 'circle',
                angle: startAngle
            },
            opacity: 0.75,
            xaxis: `x${axisNumber}`,
            yaxis: `y${axisNumber}`,
            showlegend: false
        };

        const endLineMarkers: VectorMarkerTrace = {
            type: 'scatter',
            x: endPoints.map(p => p.x),
            y: endPoints.map(p => p.y),
            mode: 'markers',
            marker: {
                color,
                size: 4,
                symbol: 'circle',
                angle: endAngle
            },
            opacity: 0.75,
            xaxis: `x${axisNumber}`,
            yaxis: `y${axisNumber}`,
            showlegend: false
        };

        // Add azimuthal line markers to traces
        traces.push(startLineMarkers, endLineMarkers);
    }

    return traces;
}
