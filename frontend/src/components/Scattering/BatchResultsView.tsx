/**
 * BatchResultsView - Visualization component for batch processing results.
 *
 * Embedded in BatchProcessingOverlay for the centralized batch interface.
 *
 * Features:
 * - Toggle between Waterfall and Heatmap views
 * - H5Web LineVis for waterfall plots (multiple overlaid curves)
 * - H5Web HeatmapMesh for heatmap view
 * - Adjustable waterfall offset
 * - Export to CSV
 */

import { useState, useMemo, useCallback } from 'react';
import {
  VisCanvas,
  DataCurve,
  HeatmapMesh,
  DefaultInteractions,
  ResetZoomButton,
  ScaleType,
  Toolbar,
  Separator,
  DomainWidget,
  ColorMapSelector,
  ScaleSelector,
  ColorBar,
  TooltipMesh,
  ToggleBtn,
  SvgElement,
  DataToHtml,
  type ColorMap,
  type CustomDomain,
} from '@h5web/lib';
import {
  findClosestCurve,
  getClosestPoint,
  getSafeDomainForScale,
  StandardTooltip,
  type CurveData,
} from './utils/linePlotUtils';
import { Vector3 } from 'three';
import ndarray from 'ndarray';
import {
  GridFourIcon,
  DownloadSimpleIcon,
} from '@phosphor-icons/react';
import { Button, ButtonWithIcon } from '@blueskyproject/finch';
import { NumberInput } from '@/components/ui';
import { BatchOperationType } from './hooks/useBatchProcessing';
import { BatchLinecutResult } from './types';
import { exportToCSV } from './utils/batchExport';
import { SCALE_OPTIONS, type ColorScaleType } from './utils/constants';
import type { Linecut, InclinedLinecut, AzimuthalIntegration } from './types';

// Domain type
type Domain = [number, number];

// View mode type
type ViewMode = 'waterfall' | 'heatmap';

// Color palette for waterfall curves
const CURVE_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
];

// Format tick as 1-based integer for scan axis
const formatScanTick = (val: number): string => {
  const intVal = Math.round(val);
  // Only show integer ticks
  if (Math.abs(val - intVal) > 0.01) return '';
  return String(intVal + 1);
};


// Linecut info for title display
type LinecutInfo = Linecut | InclinedLinecut | AzimuthalIntegration | null;

// X-axis labels for different operation types
const X_AXIS_LABELS: Record<BatchOperationType, string> = {
  horizontal: 'qₓ (nm⁻¹)',
  vertical: 'qᵧ (nm⁻¹)',
  inclined: 'q (nm⁻¹)',
  azimuthal: 'q (nm⁻¹)',
};

// Generate title string from linecut info
function getLinecutTitle(operationType: BatchOperationType, linecut: LinecutInfo, index: number): string {
  if (!linecut) return '';

  switch (operationType) {
    case 'horizontal': {
      const lc = linecut as Linecut;
      return `Horizontal Linecut ${index + 1}: qᵧ = ${lc.position.toFixed(3)} nm⁻¹, width = ${lc.width.toFixed(3)} nm⁻¹`;
    }
    case 'vertical': {
      const lc = linecut as Linecut;
      return `Vertical Linecut ${index + 1}: qₓ = ${lc.position.toFixed(3)} nm⁻¹, width = ${lc.width.toFixed(3)} nm⁻¹`;
    }
    case 'inclined': {
      const lc = linecut as InclinedLinecut;
      return `Inclined Linecut ${index + 1}: angle = ${lc.angle.toFixed(1)}°, width = ${lc.qWidth.toFixed(3)} nm⁻¹`;
    }
    case 'azimuthal': {
      const az = linecut as AzimuthalIntegration;
      const qRangeStr = az.qRange
        ? `q = [${az.qRange[0].toFixed(3)}, ${az.qRange[1].toFixed(3)}] nm⁻¹`
        : 'full q range';
      return `Azimuthal Integration ${index + 1}: ${qRangeStr}, χ = [${az.azimuthRange[0].toFixed(0)}°, ${az.azimuthRange[1].toFixed(0)}°]`;
    }
  }
}

