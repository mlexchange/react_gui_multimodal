import { findPixelPositionForQValue} from "./findPixelPositionForQValue";
import { GenerateLinecutParams } from "../types";
import { calculateQSpaceToPixelWidth } from "./calculateQSpaceToPixelWidth";

export function generateHorizontalLinecutOverlay({
  linecut,
  currentArray,
  factor,
  qYMatrix = [],
}: GenerateLinecutParams) {
  if (!currentArray.length || factor === null) return [];

  const imageHeight = currentArray.length;
  const imageWidth = currentArray[0]?.length || 0;

  // Use pixelPosition directly if available, otherwise convert from q-value
  const pixelPosition = 'pixelPosition' in linecut && linecut.pixelPosition !== undefined
    ? linecut.pixelPosition
    : findPixelPositionForQValue(linecut.position, qYMatrix, 'horizontal');

  // Calculate the width in pixel space using centralized function
  const pixelWidth = calculateQSpaceToPixelWidth(linecut.position, linecut.width, qYMatrix, 'horizontal');

  // Scale for display based on resolution factor
  const scaledPosition = pixelPosition / factor;
  const scaledWidth = pixelWidth / factor;

  // Create the overlay boundary
  let yTop, yBottom;

  if (pixelWidth === 0) {
    // For zero width, just draw the central line (no band)
    yTop = scaledPosition;
    yBottom = scaledPosition;
  } else {
    // For non-zero width, draw a band
    yTop = Math.max(0, scaledPosition - scaledWidth / 2);
    yBottom = Math.min(imageHeight, scaledPosition + scaledWidth / 2);
  }

  // Format the position label
  const positionLabel = `${linecut.position.toFixed(1)}`;

  const overlays = [
    // Left image overlays
    {
      x: [0, imageWidth, imageWidth, 0],
      y: [yTop, yTop, yBottom, yBottom],
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
      x: [0, imageWidth],
      y: [scaledPosition, scaledPosition],
      mode: "lines",
      line: { color: linecut.leftColor, width: 1 },
      opacity: 0.75,
      xaxis: "x1",
      yaxis: "y1",
      showlegend: false,
    },
    {
      x: [-imageWidth * 0.03],  // Position text slightly to the left of the image
      y: [scaledPosition],
      mode: "text",
      text: [positionLabel],
      textfont: { size: 25 },  // Larger text
      textposition: "middle left",
      xaxis: "x1",
      yaxis: "y1",
      showlegend: false,
    },
    // Right image overlays
    {
      x: [0, imageWidth, imageWidth, 0],
      y: [yTop, yTop, yBottom, yBottom],
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
      x: [0, imageWidth],
      y: [scaledPosition, scaledPosition],
      mode: "lines",
      line: { color: linecut.rightColor, width: 1 },
      opacity: 0.75,
      xaxis: "x2",
      yaxis: "y2",
      showlegend: false,
    },
    {
      x: [-imageWidth * 0.03],
      y: [scaledPosition],
      mode: "text",
      text: [positionLabel],
      textfont: { size: 25 },
      textposition: "middle left",
      xaxis: "x2",
      yaxis: "y2",
      showlegend: false,
    }
  ];

  return overlays;
}
