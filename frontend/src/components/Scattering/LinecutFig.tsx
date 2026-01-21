import React, { useMemo, forwardRef } from "react";
import {
  VisCanvas,
  DataCurve,
  ResetZoomButton,
  TooltipMesh,
  XAxisZoom,
  YAxisZoom,
  Pan,
  SelectToZoom
} from "@h5web/lib";
import { Linecut, LinecutData, LinecutDirection } from "./types";
import { H5WebLegend, LegendEntry } from "./H5WebLegend";
import {
  CurveData,
  Domain,
  calculateCurveDomains,
  createTooltipRenderer,
  clampDomainToData
} from "./utils/linePlotUtils";

interface LinecutFigProps {
  direction: LinecutDirection;
  linecuts: Linecut[];
  zoomedXPixelRange: [number, number] | null;
  zoomedYPixelRange: [number, number] | null;
  qXMatrix: number[][];
  qYMatrix: number[][];
  units?: string;
  leftLinecutData?: Map<number, LinecutData>;
  rightLinecutData?: Map<number, LinecutData>;
}

interface DirectionConfig {
  xAxisLabel: (units: string) => string;
  positionLabel: (pos: number, units: string) => string;
  extractZoomVector: (matrices: {
    qXMatrix: number[][];
    qYMatrix: number[][];
  }) => number[];
  getZoomPixelRange: (ranges: {
    xRange: [number, number] | null;
    yRange: [number, number] | null;
  }) => [number, number] | null;
  isInRange: (
    linecut: Linecut,
    ranges: { xRange: [number, number] | null; yRange: [number, number] | null }
  ) => boolean;
}

const directionConfig: Record<LinecutDirection, DirectionConfig> = {
  horizontal: {
    xAxisLabel: (units) => `qₓ (${units})`,
    positionLabel: (pos, units) => `qᵧ=${pos.toFixed(1)} ${units}`,
    extractZoomVector: ({ qXMatrix }) => {
      if (qXMatrix && qXMatrix.length > 0 && qXMatrix[0]) {
        return qXMatrix[0];
      }
      return [];
    },
    getZoomPixelRange: ({ xRange }) => xRange,
    isInRange: (linecut, { yRange }) => {
      if (!yRange) return false;
      // Handle potentially inverted range (due to Y-axis flip)
      const yMin = Math.min(yRange[0], yRange[1]);
      const yMax = Math.max(yRange[0], yRange[1]);
      return linecut.pixelPosition >= yMin && linecut.pixelPosition <= yMax;
    }
  },
  vertical: {
    xAxisLabel: (units) => `qᵧ (${units})`,
    positionLabel: (pos, units) => `qₓ=${pos.toFixed(1)} ${units}`,
    extractZoomVector: ({ qYMatrix }) => {
      if (qYMatrix && qYMatrix.length > 0) {
        return qYMatrix.map((row) => row[0]);
      }
      return [];
    },
    getZoomPixelRange: ({ yRange }) => yRange,
    isInRange: (linecut, { xRange }) => {
      if (!xRange) return false;
      // Handle potentially inverted range
      const xMin = Math.min(xRange[0], xRange[1]);
      const xMax = Math.max(xRange[0], xRange[1]);
      return linecut.pixelPosition >= xMin && linecut.pixelPosition <= xMax;
    }
  }
};

