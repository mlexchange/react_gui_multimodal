/**
 * BatchResultsOverlay - Modal for displaying batch processing results.
 *
 * Features:
 * - Toggle between Waterfall and Heatmap views
 * - H5Web LineVis for waterfall plots (multiple overlaid curves)
 * - H5Web HeatmapMesh for heatmap view
 * - Adjustable waterfall offset
 * - Export to CSV and JSON
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  LineVis,
  VisCanvas,
  HeatmapMesh,
  DefaultInteractions,
  ResetZoomButton,
  ScaleType,
  CurveType,
  Toolbar,
  Separator,
  DomainWidget,
  ColorMapSelector,
  ScaleSelector,
  ColorBar,
  getSafeDomain,
  TooltipMesh,
  type ColorMap,
  type CustomDomain,
  type AxisParams,
} from '@h5web/lib';
import ndarray from 'ndarray';
import {
  ChartLineIcon,
  GridFourIcon,
  DownloadSimpleIcon,
  XIcon,
} from '@phosphor-icons/react';
import { IconButton, NumberInput } from '@/components/ui';
import { LinecutResult, BatchOperationType } from './hooks/useBatchProcessing';
import { exportToCSV, exportToJSON, exportToTransposedCSV } from './utils/batchExport';

// Domain type
type Domain = [number, number];

// View mode type
type ViewMode = 'waterfall' | 'heatmap';

// Color scale type (matching H5WebScatterSubplot)
type ColorScaleType = ScaleType.Linear | ScaleType.Log | ScaleType.SymLog | ScaleType.Sqrt;

// Scale options for the ScaleSelector
const SCALE_OPTIONS: ColorScaleType[] = [
  ScaleType.Linear,
  ScaleType.Log,
  ScaleType.SymLog,
  ScaleType.Sqrt,
];

// Operation labels
const OPERATION_LABELS: Record<BatchOperationType, string> = {
  horizontal: 'Horizontal Linecut',
  vertical: 'Vertical Linecut',
  inclined: 'Inclined Linecut',
  azimuthal: 'Azimuthal Integration',
};

interface BatchResultsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  results: LinecutResult[];
  operationType: BatchOperationType;
  totalScans: number;
  successful: number;
  failed: number;
}

export function BatchResultsOverlay({
  isOpen,
  onClose,
  results,
  operationType,
  totalScans,
  successful,
  failed,
}: BatchResultsOverlayProps) {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('waterfall');
  const [waterfallOffset, setWaterfallOffset] = useState(100);
  const [colorMap, setColorMap] = useState<ColorMap>('Viridis');
  const [invertColorMap, setInvertColorMap] = useState(false);
  const [scaleType, setScaleType] = useState<ColorScaleType>(ScaleType.Linear);
  const [customDomain, setCustomDomain] = useState<CustomDomain>([null, null]);

  // Handler for waterfall offset changes (NumberInput returns string | number)
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

  // Container ref for visualization area
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter successful results
  const successfulResults = useMemo(
    () => results.filter(r => r.success),
    [results]
  );

  // Get q-values from first successful result (all should have same q-values)
  const qValues = useMemo(() => {
    if (successfulResults.length === 0) return [];
    return successfulResults[0].q_values;
  }, [successfulResults]);

  // Prepare data for H5Web LineVis (waterfall)
  const { primaryArray, auxiliaries, waterfallDomain, abscissaParams } = useMemo(() => {
    if (successfulResults.length === 0 || qValues.length === 0) {
      return {
        primaryArray: null,
        auxiliaries: [],
        waterfallDomain: [0, 1] as Domain,
        abscissaParams: { value: [] } as AxisParams,
      };
    }

    // Apply vertical offset to each trace
    const offsetResults = successfulResults.map((r, i) => ({
      ...r,
      offsetIntensities: r.intensities.map(v => v + i * waterfallOffset),
    }));

    // Primary = first result
    const primary = ndarray(
      new Float32Array(offsetResults[0].offsetIntensities),
      [offsetResults[0].offsetIntensities.length]
    );

    // Auxiliaries = remaining results
    const aux = offsetResults.slice(1).map(r => ({
      label: r.scan_name,
      array: ndarray(
        new Float32Array(r.offsetIntensities),
        [r.offsetIntensities.length]
      ),
    }));

    // Calculate domain across all offset data
    const allValues = offsetResults.flatMap(r => r.offsetIntensities);
    const validValues = allValues.filter(v => isFinite(v) && !isNaN(v));
    const min = validValues.length > 0 ? Math.min(...validValues) : 0;
    const max = validValues.length > 0 ? Math.max(...validValues) : 1;
    const padding = (max - min) * 0.05;

    // Abscissa params with q-values
    const abscissa: AxisParams = {
      value: qValues,
      label: 'q (nm⁻¹)',
    };

    return {
      primaryArray: primary,
      auxiliaries: aux,
      waterfallDomain: [min - padding, max + padding] as Domain,
      abscissaParams: abscissa,
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
  const safeHeatmapDomain = useMemo((): Domain => {
    const [dataMin, dataMax] = heatmapDomain;

    if (scaleType === ScaleType.Linear || scaleType === ScaleType.SymLog) {
      return heatmapDomain;
    }

    // Log/Sqrt require positive values
    const safeMax = dataMax > 0 ? dataMax : 1;
    const safeMin = dataMin > 0 ? dataMin : Math.min(1e-10, safeMax * 0.01);
    const fallbackDomain: Domain = [safeMin, safeMax];

    const [safeDomain] = getSafeDomain(heatmapDomain, fallbackDomain, scaleType);
    return safeDomain;
  }, [heatmapDomain, scaleType]);

  // Export handlers
  const handleExportCSV = useCallback(() => {
    exportToCSV(results, operationType);
  }, [results, operationType]);

  const handleExportJSON = useCallback(() => {
    exportToJSON(results, operationType);
  }, [results, operationType]);

  const handleExportTransposedCSV = useCallback(() => {
    exportToTransposedCSV(results, operationType);
  }, [results, operationType]);

  if (!isOpen) return null;

  const operationLabel = OPERATION_LABELS[operationType];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <ChartLineIcon size={20} className="text-sky-600" />
            <h3 className="text-lg font-semibold text-sky-950">
              Batch Results: {operationLabel}
            </h3>
          </div>
          <IconButton variant="subtle" size="md" onClick={onClose}>
            <XIcon size={20} />
          </IconButton>
        </div>

        {/* Summary & Controls */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-4">
            {/* Summary */}
            <span className="text-sm text-gray-600">
              {totalScans} scans: {successful} successful, {failed} failed
            </span>

            {/* View Toggle */}
            <div className="flex rounded-md overflow-hidden border border-gray-300">
              <button
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${
                  viewMode === 'waterfall'
                    ? 'bg-sky-100 text-sky-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => setViewMode('waterfall')}
              >
                <ChartLineIcon size={16} />
                Waterfall
              </button>
              <button
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 border-l border-gray-300 ${
                  viewMode === 'heatmap'
                    ? 'bg-sky-100 text-sky-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => setViewMode('heatmap')}
              >
                <GridFourIcon size={16} />
                Heatmap
              </button>
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

          {/* Export buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              title="Export to CSV"
            >
              <DownloadSimpleIcon size={16} />
              CSV
            </button>
            <button
              onClick={handleExportTransposedCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              title="Export to transposed CSV (rows=q, cols=scans)"
            >
              <DownloadSimpleIcon size={16} />
              CSV (T)
            </button>
            <button
              onClick={handleExportJSON}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              title="Export to JSON"
            >
              <DownloadSimpleIcon size={16} />
              JSON
            </button>
          </div>
        </div>

        {/* Visualization Area */}
        <div ref={containerRef} className="flex-1 min-h-0 p-4 flex flex-col">
          {successfulResults.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No successful results to display
            </div>
          ) : viewMode === 'waterfall' && primaryArray ? (
            <div className="w-full flex-1 h-0 flex flex-col">
              <LineVis
                dataArray={primaryArray}
                auxiliaries={auxiliaries}
                domain={waterfallDomain}
                scaleType={ScaleType.Linear}
                abscissaParams={abscissaParams}
                ordinateLabel="Intensity (offset)"
                curveType={CurveType.LineOnly}
                showGrid={true}
              />
            </div>
          ) : viewMode === 'heatmap' && heatmapData ? (
            <div className="w-full flex-1 min-h-0 flex flex-col">
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
              </Toolbar>
              </div>

              {/* Heatmap Canvas */}
              <div className="flex-1 min-h-0 flex">
                <VisCanvas
                  abscissaConfig={{
                    visDomain: [0, heatmapData.shape[1]],
                    showGrid: true,
                    label: 'q index',
                  }}
                  ordinateConfig={{
                    visDomain: [0, heatmapData.shape[0]],
                    showGrid: true,
                    label: 'Scan index',
                  }}
                  aspect="auto"
                >
                  <DefaultInteractions />
                  <ResetZoomButton />
                  <HeatmapMesh
                    values={heatmapData}
                    domain={customDomain[0] !== null || customDomain[1] !== null
                      ? [customDomain[0] ?? safeHeatmapDomain[0], customDomain[1] ?? safeHeatmapDomain[1]]
                      : safeHeatmapDomain
                    }
                    colorMap={colorMap}
                    scaleType={scaleType}
                  />
                  <TooltipMesh
                    guides="both"
                    renderTooltip={(x, y) => {
                      const xi = Math.floor(x);
                      const yi = Math.floor(y);
                      if (xi < 0 || xi >= heatmapData.shape[1] || yi < 0 || yi >= heatmapData.shape[0]) {
                        return null;
                      }
                      const value = heatmapData.get(yi, xi);
                      const scanName = successfulResults[yi]?.scan_name ?? `Scan ${yi}`;
                      const qVal = qValues[xi]?.toFixed(4) ?? xi;
                      return (
                        <div className="text-xs bg-white/90 p-1 rounded shadow">
                          <div className="font-medium">{scanName}</div>
                          <div>q={qVal}</div>
                          <div className="font-semibold">{value?.toExponential(3)}</div>
                        </div>
                      );
                    }}
                  />
                </VisCanvas>
              </div>

              {/* Color Bar */}
              <div className="shrink-0 h-12 px-16">
                <ColorBar
                  domain={customDomain[0] !== null || customDomain[1] !== null
                    ? [customDomain[0] ?? safeHeatmapDomain[0], customDomain[1] ?? safeHeatmapDomain[1]]
                    : safeHeatmapDomain
                  }
                  scaleType={scaleType}
                  colorMap={colorMap}
                  invertColorMap={invertColorMap}
                  withBounds
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
