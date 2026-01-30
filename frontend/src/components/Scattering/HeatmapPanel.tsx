import React, { useMemo } from "react";
import {
  VisCanvas,
  HeatmapMesh,
  DefaultInteractions,
  ResetZoomButton,
  ColorBar,
  TooltipMesh
} from "@h5web/lib";
import type { ColorMap } from "@h5web/lib";
import type { NdArray } from "ndarray";

import {
  AzimuthalSectorOverlay,
  MaskOverlay,
  LinecutOverlay,
  InclinedLinecutOverlay,
  BeamCenterOverlay,
  type LinecutOverlayProps,
  type InclinedLinecutOverlayProps
} from "./utils/generateOverlays";
import { type ColorScaleType } from "./utils/constants";
import {
  AXIS_LEFT_OFFSET,
  AXIS_LEFT_OFFSET_NO_LABEL,
  AXIS_RIGHT_OFFSET,
  formatTickAsInteger,
  binarySearchClosest
} from "./utils/h5webUtils";
import {
  ZoomBroadcaster,
  ZoomReceiver,
  type ZoomState
} from "./utils/zoomSync";
import { type Domain } from "./utils/linePlotUtils";

export interface HeatmapPanelProps {
  header?: React.ReactNode;
  dataArray: NdArray<Float32Array>;
  domain: Domain;
  colorMap: ColorMap;
  scaleType: ColorScaleType;
  invertColorMap?: boolean;
  rows: number;
  cols: number;
  flipXAxis?: boolean;
  flipYAxis?: boolean;
  showGrid?: boolean;
  linecuts?: LinecutOverlayProps["linecuts"];
  inclinedLinecuts?: InclinedLinecutOverlayProps["linecuts"];
  inclinedPixelWidthCalculator?: (
    qXPosition: number,
    qYPosition: number,
    angle: number,
    qWidth: number
  ) => number;
  azimuthalIntegrations?: Array<{
    qRange: [number, number] | null;
    azimuthRange: [number, number];
    color: string;
    hidden?: boolean;
  }>;
  qMagnitudeMatrix?: number[][] | null;
  beamCenterX?: number;
  beamCenterY?: number;
  maxQValue?: number;
  isLoading?: boolean;
  loadingMessage?: string;
  showQSpaceAxes?: boolean;
  qXVector?: number[];
  qYVector?: number[];
  experimentType?: string;
  maskData?: Uint8Array | null;
  maskShape?: [number, number] | null;
  showMaskOverlay?: boolean;
  showBeamCenterOverlay?: boolean;
  showLinecutOverlays?: boolean; // Controls visibility of linecut/azimuthal overlays
  // GISAXS-specific Q value arrays (for transformed Q-space images)
  gisaxsQipValues?: number[]; // 1D array for X axis in Q-space mode
  gisaxsQoopValues?: number[]; // 1D array for Y axis in Q-space mode
  showYAxisLabel?: boolean;
  isZoomSource?: boolean;
  onZoomChange?: (state: ZoomState | null) => void;
  syncedZoomState?: ZoomState | null;
  disableInteractions?: boolean;
}

export const LoadingSpinner: React.FC<{ message?: string }> = ({
  message = "Loading..."
}) => (
  <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
    <div className="bg-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      <span className="text-gray-700 text-sm">{message}</span>
    </div>
  </div>
);

