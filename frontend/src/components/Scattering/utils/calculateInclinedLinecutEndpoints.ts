import { InclinedLinecut } from "../types";

interface calculateInclinedLineEndpointsParams {
    linecut: InclinedLinecut;
    imageWidth: number;
    imageHeight: number;
    beam_center_x: number;
    beam_center_y: number;
    factor: number;
}

/**
 * Calculates the endpoints of an inclined linecut that intersects with image boundaries.
 * Uses parametric line equation P(t) = P0 + t*v, where:
 * - P0 is the center point (centerX, centerY)
 * - v is the direction vector (dx, dy)
 * - t is the parameter that gives points along the line
 *
 * The function finds where this line intersects with the image boundaries:
 * - Left boundary: x = 0
 * - Right boundary: x = imageWidth
 * - Top boundary: y = 0
 * - Bottom boundary: y = imageHeight
 */

/**
This is an implementation of the Line-Rectangle Intersection algorithm,
also known as the Parametric Line Clipping algorithm. It's a variant of the
algorithms used in computer graphics for line clipping, though in this case we're
using it to find intersection points rather than clip the line.
*/
export function calculateInclinedLineEndpoints({
    linecut,
    imageWidth,
    imageHeight,
    beam_center_x,
    beam_center_y,
    factor,
}: calculateInclinedLineEndpointsParams) {

    // Convert angle to radians and calculate direction vector components
    // dx = cos(θ) gives x-component of unit vector
    // dy = -sin(θ) gives y-component (negated because y-axis points down in Plotly's coordinates)
    const radians = (linecut.angle * Math.PI) / 180;
    const dx = Math.cos(radians);
    const dy = -Math.sin(radians);

    // Get center point coordinates from slider positions
    // const centerX = linecut.xPosition;
    // const centerY = linecut.yPosition;
    const centerX = beam_center_x / factor;
    const centerY = beam_center_y / factor;

    // Helper function to check if an intersection point lies within image boundaries
    const isInBounds = (x: number, y: number) =>
        x >= 0 && x <= imageWidth && y >= 0 && y <= imageHeight;

    // Calculate intersection times (t) with each boundary
    // Using the parametric equation:
    // For x boundaries: t = (x_boundary - centerX) / dx
    // For y boundaries: t = (y_boundary - centerY) / dy
    const tLeft = (0 - centerX) / dx;            // Time to hit left boundary
    const tRight = (imageWidth - centerX) / dx;  // Time to hit right boundary
    const tTop = (0 - centerY) / dy;            // Time to hit top boundary
    const tBottom = (imageHeight - centerY) / dy; // Time to hit bottom boundary

    // Array to store valid intersection parameters
    const validTimes: number[] = [];

    // For each boundary, check if intersection point exists and is within bounds
    // Left boundary (x = 0)
    if (isFinite(tLeft)) {  // Check if not parallel to y-axis
        const yLeft = centerY + tLeft * dy;  // y-coordinate at x = 0
        if (isInBounds(0, yLeft)) validTimes.push(tLeft);
    }
    // Right boundary (x = imageWidth)
    if (isFinite(tRight)) {
        const yRight = centerY + tRight * dy;
        if (isInBounds(imageWidth, yRight)) validTimes.push(tRight);
    }
    // Top boundary (y = 0)
    if (isFinite(tTop)) {  // Check if not parallel to x-axis
        const xTop = centerX + tTop * dx;  // x-coordinate at y = 0
        if (isInBounds(xTop, 0)) validTimes.push(tTop);
    }
    // Bottom boundary (y = imageHeight)
    if (isFinite(tBottom)) {
        const xBottom = centerX + tBottom * dx;
        if (isInBounds(xBottom, imageHeight)) validTimes.push(tBottom);
    }

    // If center point is on a boundary, it's an intersection point (t = 0)
    if (centerX === 0 || centerX === imageWidth ||
        centerY === 0 || centerY === imageHeight) {
        validTimes.push(0);
    }

    // If fewer than 2 valid intersections found, return a default line
    // centered at the center point with length 100 pixels
    if (validTimes.length < 2) {
        return {
            x0: centerX - dx * 50,  // Extend 50 pixels in negative direction
            y0: centerY - dy * 50,
            x1: centerX + dx * 50,  // Extend 50 pixels in positive direction
            y1: centerY + dy * 50
        };
    }

    // Sort intersection times to get endpoints
    // First intersection (smallest t) will be one end
    // Last intersection (largest t) will be other end
    validTimes.sort((a, b) => a - b);
    const firstT = validTimes[0];
    const lastT = validTimes[validTimes.length - 1];

    // Calculate final endpoints using parametric equation
    // The paramterics line equation is P(t) = P0 + t*v
    // Where P0 is the center point (centerX, centerY)
    // v is the direction vector (dx, dy)
    // t is the parameter that gives points along the line
    return {
        x0: centerX + firstT * dx,  // First intersection point
        y0: centerY + firstT * dy,
        x1: centerX + lastT * dx,   // Last intersection point
        y1: centerY + lastT * dy
    };
}

export default calculateInclinedLineEndpoints;



// export function calculateInclinedLineEndpoints({
//     linecut,
//     imageWidth,
//     imageHeight,
//     beam_center_x,
//     beam_center_y,
//     factor
//   }) {
//     if (!linecut) return null;

//     // Convert from radians to degrees
//     const radians = (linecut.angle * Math.PI) / 180;

//     // Calculate direction vector
//     const dx = Math.cos(radians);
//     const dy = -Math.sin(radians); // Negative because y increases downward in image coordinates

//     // Scale beam center according to current resolution
//     const scaledBeamCenterX = beam_center_x / factor;
//     const scaledBeamCenterY = beam_center_y / factor;

//     // Calculate the length of the line (using the diagonal of the image as a reference)
//     const maxLength = Math.sqrt(imageWidth * imageWidth + imageHeight * imageHeight);

//     // Calculate endpoints by extending in both directions from the beam center
//     const x0 = scaledBeamCenterX - dx * maxLength / 2;
//     const y0 = scaledBeamCenterY - dy * maxLength / 2;
//     const x1 = scaledBeamCenterX + dx * maxLength / 2;
//     const y1 = scaledBeamCenterY + dy * maxLength / 2;

//     return { x0, y0, x1, y1 };
//   }
