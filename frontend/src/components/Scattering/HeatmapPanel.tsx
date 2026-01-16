/**
 * HeatmapPanel component for H5Web visualization.
 *
 * Provides a reusable heatmap panel with overlays for linecuts,
 * inclined linecuts, azimuthal integrations, and mask visualization.
 */

import React, { useMemo } from 'react';
import {
  VisCanvas,
  HeatmapMesh,
  DefaultInteractions,
  ResetZoomButton,
  ScaleType,
  ColorBar,
  TooltipMesh,
} from '@h5web/lib';
import type { ColorMap } from '@h5web/lib';
import type { NdArray } from 'ndarray';

import {
  AzimuthalSectorOverlay,
  MaskOverlay,
  LinecutOverlay,
  InclinedLinecutOverlay,
  type LinecutOverlayProps,
  type InclinedLinecutOverlayProps,
} from './utils/generateOverlays';
import { type ColorScaleType } from './utils/constants';
import {
  AXIS_LEFT_OFFSET,
  AXIS_RIGHT_OFFSET,
  formatTickAsInteger,
} from './utils/h5webUtils';

// ============================================================================
// Types
// ============================================================================

type Domain = [number, number];

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
  linecuts?: LinecutOverlayProps['linecuts'];
  inclinedLinecuts?: InclinedLinecutOverlayProps['linecuts'];
  inclinedPixelWidthCalculator?: (qXPosition: number, qYPosition: number, angle: number, qWidth: number) => number;
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
  qXMatrix?: number[][];
  qYMatrix?: number[][];
  experimentType?: string;
  maskData?: Uint8Array | null;
  maskShape?: [number, number] | null;
  showMaskOverlay?: boolean;
}

// ============================================================================
// Loading Spinner Component
// ============================================================================

export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
    <div className="bg-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      <span className="text-gray-700 text-sm">{message}</span>
    </div>
  </div>
);

// ============================================================================
// Heatmap Panel Component
// ============================================================================

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
  qXMatrix = [],
  qYMatrix = [],
  experimentType = 'SAXS',
  maskData,
  maskShape,
  showMaskOverlay = false,
}) => {
  // Compute axis labels based on experiment type
  const unit = 'nm\u207B\u00B9'; // nm⁻¹ with superscript
  const xAxisLabel = showQSpaceAxes
    ? (experimentType?.toLowerCase() === 'gisaxs' ? `q (in-plane) (${unit})` : `qₓ (${unit})`)
    : 'X (pixels)';
  const yAxisLabel = showQSpaceAxes
    ? (experimentType?.toLowerCase() === 'gisaxs' ? `q (out-of-plane) (${unit})` : `qᵧ (${unit})`)
    : 'Y (pixels)';

  // visDomain stays in PIXEL coordinates always
  const xVisDomain: [number, number] = flipXAxis ? [cols, 0] : [0, cols];
  const yVisDomain: [number, number] = [0, rows];

  // Format q-value for display
  const formatQValue = (qValue: number): string => {
    if (!isFinite(qValue)) return '';
    const rounded = Math.round(qValue * 10) / 10;
    if (Math.abs(rounded - Math.round(rounded)) < 0.01) {
      return Math.round(rounded).toString();
    }
    return rounded.toFixed(1);
  };

  // formatTick functions that look up q-values from the matrices
  const formatXTick = useMemo(() => {
    if (!showQSpaceAxes || !qXMatrix?.length || !qXMatrix[0]?.length) {
      return formatTickAsInteger;
    }
    return (pixelX: number) => {
      const col = Math.round(Math.max(0, Math.min(cols - 1, pixelX)));
      const qValue = qXMatrix[0]?.[col];
      if (qValue === undefined) return '';
      return formatQValue(qValue);
    };
  }, [showQSpaceAxes, qXMatrix, cols]);

  const formatYTick = useMemo(() => {
    if (!showQSpaceAxes || !qYMatrix?.length) {
      return formatTickAsInteger;
    }
    return (pixelY: number) => {
      const row = Math.round(Math.max(0, Math.min(rows - 1, pixelY)));
      const qValue = qYMatrix[row]?.[0];
      if (qValue === undefined) return '';
      return formatQValue(qValue);
    };
  }, [showQSpaceAxes, qYMatrix, rows]);

  // Y-axis flip: always flip=true so pixel 0 is at top (image convention)
  // User's flipYAxis toggle inverts this
  const shouldFlipYAxis = !flipYAxis;

  return (
    <div className="flex flex-col min-h-0 min-w-0 overflow-hidden relative">
      {isLoading && <LoadingSpinner message={loadingMessage} />}
      <div
        className="shrink-0 flex justify-center items-center pt-2 pb-1 h-11"
        style={{ paddingLeft: `${AXIS_LEFT_OFFSET}px`, paddingRight: `${AXIS_RIGHT_OFFSET}px` }}
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
            label: xAxisLabel,
          }}
          ordinateConfig={{
            visDomain: yVisDomain,
            showGrid,
            isIndexAxis: true,
            formatTick: formatYTick,
            label: yAxisLabel,
            flip: shouldFlipYAxis,
          }}
        >
          <DefaultInteractions />
          <ResetZoomButton />
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
                const qx = qXMatrix?.[0]?.[xi];
                const qy = qYMatrix?.[yi]?.[0];
                return (
                  <div className="text-sm">
                    <div>qx={qx?.toPrecision(4) ?? 'N/A'}, qy={qy?.toPrecision(4) ?? 'N/A'}</div>
                    <div className="font-semibold">{value?.toPrecision(5)}</div>
                  </div>
                );
              }
              // Pixel mode
              return (
                <div className="text-sm">
                  <div>x={xi}, y={yi}</div>
                  <div className="font-semibold">{value?.toPrecision(5)}</div>
                </div>
              );
            }}
          />
          <LinecutOverlay
            linecuts={linecuts}
            rows={rows}
            cols={cols}
          />
          {inclinedPixelWidthCalculator && (
            <InclinedLinecutOverlay
              linecuts={inclinedLinecuts}
              rows={rows}
              cols={cols}
              beamCenterX={beamCenterX}
              beamCenterY={beamCenterY}
              pixelWidthCalculator={inclinedPixelWidthCalculator}
            />
          )}
          <AzimuthalSectorOverlay
            integrations={azimuthalIntegrations}
            qMagnitudeMatrix={qMagnitudeMatrix}
            beamCenterX={beamCenterX}
            beamCenterY={beamCenterY}
            maxQValue={maxQValue}
            imageWidth={cols}
            imageHeight={rows}
          />
          {showMaskOverlay && maskData && maskShape && (
            <MaskOverlay
              maskData={maskData}
              maskShape={maskShape}
              imageWidth={cols}
              imageHeight={rows}
            />
          )}
        </VisCanvas>
      </div>
      <div
        className="shrink-0 h-12"
        style={{ paddingLeft: `${AXIS_LEFT_OFFSET}px`, paddingRight: `${AXIS_RIGHT_OFFSET}px` }}
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

export default HeatmapPanel;
