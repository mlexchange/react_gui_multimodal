import { findPixelPositionForQValue } from "./findPixelPositionForQValue";
import { GenerateLinecutParams } from "../types";
import { calculateQSpaceToPixelWidth } from "./calculateQSpaceToPixelWidth";


export function generateVerticalLinecutOverlay({
    linecut,
    currentArray,
    factor,
    qXMatrix = [],
  }: GenerateLinecutParams) {
    if (!currentArray.length || factor === null) return [];

    const imageHeight = currentArray.length;
    const imageWidth = currentArray[0]?.length || 0;

    // Use pixelPosition directly if available, otherwise convert from q-value
    const pixelPosition = 'pixelPosition' in linecut && linecut.pixelPosition !== undefined
      ? linecut.pixelPosition
      : findPixelPositionForQValue(linecut.position, qXMatrix, 'vertical');

    // Calculate the width in pixel space using centralized function
    const pixelWidth = calculateQSpaceToPixelWidth(linecut.position, linecut.width, qXMatrix, 'vertical');

    // Scale for display based on resolution factor
    const scaledPosition = pixelPosition / factor;
    const scaledWidth = pixelWidth / factor;

    // Create the overlay boundary
    let xLeft, xRight;

    if (pixelWidth === 0) {
      // For zero width, just draw the central line (no band)
      xLeft = scaledPosition;
      xRight = scaledPosition;
    } else {
      // For non-zero width, draw a band
      xLeft = Math.max(0, scaledPosition - scaledWidth / 2);
      xRight = Math.min(imageWidth, scaledPosition + scaledWidth / 2);
    }

    // Format the position label with q-value
    const positionLabel = `${linecut.position.toFixed(1)}`;

    return [
      // Left image overlays
      {
        x: [xLeft, xRight, xRight, xLeft],
        y: [0, 0, imageHeight, imageHeight],
        mode: "lines",
        fill: "toself",
        fillcolor: linecut.leftColor,
        line: { color: linecut.leftColor },
        opacity: pixelWidth === 0 ? 0 : 0.3,  // Hide fill for zero width
        xaxis: "x1",
        yaxis: "y1",
        showlegend: false,
      },
      {
        x: [scaledPosition, scaledPosition],
        y: [0, imageHeight],
        mode: "lines",
        line: { color: linecut.leftColor, width: 1 },
        opacity: 0.75,
        xaxis: "x1",
        yaxis: "y1",
        showlegend: false,
      },
      {
        x: [scaledPosition],
        y: [imageHeight * 1.01],  // Position text slightly above the image
        mode: "text",
        text: [positionLabel],
        textfont: { size: 25 },  // Larger text
        textposition: "bottom center",
        xaxis: "x1",
        yaxis: "y1",
        showlegend: false,
      },
      // Right image overlays
      {
        x: [xLeft, xRight, xRight, xLeft],
        y: [0, 0, imageHeight, imageHeight],
        mode: "lines",
        fill: "toself",
        fillcolor: linecut.rightColor,
        line: { color: linecut.rightColor },
        opacity: pixelWidth === 0 ? 0 : 0.3,  // Hide fill for zero width
        xaxis: "x2",
        yaxis: "y2",
        showlegend: false,
      },
      {
        x: [scaledPosition, scaledPosition],
        y: [0, imageHeight],
        mode: "lines",
        line: { color: linecut.rightColor, width: 1 },
        opacity: 0.75,
        xaxis: "x2",
        yaxis: "y2",
        showlegend: false,
      },
      {
        x: [scaledPosition],
        y: [imageHeight * 1.01],  // Position text slightly above the image
        mode: "text",
        text: [positionLabel],
        textfont: { size: 25 },  // Larger text
        textposition: "bottom center",
        xaxis: "x2",
        yaxis: "y2",
        showlegend: false,
      }
    ];
  }