interface BatchResultsViewProps {
  results: BatchLinecutResult[];
  operationType: BatchOperationType;
  totalScans: number;
  successful: number;
  failed: number;
  /** Optional: Hide the controls header */
  hideControls?: boolean;
  /** Optional: Current linecut info for title display */
  linecutInfo?: LinecutInfo;
  /** Optional: Index of the linecut */
  linecutIndex?: number;
}

export function BatchResultsView({
  results,
  operationType,
  totalScans,
  successful,
  failed,
  hideControls = false,
  linecutInfo,
  linecutIndex = 0,
}: BatchResultsViewProps) {
  // Generate title for the visualization
  const title = getLinecutTitle(operationType, linecutInfo ?? null, linecutIndex);

  // Get appropriate x-axis label based on operation type
  const xAxisLabel = X_AXIS_LABELS[operationType];
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('waterfall');
  const [waterfallOffset, setWaterfallOffset] = useState(100);
  const [colorMap, setColorMap] = useState<ColorMap>('Viridis');
  const [invertColorMap, setInvertColorMap] = useState(false);
  const [scaleType, setScaleType] = useState<ColorScaleType>(ScaleType.Linear);
  const [customDomain, setCustomDomain] = useState<CustomDomain>([null, null]);
  const [showGrid, setShowGrid] = useState(false);

  // Handler for waterfall offset changes
  const handleOffsetChange = useCallback((value: string | number) => {
    if (typeof value === 'number') {
      setWaterfallOffset(value);
    } else if (value !== '') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) setWaterfallOffset(parsed);
    }
  }, []);

  // Handler for scale type changes
  const handleScaleChange = useCallback((newScale: ColorScaleType) => {
    setScaleType(newScale);
  }, []);

  // Filter successful results
  const successfulResults = useMemo(
    () => results.filter(r => r.success),
    [results]
  );

  // Get q-values from first successful result
  const qValues = useMemo(() => {
    if (successfulResults.length === 0) return [];
    return successfulResults[0].q_values;
  }, [successfulResults]);

  // Q-value domain for heatmap X-axis
  const qDomain = useMemo((): Domain => {
    if (qValues.length === 0) return [0, 1];
    return [qValues[0], qValues[qValues.length - 1]];
  }, [qValues]);

  // Prepare curve data for waterfall plot
  const { waterfallCurves, waterfallXDomain, waterfallYDomain } = useMemo(() => {
    if (successfulResults.length === 0 || qValues.length === 0) {
      return {
        waterfallCurves: [],
        waterfallXDomain: [0, 1] as Domain,
        waterfallYDomain: [0, 1] as Domain,
      };
    }

    // Create curve data for each result with vertical offset
    // Use CurveData-compatible structure with scanName stored in label
    const curves: CurveData[] = successfulResults.map((r, i) => ({
      id: `scan-${i}`,
      label: r.scan_name,
      abscissas: qValues,
      ordinates: r.intensities.map(v => v + i * waterfallOffset),
      color: CURVE_COLORS[i % CURVE_COLORS.length],
    }));

    // Calculate domains
    const allOrdinates = curves.flatMap(c => c.ordinates);
    const validOrdinates = allOrdinates.filter(v => isFinite(v) && !isNaN(v));
    const yMin = validOrdinates.length > 0 ? Math.min(...validOrdinates) : 0;
    const yMax = validOrdinates.length > 0 ? Math.max(...validOrdinates) : 1;
    const yPadding = (yMax - yMin) * 0.05;

    const xMin = Math.min(...qValues);
    const xMax = Math.max(...qValues);
    const xPadding = (xMax - xMin) * 0.02;

    return {
      waterfallCurves: curves,
      waterfallXDomain: [xMin - xPadding, xMax + xPadding] as Domain,
      waterfallYDomain: [yMin - yPadding, yMax + yPadding] as Domain,
    };
  }, [successfulResults, qValues, waterfallOffset]);

  // Prepare data for H5Web HeatmapMesh
  const { heatmapData, heatmapDomain } = useMemo(() => {
    if (successfulResults.length === 0) {
      return { heatmapData: null, heatmapDomain: [0, 1] as Domain };
    }

    const height = successfulResults.length;
    const width = successfulResults[0].intensities.length;
    const flat = new Float32Array(height * width);

    let min = Infinity;
    let max = -Infinity;

    successfulResults.forEach((r, row) => {
      r.intensities.forEach((val, col) => {
        const idx = row * width + col;
        flat[idx] = val;
        if (isFinite(val) && !isNaN(val)) {
          min = Math.min(min, val);
          max = Math.max(max, val);
        }
      });
    });

    if (!isFinite(min)) min = 0;
    if (!isFinite(max)) max = 1;

    return {
      heatmapData: ndarray(flat, [height, width]),
      heatmapDomain: [min, max] as Domain,
    };
  }, [successfulResults]);

  // Safe domain for heatmap (handles log scale)
  const safeHeatmapDomain = useMemo(
    () => getSafeDomainForScale(heatmapDomain, scaleType),
    [heatmapDomain, scaleType]
  );

  // Export handler
  const handleExportCSV = useCallback(() => {
    exportToCSV(results, operationType);
  }, [results, operationType]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Controls Header (optional) */}
      {!hideControls && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center gap-4">
            {/* Summary */}
            <span className="text-sm text-gray-600">
              {totalScans} scans: {successful} successful, {failed} failed
            </span>

            {/* View Toggle */}
            <div className="flex gap-1">
              <Button
                text="Waterfall"
                cb={() => setViewMode('waterfall')}
                size="small"
                styles={
                  viewMode === 'waterfall'
                    ? 'bg-sky-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }
              />
              <Button
                text="Heatmap"
                cb={() => setViewMode('heatmap')}
                size="small"
                styles={
                  viewMode === 'heatmap'
                    ? 'bg-sky-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }
              />
            </div>

            {/* Waterfall offset control */}
            {viewMode === 'waterfall' && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Offset:</label>
                <NumberInput
                  value={waterfallOffset}
                  onChange={handleOffsetChange}
                  min={0}
                  max={10000}
                  step={10}
                  className="w-20"
                />
              </div>
            )}
          </div>

          {/* Export button */}
          <ButtonWithIcon
            icon={<DownloadSimpleIcon size={18} />}
            text="CSV"
            cb={handleExportCSV}
            size="small"
            isSecondary
          />
        </div>
      )}

      {/* Title */}
      {title && (
        <div className="px-4 py-2 text-center text-sm font-medium text-gray-700 border-b border-gray-100 shrink-0">
          {title}
        </div>
      )}

      {/* Visualization Area */}
      <div className="flex-1 min-h-0 p-4 flex flex-col">
        {successfulResults.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No successful results to display
          </div>
        ) : viewMode === 'waterfall' && waterfallCurves.length > 0 ? (
          <div className="w-full flex-1 h-0 flex flex-col">
            <VisCanvas
              abscissaConfig={{
                visDomain: waterfallXDomain,
                showGrid: true,
                label: xAxisLabel,
              }}
              ordinateConfig={{
                visDomain: waterfallYDomain,
                showGrid: true,
                label: 'Intensity (offset)',
              }}
              aspect="auto"
            >
              <DefaultInteractions />
              <ResetZoomButton />
              {waterfallCurves.map((curve) => (
                <DataCurve
                  key={curve.id}
                  abscissas={curve.abscissas}
                  ordinates={curve.ordinates}
                  color={curve.color}
                />
              ))}
              <TooltipMesh
                guides="both"
                renderTooltip={(x, y) => {
                  const closestCurve = findClosestCurve(waterfallCurves, x, y);
                  if (!closestCurve) return null;

                  const { xVal, yVal } = getClosestPoint(closestCurve, x);

                  return (
                    <StandardTooltip
                      label={closestCurve.label}
                      color={closestCurve.color}
                      xLabel={xAxisLabel.split(' ')[0]}
                      xValue={xVal}
                      yValue={yVal}
                    />
                  );
                }}
              />
            </VisCanvas>
          </div>
        ) : viewMode === 'heatmap' && heatmapData ? (
          <div className="w-full flex-1 h-0 flex flex-col">
            {/* Heatmap Toolbar */}
            <div className="shrink-0">
              <Toolbar>
                <DomainWidget
                  dataDomain={safeHeatmapDomain}
                  customDomain={customDomain}
                  scaleType={scaleType}
                  onCustomDomainChange={setCustomDomain}
                />
                <Separator />
                <ColorMapSelector
                  value={colorMap}
                  onValueChange={setColorMap}
                  invert={invertColorMap}
                  onInversionChange={() => setInvertColorMap(!invertColorMap)}
                />
                <Separator />
                <ScaleSelector
                  value={scaleType}
                  onScaleChange={handleScaleChange}
                  options={SCALE_OPTIONS}
                />
                <Separator />
                <ToggleBtn
                  label="Grid"
                  Icon={GridFourIcon}
                  value={showGrid}
                  onToggle={() => setShowGrid(!showGrid)}
                />
              </Toolbar>
            </div>

            {/* Heatmap Canvas */}
            <div className="flex-1 flex min-h-0 w-full">
              <VisCanvas
                abscissaConfig={{
                  visDomain: qDomain,
                  showGrid,
                  label: xAxisLabel,
                }}
                ordinateConfig={{
                  visDomain: [-0.5, heatmapData.shape[0] - 0.5],
                  showGrid: false,
                  label: 'Scan',
                  isIndexAxis: true,
                  formatTick: formatScanTick,
                }}
                aspect="auto"
              >
                <DefaultInteractions />
                <ResetZoomButton />
                {/* Custom horizontal grid lines between scan rows */}
                {showGrid && Array.from({ length: heatmapData.shape[0] + 1 }, (_, i) => {
                  const yPos = i - 0.5; // Grid lines at -0.5, 0.5, 1.5, ...
                  return (
                    <DataToHtml
                      key={`grid-h-${i}`}
                      points={[
                        new Vector3(qDomain[0], yPos),
                        new Vector3(qDomain[1], yPos),
                      ]}
                    >
                      {(p1, p2) => (
                        <SvgElement>
                          <line
                            x1={p1.x}
                            y1={p1.y}
                            x2={p2.x}
                            y2={p2.y}
                            stroke="gray"
                            strokeOpacity={0.33}
                            strokeWidth="1"
                          />
                        </SvgElement>
                      )}
                    </DataToHtml>
                  );
                })}
                <HeatmapMesh
                  values={heatmapData}
                  domain={customDomain[0] !== null || customDomain[1] !== null
                    ? [customDomain[0] ?? safeHeatmapDomain[0], customDomain[1] ?? safeHeatmapDomain[1]]
                    : safeHeatmapDomain
                  }
                  colorMap={colorMap}
                  scaleType={scaleType}
                  invertColorMap={invertColorMap}
                />
                <TooltipMesh
                  guides="both"
                  renderTooltip={(x, y) => {
                    // Convert q-value (x) to array index
                    const qRange = qDomain[1] - qDomain[0];
                    const xNormalized = (x - qDomain[0]) / qRange;
                    const xi = Math.floor(xNormalized * heatmapData.shape[1]);
                    const yi = Math.round(y);
                    if (xi < 0 || xi >= heatmapData.shape[1] || yi < 0 || yi >= heatmapData.shape[0]) {
                      return null;
                    }
                    const value = heatmapData.get(yi, xi);
                    const scanName = successfulResults[yi]?.scan_name ?? `Scan ${yi + 1}`;
                    return (
                      <div className="text-xs bg-white/90 p-1 rounded shadow">
                        <div className="font-medium">{scanName}</div>
                        <div>{xAxisLabel.split(' ')[0]}={x.toFixed(4)}</div>
                        <div className="font-semibold">{value?.toExponential(3)}</div>
                      </div>
                    );
                  }}
                />
              </VisCanvas>
            </div>

            {/* Color Bar - aligned with plot area */}
            <div
              className="shrink-0 h-12"
              style={{ paddingLeft: '104px', paddingRight: '24px' }}
            >
              <ColorBar
                domain={customDomain[0] !== null || customDomain[1] !== null
                  ? [customDomain[0] ?? safeHeatmapDomain[0], customDomain[1] ?? safeHeatmapDomain[1]]
                  : safeHeatmapDomain
                }
                scaleType={scaleType}
                colorMap={colorMap}
                invertColorMap={invertColorMap}
                horizontal
                withBounds
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