const LinecutFig = forwardRef<HTMLDivElement, LinecutFigProps>(
  (
    {
      direction,
      linecuts,
      zoomedXPixelRange,
      zoomedYPixelRange,
      qXMatrix,
      qYMatrix,
      units = "nm⁻¹",
      leftLinecutData,
      rightLinecutData
    },
    ref
  ) => {
    const config = directionConfig[direction];

    const zoomVector = useMemo(
      () => config.extractZoomVector({ qXMatrix, qYMatrix }),
      [qXMatrix, qYMatrix, config]
    );

    // Prepare curve data for H5Web
    const { curves, legendEntries, xDomain, yDomain } = useMemo(() => {
      const visibleLinecuts = linecuts.filter((linecut) => !linecut.hidden);
      const curveData: CurveData[] = [];
      const entries: LegendEntry[] = [];

      visibleLinecuts.forEach((linecut) => {
        const positionLabel = config.positionLabel(linecut.position, units);
        const leftApiData = leftLinecutData?.get(linecut.id);
        const rightApiData = rightLinecutData?.get(linecut.id);

        if (leftApiData && leftApiData.qValues.length > 0) {
          const label = `Left #${linecut.id} (${positionLabel})`;
          curveData.push({
            id: `left-${linecut.id}`,
            abscissas: leftApiData.qValues,
            ordinates: leftApiData.intensities,
            color: linecut.leftColor,
            label
          });
          entries.push({
            id: `left-${linecut.id}`,
            label,
            color: linecut.leftColor
          });
        }

        if (rightApiData && rightApiData.qValues.length > 0) {
          const label = `Right #${linecut.id} (${positionLabel})`;
          curveData.push({
            id: `right-${linecut.id}`,
            abscissas: rightApiData.qValues,
            ordinates: rightApiData.intensities,
            color: linecut.rightColor,
            label
          });
          entries.push({
            id: `right-${linecut.id}`,
            label,
            color: linecut.rightColor
          });
        }
      });

      const { xDomain: baseDomain, yDomain: calculatedYDomain } =
        calculateCurveDomains(curveData);

      const hasLinecutInRange = visibleLinecuts.some((linecut) =>
        config.isInRange(linecut, {
          xRange: zoomedXPixelRange,
          yRange: zoomedYPixelRange
        })
      );
      const zoomPixelRange = config.getZoomPixelRange({
        xRange: zoomedXPixelRange,
        yRange: zoomedYPixelRange
      });

      let finalXDomain: Domain = baseDomain;
      if (zoomPixelRange && hasLinecutInRange && zoomVector.length > 0) {
        const rawIdx0 = Math.round(zoomPixelRange[0]);
        const rawIdx1 = Math.round(zoomPixelRange[1]);
        const minIdx = Math.max(0, Math.min(rawIdx0, rawIdx1));
        const maxIdx = Math.min(
          zoomVector.length - 1,
          Math.max(rawIdx0, rawIdx1)
        );

        if (minIdx < maxIdx && minIdx >= 0 && maxIdx < zoomVector.length) {
          const qMin = zoomVector[minIdx];
          const qMax = zoomVector[maxIdx];
          if (
            qMin !== undefined &&
            qMax !== undefined &&
            Number.isFinite(qMin) &&
            Number.isFinite(qMax)
          ) {
            const sortedQ: Domain = qMin < qMax ? [qMin, qMax] : [qMax, qMin];
            finalXDomain = clampDomainToData(sortedQ, baseDomain) ?? baseDomain;
          }
        }
      }

      return {
        curves: curveData,
        legendEntries: entries,
        xDomain: finalXDomain,
        yDomain: calculatedYDomain
      };
    }, [
      linecuts,
      units,
      config,
      leftLinecutData,
      rightLinecutData,
      zoomedXPixelRange,
      zoomedYPixelRange,
      zoomVector
    ]);

    // Show message if no data
    if (curves.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-lg text-gray-500">No linecut data available</p>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className="w-full h-full flex flex-col"
        data-linecut-fig="true"
      >
        {/* Plot area */}
        <div className="w-full flex-1 h-0 flex flex-col">
          <VisCanvas
            abscissaConfig={{
              visDomain: xDomain,
              showGrid: true,
              label: config.xAxisLabel(units)
            }}
            ordinateConfig={{
              visDomain: yDomain,
              showGrid: true,
              label: "Intensity"
            }}
            aspect="auto"
          >
            {/* Custom interactions: scroll zooms X-axis only, Shift+scroll zooms Y-axis */}
            <Pan />
            <XAxisZoom />
            <YAxisZoom modifierKey="Shift" />
            <SelectToZoom modifierKey="Control" />
            <ResetZoomButton />
            {curves.map((curve) => (
              <DataCurve
                key={curve.id}
                abscissas={curve.abscissas}
                ordinates={curve.ordinates}
                color={curve.color}
                width={2}
              />
            ))}
            <TooltipMesh
              guides="both"
              renderTooltip={createTooltipRenderer(curves, {
                xLabel: "q",
                xUnit: units
              })}
            />
          </VisCanvas>
        </div>
        {/* Legend */}
        <H5WebLegend
          entries={legendEntries}
          className="shrink-0 border-t border-gray-100"
        />
      </div>
    );
  }
);

LinecutFig.displayName = "LinecutFig";

export default React.memo(LinecutFig);
