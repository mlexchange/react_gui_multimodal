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
import { AzimuthalIntegration, AzimuthalData } from "./types";
import { H5WebLegend, LegendEntry } from "./H5WebLegend";
import {
  CurveData,
  Domain,
  calculateCurveDomains,
  createTooltipRenderer,
  clampDomainToData
} from "./utils/linePlotUtils";
import { calculateZoomedAzimuthalQRange } from "./utils/calculateZoomedQRange";

interface AzimuthalIntegrationFigProps {
  integrations: AzimuthalIntegration[];
  azimuthalData1: AzimuthalData[];
  azimuthalData2: AzimuthalData[];
  zoomedXPixelRange: [number, number] | null;
  zoomedYPixelRange: [number, number] | null;
  qMagnitudeMatrix: number[][] | null;
}

const AzimuthalIntegrationFig = forwardRef<
  HTMLDivElement,
  AzimuthalIntegrationFigProps
>(
  (
    {
      integrations,
      azimuthalData1,
      azimuthalData2,
      zoomedXPixelRange,
      zoomedYPixelRange,
      qMagnitudeMatrix
    },
    ref
  ) => {
    // Prepare curve data for H5Web
    const { curves, legendEntries, xDomain, yDomain } = useMemo(() => {
      const curveData: CurveData[] = [];
      const entries: LegendEntry[] = [];

      integrations
        .filter((integration) => !integration.hidden)
        .forEach((integration) => {
          const data1 = azimuthalData1.find((d) => d.id === integration.id);
          const data2 = azimuthalData2.find((d) => d.id === integration.id);

          if (data1 && data1.q.length > 0) {
            const label = `Left #${integration.id}`;
            curveData.push({
              id: `left-${integration.id}`,
              abscissas: data1.q,
              ordinates: data1.intensity,
              color: integration.leftColor,
              label
            });
            entries.push({
              id: `left-${integration.id}`,
              label,
              color: integration.leftColor
            });
          }

          if (data2 && data2.q.length > 0) {
            const label = `Right #${integration.id}`;
            curveData.push({
              id: `right-${integration.id}`,
              abscissas: data2.q,
              ordinates: data2.intensity,
              color: integration.rightColor,
              label
            });
            entries.push({
              id: `right-${integration.id}`,
              label,
              color: integration.rightColor
            });
          }
        });

      const { xDomain: baseDomain, yDomain: calculatedYDomain } =
        calculateCurveDomains(curveData);

      let finalXDomain: Domain = baseDomain;
      if (zoomedXPixelRange && zoomedYPixelRange && qMagnitudeMatrix) {
        const qRange = calculateZoomedAzimuthalQRange({
          zoomedXPixelRange,
          zoomedYPixelRange,
          qMagnitudeMatrix
        });
        finalXDomain = clampDomainToData(qRange, baseDomain) ?? baseDomain;
      }

      return {
        curves: curveData,
        legendEntries: entries,
        xDomain: finalXDomain,
        yDomain: calculatedYDomain
      };
    }, [
      integrations,
      azimuthalData1,
      azimuthalData2,
      zoomedXPixelRange,
      zoomedYPixelRange,
      qMagnitudeMatrix
    ]);

    // Show message if no data
    if (curves.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-lg text-gray-500">
            No azimuthal integration data available
          </p>
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
              label: "q (nm⁻¹)"
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
                xUnit: "nm⁻¹"
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

AzimuthalIntegrationFig.displayName = "AzimuthalIntegrationFig";

export default React.memo(AzimuthalIntegrationFig);