export const HeatmapPanel: React.FC<HeatmapPanelProps> = ({
  header,
  dataArray,
  domain,
  colorMap,
  scaleType,
  invertColorMap = false,
  rows,
  cols,
  flipXAxis = false,
  flipYAxis = false,
  showGrid = false,
  linecuts = [],
  inclinedLinecuts = [],
  inclinedPixelWidthCalculator,
  azimuthalIntegrations = [],
  qMagnitudeMatrix = null,
  beamCenterX = 0,
  beamCenterY = 0,
  maxQValue = 1,
  isLoading = false,
  loadingMessage,
  showQSpaceAxes = false,
  qXVector = [],
  qYVector = [],
  experimentType = "SAXS",
  maskData,
  maskShape,
  showMaskOverlay = false,
  showBeamCenterOverlay = false,
  showLinecutOverlays = true,
  gisaxsQipValues,
  gisaxsQoopValues,
  showYAxisLabel = true,
  // Zoom synchronization
  isZoomSource = false,
  onZoomChange,
  syncedZoomState,
  disableInteractions = false
}) => {
  // Check if we're in GISAXS Q-space mode with transformed data
  const isGisaxsQSpace =
    experimentType?.toLowerCase() === "gisaxs" &&
    showQSpaceAxes &&
    gisaxsQipValues &&
    gisaxsQoopValues;
  // Compute axis labels based on experiment type
  const unit = "nm\u207B\u00B9"; // nm⁻¹ with superscript
  const xAxisLabel = showQSpaceAxes
    ? experimentType?.toLowerCase() === "gisaxs"
      ? `q (in-plane) (${unit})`
      : `qₓ (${unit})`
    : "X (pixels)";
  // Only show y-axis label if showYAxisLabel is true
  const yAxisLabel = showYAxisLabel
    ? showQSpaceAxes
      ? experimentType?.toLowerCase() === "gisaxs"
        ? `q (out-of-plane) (${unit})`
        : `qᵧ (${unit})`
      : "Y (pixels)"
    : undefined;

  // visDomain stays in PIXEL coordinates always
  const xVisDomain: [number, number] = flipXAxis ? [cols, 0] : [0, cols];
  const yVisDomain: [number, number] = [0, rows];

  // Format q-value for display
  const formatQValue = (qValue: number): string => {
    if (!isFinite(qValue)) return "";
    return qValue.toFixed(2);
  };

  // formatTick functions that look up q-values from the matrices or GISAXS arrays
  const formatXTick = useMemo(() => {
    if (!showQSpaceAxes) {
      return formatTickAsInteger;
    }

    // For GISAXS Q-space mode with transformed data, use 1D qip array
    if (isGisaxsQSpace && gisaxsQipValues) {
      return (pixelX: number) => {
        const idx = Math.round(
          Math.max(0, Math.min(gisaxsQipValues.length - 1, pixelX))
        );
        const qValue = gisaxsQipValues[idx];
        if (qValue === undefined) return "";
        return formatQValue(qValue);
      };
    }

    // For SAXS or GISAXS pixel mode, use 1D vector
    if (!qXVector?.length) {
      return formatTickAsInteger;
    }
    return (pixelX: number) => {
      const col = Math.round(Math.max(0, Math.min(cols - 1, pixelX)));
      const qValue = qXVector[col];
      if (qValue === undefined) return "";
      return formatQValue(qValue);
    };
  }, [showQSpaceAxes, qXVector, cols, isGisaxsQSpace, gisaxsQipValues]);

  const formatYTick = useMemo(() => {
    if (!showQSpaceAxes) {
      return formatTickAsInteger;
    }

    // For GISAXS Q-space mode with transformed data, use 1D qoop array
    // pyFAI returns qoop_values sorted ascending: qoop_values[0] = most negative
    // The transformed image row 0 corresponds to qoop_values[0]
    // Axis labels directly map pixel index to qoop value (no inversion needed)
    if (isGisaxsQSpace && gisaxsQoopValues) {
      return (pixelY: number) => {
        const idx = Math.round(
          Math.max(0, Math.min(gisaxsQoopValues.length - 1, pixelY))
        );
        const qValue = gisaxsQoopValues[idx];
        if (qValue === undefined) return "";
        return formatQValue(qValue);
      };
    }

    // For SAXS or GISAXS pixel mode, use 1D vector
    if (!qYVector?.length) {
      return formatTickAsInteger;
    }
    return (pixelY: number) => {
      const row = Math.round(Math.max(0, Math.min(rows - 1, pixelY)));
      const qValue = qYVector[row];
      if (qValue === undefined) return "";
      return formatQValue(qValue);
    };
  }, [showQSpaceAxes, qYVector, rows, isGisaxsQSpace, gisaxsQoopValues]);

  // In GISAXS Q-space mode, the beam center is at q_ip=0, q_oop=0.
  // Convert to pixel indices in the Q-space image so the overlay
  // appears at the correct position.
  const effectiveBeamCenterX = useMemo(() => {
    if (isGisaxsQSpace && gisaxsQipValues && beamCenterX !== undefined) {
      return binarySearchClosest(gisaxsQipValues, 0);
    }
    return beamCenterX;
  }, [isGisaxsQSpace, gisaxsQipValues, beamCenterX]);

  const effectiveBeamCenterY = useMemo(() => {
    if (isGisaxsQSpace && gisaxsQoopValues && beamCenterY !== undefined) {
      return binarySearchClosest(gisaxsQoopValues, 0);
    }
    return beamCenterY;
  }, [isGisaxsQSpace, gisaxsQoopValues, beamCenterY]);

  // Y-axis flip: always flip=true so pixel 0 is at top (image convention)
  // User's flipYAxis toggle inverts this
  const shouldFlipYAxis = !flipYAxis;

  // Determine left offset based on whether y-axis label is shown
  const leftOffset = showYAxisLabel
    ? AXIS_LEFT_OFFSET
    : AXIS_LEFT_OFFSET_NO_LABEL;

  return (
    <div
      className="flex flex-col min-h-0 min-w-0 overflow-visible relative"
      data-has-y-label={showYAxisLabel}
    >
      {isLoading && <LoadingSpinner message={loadingMessage} />}
      <div
        className="shrink-0 flex justify-center items-center pt-2 pb-1 h-11"
        style={{
          paddingLeft: `${leftOffset}px`,
          paddingRight: `${AXIS_RIGHT_OFFSET}px`
        }}
      >
        {header}
      </div>
      <div className="flex-1 flex min-h-0">
        <VisCanvas
          aspect="equal"
          abscissaConfig={{
            visDomain: xVisDomain,
            showGrid,
            isIndexAxis: true,
            formatTick: formatXTick,
            label: xAxisLabel
          }}
          ordinateConfig={{
            visDomain: yVisDomain,
            showGrid,
            isIndexAxis: true,
            formatTick: formatYTick,
            label: yAxisLabel,
            flip: shouldFlipYAxis
          }}
        >
          {!disableInteractions && (
            <>
              <DefaultInteractions />
              <ResetZoomButton />
            </>
          )}
          {isZoomSource && onZoomChange && (
            <ZoomBroadcaster onZoomChange={onZoomChange} />
          )}
          {!isZoomSource && syncedZoomState !== undefined && (
            <ZoomReceiver zoomState={syncedZoomState} />
          )}
          <HeatmapMesh
            values={dataArray}
            domain={domain}
            colorMap={colorMap}
            scaleType={scaleType}
            invertColorMap={invertColorMap}
            scale={[flipXAxis ? -1 : 1, flipYAxis ? 1 : -1, 1]}
          />
          <TooltipMesh
            guides="both"
            renderTooltip={(x, y) => {
              const xi = Math.floor(x);
              const yi = Math.floor(y);
              // Bounds check
              if (xi < 0 || xi >= cols || yi < 0 || yi >= rows) {
                return null;
              }
              const value = dataArray.get(yi, xi);

              if (showQSpaceAxes) {
                // For GISAXS Q-space mode, use 1D arrays
                if (isGisaxsQSpace && gisaxsQipValues && gisaxsQoopValues) {
                  const qip = gisaxsQipValues[xi];
                  const qoop = gisaxsQoopValues[yi];
                  return (
                    <div className="text-sm">
                      <div>
                        qip={qip?.toFixed(4) ?? "N/A"}, qoop=
                        {qoop?.toFixed(4) ?? "N/A"}
                      </div>
                      <div className="font-semibold">
                        {value?.toPrecision(5)}
                      </div>
                    </div>
                  );
                }
                // For SAXS or GISAXS pixel view with Q labels
                const qx = qXVector?.[xi];
                const qy = qYVector?.[yi];
                return (
                  <div className="text-sm">
                    <div>
                      qx={qx?.toFixed(4) ?? "N/A"}, qy=
                      {qy?.toFixed(4) ?? "N/A"}
                    </div>
                    <div className="font-semibold">{value?.toPrecision(5)}</div>
                  </div>
                );
              }
              // Pixel mode
              return (
                <div className="text-sm">
                  <div>
                    x={xi}, y={yi}
                  </div>
                  <div className="font-semibold">{value?.toPrecision(5)}</div>
                </div>
              );
            }}
          />
          {showLinecutOverlays && linecuts.length > 0 && (
            <LinecutOverlay linecuts={linecuts} rows={rows} cols={cols} />
          )}
          {showLinecutOverlays &&
            inclinedPixelWidthCalculator &&
            inclinedLinecuts.length > 0 && (
              <InclinedLinecutOverlay
                linecuts={inclinedLinecuts}
                rows={rows}
                cols={cols}
                beamCenterX={beamCenterX}
                beamCenterY={beamCenterY}
                pixelWidthCalculator={inclinedPixelWidthCalculator}
              />
            )}
          {showLinecutOverlays && azimuthalIntegrations.length > 0 && (
            <AzimuthalSectorOverlay
              integrations={azimuthalIntegrations}
              qMagnitudeMatrix={qMagnitudeMatrix}
              beamCenterX={beamCenterX}
              beamCenterY={beamCenterY}
              maxQValue={maxQValue}
              imageWidth={cols}
              imageHeight={rows}
            />
          )}
          {showMaskOverlay && maskData && maskShape && (
            <MaskOverlay
              maskData={maskData}
              maskShape={maskShape}
              imageWidth={cols}
              imageHeight={rows}
            />
          )}
          {showBeamCenterOverlay &&
            effectiveBeamCenterX !== undefined &&
            effectiveBeamCenterY !== undefined && (
              <BeamCenterOverlay
                beamCenterX={effectiveBeamCenterX}
                beamCenterY={effectiveBeamCenterY}
              />
            )}
        </VisCanvas>
      </div>
      <div
        className="shrink-0 h-12"
        style={{
          paddingLeft: `${leftOffset}px`,
          paddingRight: `${AXIS_RIGHT_OFFSET}px`
        }}
      >
        <ColorBar
          domain={domain}
          scaleType={scaleType}
          colorMap={colorMap}
          invertColorMap={invertColorMap}
          horizontal
          withBounds
        />
      </div>
    </div>
  );
};

export default React.memo(HeatmapPanel);
export type { ZoomState } from "./utils/zoomSync";
