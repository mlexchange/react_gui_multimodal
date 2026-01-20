import React, { useMemo, useCallback } from "react";
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
import { InclinedLinecut } from "./types";
import { calculateInclinedLineEndpoints } from "./utils/calculateInclinedLinecutEndpoints";
import { calculateZoomedInclinedQRange } from "./utils/calculateZoomedQRange";
import { H5WebLegend, LegendEntry } from "./H5WebLegend";
import {
  CurveData,
  Domain,
  calculateCurveDomains,
  createTooltipRenderer,
  clampDomainToData
} from "./utils/linePlotUtils";

interface InclinedLinecutFigProps {
  linecuts: InclinedLinecut[];
  inclinedLinecutData1: { id: number; data: number[] }[];
  inclinedLinecutData2: { id: number; data: number[] }[];
  beamCenterX: number;
  beamCenterY: number;
  zoomedXPixelRange: [number, number] | null;
  zoomedYPixelRange: [number, number] | null;
  qXVector: number[];
  qYVector: number[];
  units: string;
}

const InclinedLinecutFig: React.FC<InclinedLinecutFigProps> = ({
  linecuts,
  inclinedLinecutData1,
  inclinedLinecutData2,
  beamCenterX,
  beamCenterY,
  zoomedXPixelRange,
  zoomedYPixelRange,
  qXVector,
  qYVector,
  units
}) => {
  /**
   * Compute q radial values along the linecut path with consistent vertical handling
   */
  const computeQRadialDistance = useCallback(
    (linecut: InclinedLinecut, dataLength: number): number[] => {
      if (!qXVector.length || !qYVector.length || dataLength === 0) {
        return [];
      }

      const imageWidth = qXVector.length;
      const imageHeight = qYVector.length;

      const endpoints = calculateInclinedLineEndpoints({
        linecut,
        imageWidth,
        imageHeight,
        beam_center_x: beamCenterX,
        beam_center_y: beamCenterY
      });

      if (!endpoints) return Array(dataLength).fill(0);

      const { x0, y0, x1, y1 } = endpoints;

      // Check if linecut is vertical or nearly vertical (±90° ±1°)
      const isVertical = Math.abs(Math.abs(linecut.angle) - 90) < 1;

      // Determine the order of points
      let startX, startY, endX, endY;

      if (isVertical) {
        // For vertical linecuts, always order from top to bottom
        if (y0 < y1) {
          startX = x0;
          startY = y0;
          endX = x1;
          endY = y1;
        } else {
          startX = x1;
          startY = y1;
          endX = x0;
          endY = y0;
        }
      } else {
        // For non-vertical linecuts, sort from left to right
        const needsReordering = x0 > x1;
        startX = needsReordering ? x1 : x0;
        startY = needsReordering ? y1 : y0;
        endX = needsReordering ? x0 : x1;
        endY = needsReordering ? y0 : y1;
      }

      const adjustedDx = endX - startX;
      const adjustedDy = endY - startY;

      const qRadialValues = new Array(dataLength);

      for (let i = 0; i < dataLength; i++) {
        const t = i / (dataLength - 1);

        const pixelX = Math.round(startX + t * adjustedDx);
        const pixelY = Math.round(startY + t * adjustedDy);

        const boundedX = Math.min(Math.max(0, pixelX), imageWidth - 1);
        const boundedY = Math.min(Math.max(0, pixelY), imageHeight - 1);

        const qX = qXVector[boundedX];
        const qY = qYVector[boundedY];

        let signedQRadial: number;

        if (isVertical) {
          const qYCenter =
            qYVector[
              Math.min(
                Math.max(0, Math.round(beamCenterY)),
                qYVector.length - 1
              )
            ];
          signedQRadial = qY - qYCenter;
        } else {
          const qRadial = Math.sqrt(qX * qX + qY * qY);
          const isLeftOfBeamCenter = pixelX < beamCenterX;
          signedQRadial = isLeftOfBeamCenter ? -qRadial : qRadial;
        }

        qRadialValues[i] = signedQRadial;
      }

      return qRadialValues;
    },
    [qXVector, qYVector, beamCenterX, beamCenterY]
  );

  // Prepare curve data for H5Web
  const { curves, legendEntries, xDomain, yDomain } = useMemo(() => {
    const curveData: CurveData[] = [];
    const entries: LegendEntry[] = [];

    linecuts
      .filter((linecut) => !linecut.hidden)
      .forEach((linecut) => {
        const data1Item = inclinedLinecutData1?.find(
          (d) => d.id === linecut.id
        );
        const data2Item = inclinedLinecutData2?.find(
          (d) => d.id === linecut.id
        );

        if (!data1Item || !data2Item) return;

        const data1 = data1Item.data;
        const data2 = data2Item.data;
        const qRadialValues = computeQRadialDistance(linecut, data1.length);

        if (
          qRadialValues.length === 0 ||
          data1.length === 0 ||
          data2.length === 0
        ) {
          return;
        }

        const leftLabel = `Left #${linecut.id}`;
        curveData.push({
          id: `left-${linecut.id}`,
          abscissas: qRadialValues,
          ordinates: data1,
          color: linecut.leftColor,
          label: leftLabel
        });
        entries.push({
          id: `left-${linecut.id}`,
          label: leftLabel,
          color: linecut.leftColor
        });

        const rightLabel = `Right #${linecut.id}`;
        curveData.push({
          id: `right-${linecut.id}`,
          abscissas: qRadialValues,
          ordinates: data2,
          color: linecut.rightColor,
          label: rightLabel
        });
        entries.push({
          id: `right-${linecut.id}`,
          label: rightLabel,
          color: linecut.rightColor
        });
      });

    const { xDomain: baseDomain, yDomain: calculatedYDomain } =
      calculateCurveDomains(curveData);

    let finalXDomain: Domain = baseDomain;
    if (
      zoomedXPixelRange &&
      zoomedYPixelRange &&
      beamCenterX !== undefined &&
      beamCenterY !== undefined
    ) {
      let minQ = Infinity;
      let maxQ = -Infinity;

      linecuts
        .filter((linecut) => !linecut.hidden)
        .forEach((linecut) => {
          const qRange = calculateZoomedInclinedQRange({
            linecut,
            zoomedXPixelRange,
            zoomedYPixelRange,
            qXVector,
            qYVector,
            beamCenterX,
            beamCenterY
          });

          if (qRange) {
            minQ = Math.min(minQ, qRange[0]);
            maxQ = Math.max(maxQ, qRange[1]);
          }
        });

      if (Number.isFinite(minQ) && Number.isFinite(maxQ)) {
        finalXDomain =
          clampDomainToData([minQ, maxQ], baseDomain) ?? baseDomain;
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
    inclinedLinecutData1,
    inclinedLinecutData2,
    zoomedXPixelRange,
    zoomedYPixelRange,
    qXVector,
    qYVector,
    beamCenterX,
    beamCenterY,
    computeQRadialDistance
  ]);

  // Show a message if no data is available
  if (linecuts.filter((l) => !l.hidden).length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-lg text-gray-500">No visible linecuts available</p>
      </div>
    );
  }

  if (curves.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-lg text-gray-500">
          No inclined linecut data available
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col" data-linecut-fig="true">
      {/* Plot area */}
      <div className="w-full flex-1 h-0 flex flex-col">
        <VisCanvas
          abscissaConfig={{
            visDomain: xDomain,
            showGrid: true,
            label: `Signed qᵣ (${units})`
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
              xLabel: "qᵣ",
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
};

export default InclinedLinecutFig;
