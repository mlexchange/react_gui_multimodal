import React, { useEffect, useRef, useState, useMemo } from "react";
import Plot from "@/components/ui/Plot";
import { Linecut } from './types';
import { LinecutData } from './hooks/useHorizontalLinecut';

type LinecutDirection = 'horizontal' | 'vertical';

interface LinecutFigProps {
  direction: LinecutDirection;
  linecuts: Linecut[];
  zoomedXPixelRange: [number, number] | null;
  zoomedYPixelRange: [number, number] | null;
  qXMatrix: number[][];
  qYMatrix: number[][];
  units?: string;
  // API data for linecuts
  leftLinecutData?: Map<number, LinecutData>;
  rightLinecutData?: Map<number, LinecutData>;
}

interface Dimensions {
  width: number | undefined;
  height: number | undefined;
}

interface AxisConfig {
  title: {
    text: string;
    font: { size: number };
    standoff?: number;
  };
  tickfont: { size: number };
  autorange: boolean;
  range?: [number, number];
}

interface DirectionConfig {
  xAxisLabel: (units: string) => string;
  positionLabel: (pos: number, units: string) => string;
  qSpaceToPixelDirection: 'horizontal' | 'vertical';
  extractPlotVector: (matrices: { qXMatrix: number[][]; qYMatrix: number[][] }) => number[];
  extractZoomVector: (matrices: { qXMatrix: number[][]; qYMatrix: number[][] }) => number[];
  getZoomPixelRange: (ranges: { xRange: [number, number] | null; yRange: [number, number] | null }) => [number, number] | null;
  isInRange: (linecut: Linecut, ranges: { xRange: [number, number] | null; yRange: [number, number] | null }) => boolean;
  computeAveragedIntensity: (imageData: number[][], pixelPosition: number, pixelWidth: number) => number[];
  getWidthMatrix: (matrices: { qXMatrix: number[][]; qYMatrix: number[][] }) => number[][];
}

const directionConfig: Record<LinecutDirection, DirectionConfig> = {
  horizontal: {
    xAxisLabel: (units) => `q<sub>x</sub> (${units})`,
    positionLabel: (pos, units) => `(q<sub>y</sub>=${pos.toFixed(1)} ${units})`,
    qSpaceToPixelDirection: 'horizontal',
    extractPlotVector: ({ qXMatrix }) => {
      if (qXMatrix && qXMatrix.length > 0 && qXMatrix[0]) {
        return qXMatrix[0];
      }
      return [];
    },
    extractZoomVector: ({ qXMatrix }) => {
      if (qXMatrix && qXMatrix.length > 0 && qXMatrix[0]) {
        return qXMatrix[0];
      }
      return [];
    },
    getZoomPixelRange: ({ xRange }) => xRange,
    isInRange: (linecut, { yRange }) => {
      if (!yRange) return false;
      const [yStart, yEnd] = yRange;
      return linecut.pixelPosition <= yStart && linecut.pixelPosition >= yEnd;
    },
    computeAveragedIntensity: (imageData, pixelPosition, pixelWidth) => {
      if (pixelWidth === 0) {
        return imageData[pixelPosition].map(value => Number.isNaN(value) ? 0 : value);
      }
      const halfWidth = pixelWidth / 2;
      const startRow = Math.max(0, Math.round(pixelPosition - halfWidth));
      const endRow = Math.min(imageData.length - 1, Math.ceil(pixelPosition + halfWidth));

      return Array.from({ length: imageData[0].length }, (_, colIndex) => {
        let sum = 0;
        let count = 0;
        for (let row = startRow; row <= endRow; row++) {
          const value = Number.isNaN(imageData[row][colIndex]) ? 0 : imageData[row][colIndex];
          sum += value;
          count++;
        }
        return sum / count;
      });
    },
    getWidthMatrix: ({ qYMatrix }) => qYMatrix,
  },
  vertical: {
    xAxisLabel: (units) => `q<sub>y</sub> (${units})`,
    positionLabel: (pos, units) => `(q<sub>x</sub>=${pos.toFixed(1)} ${units})`,
    qSpaceToPixelDirection: 'vertical',
    extractPlotVector: ({ qYMatrix }) => {
      if (qYMatrix && qYMatrix.length > 0) {
        return qYMatrix.map(row => row[0]);
      }
      return [];
    },
    extractZoomVector: ({ qYMatrix }) => {
      if (qYMatrix && qYMatrix.length > 0) {
        return qYMatrix.map(row => row[0]);
      }
      return [];
    },
    getZoomPixelRange: ({ yRange }) => yRange,
    isInRange: (linecut, { xRange }) => {
      if (!xRange) return false;
      const [xStart, xEnd] = xRange;
      return linecut.pixelPosition >= xStart && linecut.pixelPosition <= xEnd;
    },
    computeAveragedIntensity: (imageData, pixelPosition, pixelWidth) => {
      if (pixelWidth === 0) {
        return imageData.map(row => {
          const value = Number.isNaN(row[pixelPosition]) ? 0 : row[pixelPosition];
          return value;
        });
      }
      const halfWidth = pixelWidth / 2;
      const startCol = Math.max(0, Math.round(pixelPosition - halfWidth));
      const endCol = Math.min(imageData[0].length - 1, Math.ceil(pixelPosition + halfWidth));

      return Array.from({ length: imageData.length }, (_, rowIndex) => {
        let sum = 0;
        let count = 0;
        for (let col = startCol; col <= endCol; col++) {
          if (col >= 0 && col < imageData[rowIndex].length) {
            const value = Number.isNaN(imageData[rowIndex][col]) ? 0 : imageData[rowIndex][col];
            sum += value;
            count++;
          }
        }
        return count > 0 ? sum / count : 0;
      });
    },
    getWidthMatrix: ({ qXMatrix }) => qXMatrix,
  },
};

