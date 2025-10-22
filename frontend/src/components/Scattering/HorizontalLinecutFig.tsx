import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Plot from "react-plotly.js";
import { Linecut } from './types';
import { calculateQSpaceToPixelWidth } from './utils/calculateQSpaceToPixelWidth';

interface HorizontalLinecutFigProps {
  linecuts: Linecut[];
  imageData1: number[][];
  imageData2: number[][];
  zoomedXPixelRange: [number, number] | null;
  zoomedYPixelRange: [number, number] | null;
  qXMatrix: number[][]; // Full X matrix
  qYMatrix: number[][]; // Full Y matrix
  units?: string;      // Units for q-values (e.g., "nm⁻¹", "Å⁻¹")
}

interface Dimensions {
  width: number | undefined;
  height: number | undefined;
}

// Define interface for xaxis configuration
interface AxisConfig {
  title: {
    text: string;
    font: { size: number }
  };
  tickfont: { size: number };
  autorange: boolean;
  range?: [number, number]; // Optional range for zooming
}

const HorizontalLinecutFig: React.FC<HorizontalLinecutFigProps> = ({
  linecuts,
  imageData1,
  imageData2,
  zoomedXPixelRange,
  zoomedYPixelRange,
  qXMatrix,
  qYMatrix,
  units = "nm⁻¹",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: undefined,
    height: undefined,
  });

  // Extract vectors from matrices for plotting purposes
  const xVectorForPlotting = useMemo(() => {
    if (qXMatrix && qXMatrix.length > 0 && qXMatrix[0]) {
      return qXMatrix[0]; // First row of the X matrix
    }
    return [];
  }, [qXMatrix]);

  // Update dimensions when container size changes
  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({
          width: Math.floor(width),
          height: Math.floor(height),
        });
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate pixel width from q-space width - consistent with overlay generation
  const calculatePixelWidth = useCallback((position: number, width: number) => {
    return calculateQSpaceToPixelWidth(position, width, qYMatrix, 'horizontal');
  }, [qYMatrix]);

  // Compute averaged intensity for a linecut
  const computeAveragedIntensity = useCallback((
    imageData: number[][],
    pixelPosition: number,
    qPosition: number,
    qWidth: number
  ) => {
    // Calculate pixel width using the same method as in generateHorizontalLinecutOverlay
    const pixelWidth = calculatePixelWidth(qPosition, qWidth);

    // If width is zero, just return the single row
    if (pixelWidth === 0) {
      return imageData[pixelPosition].map(value =>
        Number.isNaN(value) ? 0 : value
      );
    }

    const halfWidth = pixelWidth / 2;
    const startRow = Math.max(0, Math.round(pixelPosition - halfWidth));
    const endRow = Math.min(imageData.length - 1, Math.ceil(pixelPosition + halfWidth));

    return Array.from(
      { length: imageData[0].length },
      (_, colIndex) => {
        let sum = 0;
        let count = 0;

        for (let row = startRow; row <= endRow; row++) {
          // If value is NaN, treat it as 0
          const value = Number.isNaN(imageData[row][colIndex]) ? 0 : imageData[row][colIndex];
          sum += value;
          count++;
        }

        // Return the average value
        return sum / count;
      }
    );
  }, [calculatePixelWidth]);

  // Determine if the linecut is in the zoomed range
  const isLinecutInRange = useCallback((
    linecut: Linecut,
    xRange: [number, number] | null,
    yRange: [number, number] | null
  ): boolean => {
    if (!xRange || !yRange) return false;

    const [yStart, yEnd] = yRange;
    return linecut.pixelPosition <= yStart && linecut.pixelPosition >= yEnd;
  }, []);

  // Memoize the plot data
  const plotData = useMemo(() => {
    const visibleLinecuts = linecuts.filter(linecut => !linecut.hidden);

    return visibleLinecuts.flatMap(linecut => {
      // Calculate intensities using the pixel position for data sampling
      // Pass both the pixel position AND the q-position/width for proper width calculation
      const averagedDataLeft = computeAveragedIntensity(
        imageData1,
        linecut.pixelPosition,
        linecut.position,
        linecut.width
      );

      const averagedDataRight = computeAveragedIntensity(
        imageData2,
        linecut.pixelPosition,
        linecut.position,
        linecut.width
      );

      // Format the position label with q-value
      const positionLabel = `(q<sub>y</sub>=${linecut.position.toFixed(1)} ${units})`;

      return [
        {
          x: xVectorForPlotting,  // Use the extracted X vector from matrix
          y: averagedDataLeft,
          type: "scatter" as const,
          mode: "lines" as const,
          name: `Left Linecut ${linecut.id} ${positionLabel}`,
          line: {
            color: linecut.leftColor,
            width: 2,
          },
        },
        {
          x: xVectorForPlotting,  // Use the extracted X vector from matrix
          y: averagedDataRight,
          type: "scatter" as const,
          mode: "lines" as const,
          name: `Right Linecut ${linecut.id} ${positionLabel}`,
          line: {
            color: linecut.rightColor,
            width: 2,
          },
        },
      ];
    });
  }, [linecuts, imageData1, imageData2, xVectorForPlotting, units, computeAveragedIntensity]);

  // Update layout
  const layout = useMemo(() => {
    const defaultRange: { xaxis: AxisConfig } = {
      xaxis: {
        title: {
          text: `q<sub>x</sub> (${units})`,
          font: { size: 14 }
        },
        tickfont: { size: 14 },
        autorange: true,
      },
    };

    // Check for linecuts in range
    const hasLinecutInRange = linecuts
      .filter(linecut => !linecut.hidden)
      .some(linecut => isLinecutInRange(linecut, zoomedXPixelRange, zoomedYPixelRange));

    // Set x-axis range for zooming
    let xAxisConfig: AxisConfig = { ...defaultRange.xaxis };

    if (zoomedXPixelRange && hasLinecutInRange && xVectorForPlotting.length > 0) {
      // Convert pixel indices to q-values for the x-axis range
      const qRange: [number, number] = [
        xVectorForPlotting[Math.min(zoomedXPixelRange[0], xVectorForPlotting.length - 1)],
        xVectorForPlotting[Math.min(zoomedXPixelRange[1], xVectorForPlotting.length - 1)]
      ];

      xAxisConfig = {
        ...defaultRange.xaxis,
        range: qRange,
        autorange: false,
      };
    }

    return {
      width: dimensions.width,
      height: dimensions.height,
      xaxis: xAxisConfig,
      yaxis: {
        title: { text: "Intensity", font: { size: 14 }, standoff: 50 },
        tickfont: { size: 14 },
        autorange: true,
      },
      margin: { l: 110 },
      legend: { font: { size: 14 } },
      font: { size: 14 },
      showlegend: true,
    };
  }, [dimensions, zoomedXPixelRange, zoomedYPixelRange, linecuts, xVectorForPlotting, units, isLinecutInRange]);

  return (
    <div ref={containerRef} className="mt-4 p-4 bg-gray-100 rounded shadow">
      <Plot
        data={plotData}
        layout={layout}
        config={{
          scrollZoom: true,
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtons: [
            [
              'pan2d',
              'zoom2d',
              'zoomIn2d',
              'zoomOut2d',
              'autoScale2d',
              'resetScale2d',
              'toImage',
            ],
          ],
          showTips: true,
        }}
        useResizeHandler
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
};

export default HorizontalLinecutFig;
