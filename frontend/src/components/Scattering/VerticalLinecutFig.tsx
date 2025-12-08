import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Plot from "react-plotly.js";
import { Linecut } from './types';
import { calculateQSpaceToPixelWidth } from './utils/calculateQSpaceToPixelWidth';

interface VerticalLinecutFigProps {
  linecuts: Linecut[];
  imageData1: number[][];
  imageData2: number[][];
  zoomedXPixelRange: [number, number] | null;
  zoomedYPixelRange: [number, number] | null;
  qXMatrix: number[][];  // Q-values matrix for X axis
  qYMatrix: number[][];  // Q-values matrix for Y axis
  units?: string;      // Units for q-values (e.g., "nm⁻¹", "Å⁻¹")
}

interface Dimensions {
  width: number | undefined;
  height: number | undefined;
}

// Define interface for axis configuration
interface AxisConfig {
  title: {
    text: string;
    font: { size: number }
    standoff?: number;
  };
  tickfont: { size: number };
  autorange: boolean;
  range?: [number, number]; // Optional range for zooming
}

const VerticalLinecutFig: React.FC<VerticalLinecutFigProps> = ({
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

  // Extract q vectors from matrices for plotting
  const qYVector = useMemo(() => {
    if (qYMatrix && qYMatrix.length > 0) {
      return qYMatrix.map(row => row[0]); // First column as Y vector
    }
    return [];
  }, [qYMatrix]);

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
    return calculateQSpaceToPixelWidth(position, width, qXMatrix, 'vertical');
  }, [qXMatrix]);

  // Compute averaged intensity for a vertical linecut
  const computeAveragedIntensity = useCallback((
    imageData: number[][],
    pixelPosition: number,
    qPosition: number,
    qWidth: number
  ) => {
    // Calculate pixel width using the same method as in generateVerticalLinecutOverlay
    const pixelWidth = calculatePixelWidth(qPosition, qWidth);

    // If width is zero, just return the single column
    if (pixelWidth === 0) {
      return imageData.map(row => {
        const value = Number.isNaN(row[pixelPosition]) ? 0 : row[pixelPosition];
        return value;
      });
    }

    const halfWidth = pixelWidth / 2;
    const startCol = Math.max(0, Math.round(pixelPosition - halfWidth));
    const endCol = Math.min(imageData[0].length - 1, Math.ceil(pixelPosition + halfWidth));

    return Array.from(
      { length: imageData.length },
      (_, rowIndex) => {
        let sum = 0;
        let count = 0;

        for (let col = startCol; col <= endCol; col++) {
          if (col >= 0 && col < imageData[rowIndex].length) {
            // If value is NaN, treat it as 0
            const value = Number.isNaN(imageData[rowIndex][col]) ? 0 : imageData[rowIndex][col];
            sum += value;
            count++;
          }
        }

        // Return the average value
        return count > 0 ? sum / count : 0;
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

    // For vertical linecuts, we check if the linecut's x-position falls within the x-range
    const [xStart, xEnd] = xRange;
    return linecut.pixelPosition >= xStart && linecut.pixelPosition <= xEnd;
  }, []);

  // Memoize plot data - SWAPPED: q-values on X-axis and intensity on Y-axis
  const plotData = useMemo(() =>
    linecuts
      .filter((linecut) => !linecut.hidden)
      .flatMap((linecut) => {
        // Calculate intensities using the pixel position for data sampling
        // Pass both the pixel position AND the q-position/width for proper width calculation
        const averagedDataLeft = computeAveragedIntensity(
          imageData1,
          linecut.pixelPosition,
          linecut.position,
          linecut.width ?? 0
        );

        const averagedDataRight = computeAveragedIntensity(
          imageData2,
          linecut.pixelPosition,
          linecut.position,
          linecut.width ?? 0
        );

        // Format the position label with q-value
        const positionLabel = `(q<sub>x</sub>=${linecut.position.toFixed(1)} ${units})`;

        return [
          {
            x: qYVector, // Put q-values on the x-axis
            y: averagedDataLeft, // Put intensity values on the y-axis
            type: "scatter" as const,
            mode: "lines" as const,
            name: `Left Linecut ${linecut.id} ${positionLabel}`,
            line: {
              color: linecut.leftColor,
              width: 2,
            },
          },
          {
            x: qYVector, // Put q-values on the x-axis
            y: averagedDataRight, // Put intensity values on the y-axis
            type: "scatter" as const,
            mode: "lines" as const,
            name: `Right Linecut ${linecut.id} ${positionLabel}`,
            line: {
              color: linecut.rightColor,
              width: 2,
            },
          },
        ];
      }),
    [linecuts, imageData1, imageData2, qYVector, units, computeAveragedIntensity]
  );

  // Update layout with swapped axis configurations
  const layout = useMemo(() => {
    // Check for linecuts in range
    const hasLinecutInRange = linecuts
      .filter(linecut => !linecut.hidden)
      .some(linecut => isLinecutInRange(linecut, zoomedXPixelRange, zoomedYPixelRange));

    // Default x-axis configuration for q-values
    const defaultXAxis: AxisConfig = {
      title: {
        text: `q<sub>y</sub> (${units})`,
        font: { size: 12 }
      },
      tickfont: { size: 11 },
      autorange: true,
    };

    // Set x-axis range for zooming in q-space
    let xAxisConfig: AxisConfig = { ...defaultXAxis };

    if (zoomedYPixelRange && hasLinecutInRange && qYVector.length) {
      // Convert pixel indices to q-values for the x-axis range
      const qRange: [number, number] = [
        qYVector[Math.min(zoomedYPixelRange[0], qYVector.length - 1)],
        qYVector[Math.min(zoomedYPixelRange[1], qYVector.length - 1)]
      ];

      xAxisConfig = {
        ...defaultXAxis,
        range: qRange,
        autorange: false,
      };
    }

    // Default y-axis configuration for intensity values
    const yAxisConfig: AxisConfig = {
      title: { text: "Intensity", font: { size: 12 }, standoff: 40 },
      tickfont: { size: 11 },
      autorange: true,
    };

    return {
      width: dimensions.width,
      height: dimensions.height,
      xaxis: xAxisConfig,
      yaxis: yAxisConfig,
      margin: { l: 60, r: 10, t: 10, b: 40 },
      legend: { font: { size: 10 }, orientation: 'h' as const, y: -0.25 },
      font: { size: 11 },
      showlegend: true,
    };
  }, [dimensions, zoomedYPixelRange, zoomedXPixelRange, linecuts, qYVector, units, isLinecutInRange]);

  return (
    <div ref={containerRef} className="w-full h-full">
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

export default VerticalLinecutFig;