const LinecutFig: React.FC<LinecutFigProps> = ({
  direction,
  linecuts,
  zoomedXPixelRange,
  zoomedYPixelRange,
  qXMatrix,
  qYMatrix,
  units = "nm⁻¹",
  leftLinecutData,
  rightLinecutData,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: undefined,
    height: undefined,
  });

  const config = directionConfig[direction];

  const zoomVector = useMemo(
    () => config.extractZoomVector({ qXMatrix, qYMatrix }),
    [qXMatrix, qYMatrix, config]
  );

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

  // Memoize the plot data
  const plotData = useMemo(() => {
    const visibleLinecuts = linecuts.filter(linecut => !linecut.hidden);

    return visibleLinecuts.flatMap(linecut => {
      const positionLabel = config.positionLabel(linecut.position, units);

      // Get linecut data from API
      const leftApiData = leftLinecutData?.get(linecut.id);
      const rightApiData = rightLinecutData?.get(linecut.id);

      const leftX = leftApiData?.qValues ?? [];
      const leftY = leftApiData?.intensities ?? [];
      const rightX = rightApiData?.qValues ?? [];
      const rightY = rightApiData?.intensities ?? [];

      return [
        {
          x: leftX,
          y: leftY,
          type: "scatter" as const,
          mode: "lines" as const,
          name: `Left #${linecut.id} ${positionLabel}`,
          line: {
            color: linecut.leftColor,
            width: 2,
          },
        },
        {
          x: rightX,
          y: rightY,
          type: "scatter" as const,
          mode: "lines" as const,
          name: `Right #${linecut.id} ${positionLabel}`,
          line: {
            color: linecut.rightColor,
            width: 2,
          },
        },
      ];
    });
  }, [linecuts, units, config, leftLinecutData, rightLinecutData]);

  // Update layout
  const layout = useMemo(() => {
    const defaultXAxis: AxisConfig = {
      title: {
        text: config.xAxisLabel(units),
        font: { size: 12 }
      },
      tickfont: { size: 11 },
      autorange: true,
    };

    // Check for linecuts in range
    const hasLinecutInRange = linecuts
      .filter(linecut => !linecut.hidden)
      .some(linecut => config.isInRange(linecut, { xRange: zoomedXPixelRange, yRange: zoomedYPixelRange }));

    let xAxisConfig: AxisConfig = { ...defaultXAxis };

    const zoomPixelRange = config.getZoomPixelRange({ xRange: zoomedXPixelRange, yRange: zoomedYPixelRange });

    if (zoomPixelRange && hasLinecutInRange && zoomVector.length > 0) {
      const qRange: [number, number] = [
        zoomVector[Math.min(zoomPixelRange[0], zoomVector.length - 1)],
        zoomVector[Math.min(zoomPixelRange[1], zoomVector.length - 1)]
      ];

      xAxisConfig = {
        ...defaultXAxis,
        range: qRange,
        autorange: false,
      };
    }

    return {
      width: dimensions.width,
      height: dimensions.height,
      xaxis: xAxisConfig,
      yaxis: {
        title: { text: "Intensity", font: { size: 12 }, standoff: 40 },
        tickfont: { size: 11 },
        autorange: true,
      },
      margin: { l: 60, r: 10, t: 10, b: 40 },
      legend: { font: { size: 10 }, orientation: 'h' as const, y: -0.25 },
      font: { size: 11 },
      showlegend: true,
    };
  }, [dimensions, zoomedXPixelRange, zoomedYPixelRange, linecuts, zoomVector, units, config]);

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

export default LinecutFig;
