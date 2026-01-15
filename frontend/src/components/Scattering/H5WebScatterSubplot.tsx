import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  VisCanvas,
  HeatmapMesh,
  DefaultInteractions,
  ResetZoomButton,
  ScaleType,
  Toolbar,
  Separator,
  DomainWidget,
  ColorMapSelector,
  ScaleSelector,
  ToggleBtn,
  ColorBar,
  getSafeDomain,
  SnapshotBtn,
  TooltipMesh,
  SvgElement,
  DataToHtml,
  type ColorMap,
  type CustomDomain,
} from '@h5web/lib';
import { Vector3 } from 'three';
import { AzimuthalSectorOverlay } from './utils/generateOverlays';
import ndarray, { NdArray } from 'ndarray';
import {
  ArrowsHorizontalIcon,
  ArrowsVerticalIcon,
  GridFourIcon,
  StackIcon,
  ChartLineIcon,
} from '@phosphor-icons/react';

// Domain type for heatmap visualization
type Domain = [number, number];

// Format tick as integer (no scientific notation)
const formatTickAsInteger = (val: number): string => {
  return Math.round(val).toLocaleString('en-US', { useGrouping: false });
};

// h5web axis offset constants (from h5web/packages/lib/src/vis/utils.ts)
// With labels: left = 80 (ticks) + 24 (label) = 104, right = 24
const AXIS_LEFT_OFFSET = 104;  // px for y-axis ticks + label
const AXIS_RIGHT_OFFSET = 24;  // px for right padding

// Color scale type (Linear, Log, SymLog, Sqrt - Gamma requires separate handling)
type ColorScaleType = ScaleType.Linear | ScaleType.Log | ScaleType.SymLog | ScaleType.Sqrt;

// Linecut overlay component - renders horizontal/vertical linecut bands and center lines
interface LinecutOverlayProps {
  linecuts: Array<{
    position: number;  // pixel position
    width: number;     // width in pixels
    color: string;
    type: 'horizontal' | 'vertical';
    hidden?: boolean;
  }>;
  rows: number;
  cols: number;
}

const LinecutOverlay: React.FC<LinecutOverlayProps> = ({
  linecuts,
  rows,
  cols,
}) => {
  const visibleLinecuts = linecuts.filter(lc => !lc.hidden);

  if (visibleLinecuts.length === 0) return null;

  return (
    <>
      {visibleLinecuts.map((linecut, index) => {
        const { position, width, color, type } = linecut;
        const halfWidth = width / 2;

        if (type === 'horizontal') {
          // Horizontal linecut: band spans full width, at y=position
          const yTop = Math.max(0, position - halfWidth);
          const yBottom = Math.min(rows, position + halfWidth);

          return (
            <DataToHtml
              key={`h-linecut-${index}`}
              points={[
                new Vector3(0, yTop),
                new Vector3(cols, yTop),
                new Vector3(cols, yBottom),
                new Vector3(0, yBottom),
                new Vector3(0, position),
                new Vector3(cols, position),
              ]}
            >
              {(p0, p1, p2, p3, lineStart, lineEnd) => (
                <SvgElement>
                  {/* Width band with transparency - opacity 0.3 matching Plotly */}
                  {width > 0 && (
                    <polygon
                      points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
                      fill={color}
                      fillOpacity={0.3}
                      stroke="none"
                    />
                  )}
                  {/* Center line - opacity 0.75, width 1 matching Plotly */}
                  <line
                    x1={lineStart.x}
                    y1={lineStart.y}
                    x2={lineEnd.x}
                    y2={lineEnd.y}
                    stroke={color}
                    strokeWidth={1}
                    strokeOpacity={0.75}
                  />
                </SvgElement>
              )}
            </DataToHtml>
          );
        } else {
          // Vertical linecut: band spans full height, at x=position
          const xLeft = Math.max(0, position - halfWidth);
          const xRight = Math.min(cols, position + halfWidth);

          return (
            <DataToHtml
              key={`v-linecut-${index}`}
              points={[
                new Vector3(xLeft, 0),
                new Vector3(xRight, 0),
                new Vector3(xRight, rows),
                new Vector3(xLeft, rows),
                new Vector3(position, 0),
                new Vector3(position, rows),
              ]}
            >
              {(p0, p1, p2, p3, lineStart, lineEnd) => (
                <SvgElement>
                  {/* Width band with transparency - opacity 0.3 matching Plotly */}
                  {width > 0 && (
                    <polygon
                      points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
                      fill={color}
                      fillOpacity={0.3}
                      stroke="none"
                    />
                  )}
                  {/* Center line - opacity 0.75, width 1 matching Plotly */}
                  <line
                    x1={lineStart.x}
                    y1={lineStart.y}
                    x2={lineEnd.x}
                    y2={lineEnd.y}
                    stroke={color}
                    strokeWidth={1}
                    strokeOpacity={0.75}
                  />
                </SvgElement>
              )}
            </DataToHtml>
          );
        }
      })}
    </>
  );
};

// Inclined linecut overlay component
interface InclinedLinecutOverlayProps {
  linecuts: Array<{
    angle: number;
    qWidth: number;
    color: string;
    hidden?: boolean;
  }>;
  rows: number;
  cols: number;
  beamCenterX: number;
  beamCenterY: number;
  pixelWidthCalculator: (qWidth: number) => number;
}

// Sutherland-Hodgman polygon clipping helper functions
const clipPolygonToImageBoundaries = (
  points: Array<{ x: number; y: number }>,
  imageWidth: number,
  imageHeight: number
): Array<{ x: number; y: number }> => {
  if (points.length < 3) return points;

  const isInside = (p: { x: number; y: number }, edge: { x1: number; y1: number; x2: number; y2: number }) => {
    const dx = edge.x2 - edge.x1;
    const dy = edge.y2 - edge.y1;
    const cross = (p.x - edge.x1) * dy - (p.y - edge.y1) * dx;
    return cross <= 0;
  };

  const getIntersection = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    edge: { x1: number; y1: number; x2: number; y2: number }
  ) => {
    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;
    const dx2 = edge.x2 - edge.x1;
    const dy2 = edge.y2 - edge.y1;
    const det = dx1 * dy2 - dy1 * dx2;
    if (det === 0) return { x: edge.x1, y: edge.y1 };
    const t = ((edge.x1 - p1.x) * dy2 - (edge.y1 - p1.y) * dx2) / det;
    return { x: p1.x + t * dx1, y: p1.y + t * dy1 };
  };

  const edges = [
    { x1: 0, y1: 0, x2: imageWidth, y2: 0 },
    { x1: imageWidth, y1: 0, x2: imageWidth, y2: imageHeight },
    { x1: imageWidth, y1: imageHeight, x2: 0, y2: imageHeight },
    { x1: 0, y1: imageHeight, x2: 0, y2: 0 },
  ];

  let clipped = [...points, points[0]]; // Close polygon

  for (const edge of edges) {
    const input = clipped;
    clipped = [];

    for (let i = 0; i < input.length - 1; i++) {
      const current = input[i];
      const next = input[i + 1];
      const currentInside = isInside(current, edge);
      const nextInside = isInside(next, edge);

      if (currentInside && nextInside) {
        clipped.push(next);
      } else if (currentInside && !nextInside) {
        clipped.push(getIntersection(current, next, edge));
      } else if (!currentInside && nextInside) {
        clipped.push(getIntersection(current, next, edge));
        clipped.push(next);
      }
    }

    if (clipped.length > 0) {
      clipped.push(clipped[0]); // Close polygon
    }
    if (clipped.length < 3) return [];
  }

  return clipped.slice(0, -1); // Remove closing point
};

const InclinedLinecutOverlay: React.FC<InclinedLinecutOverlayProps> = ({
  linecuts,
  rows,
  cols,
  beamCenterX,
  beamCenterY,
  pixelWidthCalculator,
}) => {
  const visibleLinecuts = linecuts.filter(lc => !lc.hidden);

  if (visibleLinecuts.length === 0) return null;

  return (
    <>
      {visibleLinecuts.map((linecut, index) => {
        const { angle, qWidth, color } = linecut;

        // Calculate endpoints using the same function as Plotly implementation
        const endpoints = calculateInclinedLineEndpoints({
          linecut: { angle } as InclinedLinecut,
          imageWidth: cols,
          imageHeight: rows,
          beam_center_x: beamCenterX,
          beam_center_y: beamCenterY,
          factor: 1, // No scaling factor needed - we're working in full resolution
        });

        if (!endpoints) return null;
        const { x0, y0, x1, y1 } = endpoints;

        // Calculate perpendicular vector for width envelope
        const radians = (angle * Math.PI) / 180;
        const dx = Math.cos(radians);
        const dy = -Math.sin(radians);
        const perpDx = -dy;
        const perpDy = dx;

        // Calculate pixel width from q-space width
        const pixelWidth = pixelWidthCalculator(qWidth);
        const halfWidthPixels = pixelWidth / 2;

        // Calculate envelope corners and clip to image boundaries
        const rawEnvelope = [
          { x: x0 + perpDx * halfWidthPixels, y: y0 + perpDy * halfWidthPixels },
          { x: x1 + perpDx * halfWidthPixels, y: y1 + perpDy * halfWidthPixels },
          { x: x1 - perpDx * halfWidthPixels, y: y1 - perpDy * halfWidthPixels },
          { x: x0 - perpDx * halfWidthPixels, y: y0 - perpDy * halfWidthPixels },
        ];

        const clippedEnvelope = clipPolygonToImageBoundaries(rawEnvelope, cols, rows);

        // Beam center position
        const beamX = beamCenterX;
        const beamY = beamCenterY;

        // Build points array for DataToHtml
        const dataPoints = [
          new Vector3(x0, y0),
          new Vector3(x1, y1),
          new Vector3(beamX, beamY),
          ...clippedEnvelope.map(p => new Vector3(p.x, p.y)),
        ];

        return (
          <DataToHtml
            key={`inclined-linecut-${index}`}
            points={dataPoints}
          >
            {(...htmlPoints) => {
              const [lineStart, lineEnd, center, ...envPoints] = htmlPoints;
              return (
                <SvgElement>
                  {/* Clipped width envelope - opacity 0.3 matching Plotly */}
                  {qWidth > 0 && envPoints.length >= 3 && (
                    <polygon
                      points={envPoints.map(p => `${p.x},${p.y}`).join(' ')}
                      fill={color}
                      fillOpacity={0.3}
                      stroke="none"
                    />
                  )}
                  {/* Central line - opacity 0.75, width 2 matching Plotly */}
                  <line
                    x1={lineStart.x}
                    y1={lineStart.y}
                    x2={lineEnd.x}
                    y2={lineEnd.y}
                    stroke={color}
                    strokeWidth={2}
                    strokeOpacity={0.75}
                  />
                  {/* Beam center marker - size ~10px, opacity 0.75 matching Plotly */}
                  <circle
                    cx={center.x}
                    cy={center.y}
                    r={5}
                    fill={color}
                    fillOpacity={0.75}
                  />
                </SvgElement>
              );
            }}
          </DataToHtml>
        );
      })}
    </>
  );
};

// Loading overlay component
const LoadingOverlay: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
    <div className="bg-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      <span className="text-gray-700 text-sm">{message}</span>
    </div>
  </div>
);

// Reusable heatmap panel component
interface HeatmapPanelProps {
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
  inclinedPixelWidthCalculator?: (qWidth: number) => number;
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
}

const HeatmapPanel: React.FC<HeatmapPanelProps> = ({
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
  // This ensures the image displays correctly and overlays align properly
  // For q-space display, we use formatTick to show q-values at each pixel position
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
      {isLoading && <LoadingOverlay message={loadingMessage} />}
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
import { notifications } from '@/components/ui';
import {
  TransformDataFunction,
  CalibrationParams,
  Linecut,
  InclinedLinecut,
  AzimuthalIntegration,
  AzimuthalData,
  OperationType,
} from './types';
import { getArrayMinMax } from './utils/getArrayMinAndMax';
import { calculateDifferenceArray } from './utils/calculateDifferenceArray';
import { calculateDivisionArray } from './utils/calculateDivisionArray';
import { fetchWithCache } from './services/scatteringImageCache';
import { calculateInclinedLineEndpoints } from './utils/calculateInclinedLinecutEndpoints';

// Props interface - same as ScatterSubplot for compatibility
interface H5WebScatterSubplotProps {
  operationType: OperationType;
  setOperationType: (value: OperationType) => void;
  setImageHeight: (height: number) => void;
  setImageWidth: (width: number) => void;
  setImageData1: (data: number[][]) => void;
  setImageData2: (data: number[][]) => void;
  horizontalLinecuts: Linecut[];
  verticalLinecuts: Linecut[];
  inclinedLinecuts: InclinedLinecut[];
  leftImageColorPalette: string[];
  rightImageColorPalette: string[];
  setZoomedXPixelRange: (range: [number, number] | null) => void;
  setZoomedYPixelRange: (range: [number, number] | null) => void;
  setResolutionMessage: (message: string) => void;
  isLogScale: boolean;
  lowerPercentile: number;
  upperPercentile: number;
  normalization: string;
  imageColormap: string;
  differenceColormap: string;
  normalizationMode: string;
  azimuthalIntegrations: AzimuthalIntegration[];
  azimuthalData1: AzimuthalData[];  // Kept for backward compatibility
  azimuthalData2: AzimuthalData[];  // Kept for backward compatibility
  qMagnitudeMatrix?: number[][] | null;  // Cached Q-magnitude matrix for overlay rendering
  maxQValue: number;
  calibrationParams: CalibrationParams | null;
  qYMatrix: number[][];
  qXMatrix: number[][];
  units: string;
  mainTransformDataFunction: TransformDataFunction;
  leftImageIndex?: number | "";
  rightImageIndex?: number | "";
  scanUris?: string[];
  imageNames?: string[];
  isLoadingImages?: boolean;
  setIsLoadingImages?: (isLoading: boolean) => void;
  leftHeader?: React.ReactNode;
  rightHeader?: React.ReactNode;
  comparisonHeader?: React.ReactNode;
  maskUri?: string | null;
  experimentType?: string;
  showQSpaceAxes: boolean;
  setShowQSpaceAxes: (value: boolean) => void;
}

// Convert 2D number array to ndarray
const arrayToNdarray = (arr: number[][]): NdArray<Float32Array> | null => {
  if (!arr || arr.length === 0 || !arr[0] || arr[0].length === 0) {
    return null;
  }
  const height = arr.length;
  const width = arr[0].length;
  const flat = new Float32Array(height * width);
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      flat[i * width + j] = arr[i][j];
    }
  }
  return ndarray(flat, [height, width]);
};

// Map colormap names (Plotly to h5web)
// h5web uses: 'Viridis', 'Inferno', 'RdBu', etc.
const mapColormap = (plotlyColormap: string): ColorMap => {
  const map: Record<string, ColorMap> = {
    'viridis': 'Viridis',
    'Viridis': 'Viridis',
    'inferno': 'Inferno',
    'Inferno': 'Inferno',
    'plasma': 'Plasma',
    'Plasma': 'Plasma',
    'magma': 'Magma',
    'Magma': 'Magma',
    'hot': 'Inferno',  // h5web doesn't have 'Hot', use Inferno instead
    'Hot': 'Inferno',
    'RdBu': 'RdBu',
    'rdbu': 'RdBu',
    'Greys': 'Greys',
    'greys': 'Greys',
    'turbo': 'Turbo',
    'Turbo': 'Turbo',
  };
  return map[plotlyColormap] || 'Viridis';
};

// Scale types for the ScaleSelector (excluding Gamma which needs special handling)
const SCALE_OPTIONS: ColorScaleType[] = [
  ScaleType.Linear,
  ScaleType.Log,
  ScaleType.SymLog,
  ScaleType.Sqrt,
];

const H5WebScatterSubplot: React.FC<H5WebScatterSubplotProps> = React.memo(({
  operationType,
  setImageHeight,
  setImageWidth,
  setImageData1,
  setImageData2,
  horizontalLinecuts,
  verticalLinecuts,
  inclinedLinecuts,
  azimuthalIntegrations,
  qMagnitudeMatrix,
  calibrationParams,
  maxQValue,
  qYMatrix,
  qXMatrix,
  isLogScale,
  lowerPercentile,
  upperPercentile,
  normalization,
  imageColormap,
  differenceColormap,
  normalizationMode,
  mainTransformDataFunction,
  leftImageIndex,
  rightImageIndex,
  scanUris,
  isLoadingImages,
  setIsLoadingImages,
  leftHeader,
  rightHeader,
  comparisonHeader,
  maskUri,
  experimentType = 'SAXS',
  showQSpaceAxes,
  setShowQSpaceAxes,
}) => {
  // Raw data from fetch
  const [leftArray, setLeftArray] = useState<number[][]>([]);
  const [rightArray, setRightArray] = useState<number[][]>([]);

  // Toolbar state
  const [scaleType, setScaleType] = useState<ColorScaleType>(
    isLogScale ? ScaleType.Log : ScaleType.Linear
  );
  const [colorMap, setColorMap] = useState<ColorMap>(
    mapColormap(imageColormap)
  );
  const [diffColorMap, setDiffColorMap] = useState<ColorMap>(
    mapColormap(differenceColormap)
  );
  const [invertColorMap, setInvertColorMap] = useState(false);
  const [invertDiffColorMap, setInvertDiffColorMap] = useState(false);
  const [flipXAxis, setFlipXAxis] = useState(false);
  const [flipYAxis, setFlipYAxis] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showOverlays, setShowOverlays] = useState(true);
  const [customDomain, setCustomDomain] = useState<CustomDomain>([null, null]);

  // Determine if q-space toggle is enabled (calibration must be set with valid q-matrices)
  const canToggleQSpace = useMemo(() => {
    if (!qXMatrix?.length || !qYMatrix?.length) return false;
    if (!qXMatrix[0]?.length || !qYMatrix[0]?.length) return false;
    const qxValue = qXMatrix[0][0];
    const qyValue = qYMatrix[0][0];
    return isFinite(qxValue) && isFinite(qyValue);
  }, [qXMatrix, qYMatrix]);

  // Handler for scale type changes (type-safe wrapper)
  const handleScaleChange = useCallback((newScale: ColorScaleType) => {
    setScaleType(newScale);
  }, []);

  // Calculate result based on operation type
  const calculateResult = useCallback((array1: number[][], array2: number[][]) => {
    if (operationType === 'subtract') {
      return calculateDifferenceArray(array1, array2);
    } else {
      return calculateDivisionArray(array1, array2);
    }
  }, [operationType]);

  // Fetch images when indices change
  useEffect(() => {
    if (typeof leftImageIndex !== 'number' || typeof rightImageIndex !== 'number') {
      return;
    }

    if (!scanUris || scanUris.length === 0) {
      return;
    }

    const leftScanUri = scanUris[leftImageIndex];
    const rightScanUri = scanUris[rightImageIndex];

    if (!leftScanUri || !rightScanUri) {
      console.error('Scan URIs not found for selected indices');
      return;
    }

    setIsLoadingImages?.(true);

    Promise.all([
      fetchWithCache(leftScanUri, maskUri),
      fetchWithCache(rightScanUri, maskUri)
    ])
      .then(([leftProcessed, rightProcessed]) => {
        // Use full resolution data
        const fullArray1 = leftProcessed.full.array;
        const fullArray2 = rightProcessed.full.array;

        // Set dimensions and full resolution data for linecuts
        setImageHeight(fullArray1.length);
        setImageWidth(fullArray1[0].length);
        setImageData1(fullArray1);
        setImageData2(fullArray2);

        // Store raw arrays
        setLeftArray(fullArray1);
        setRightArray(fullArray2);

        setIsLoadingImages?.(false);
        notifications.hide('loading-images');
      })
      .catch(error => {
        console.error("Error fetching scatter subplot:", error);
        setIsLoadingImages?.(false);
        notifications.update({
          id: 'loading-images',
          color: 'red',
          title: 'Error loading images',
          message: error instanceof Error ? error.message : 'Failed to load images',
          autoClose: 5000,
        });
      });
  }, [
    leftImageIndex,
    rightImageIndex,
    scanUris,
    setImageHeight,
    setImageWidth,
    setImageData1,
    setImageData2,
    setIsLoadingImages,
    maskUri,
  ]);

  // Transform data based on settings
  const transformedData = useMemo(() => {
    if (leftArray.length === 0 || rightArray.length === 0) {
      return null;
    }

    const { array1, array2 } = mainTransformDataFunction(
      leftArray,
      rightArray,
      isLogScale,
      lowerPercentile,
      upperPercentile,
      normalization,
      normalizationMode
    );

    const diff = calculateResult(array1, array2);

    return { array1, array2, diff };
  }, [
    leftArray,
    rightArray,
    isLogScale,
    lowerPercentile,
    upperPercentile,
    normalization,
    normalizationMode,
    mainTransformDataFunction,
    calculateResult,
  ]);

  // Convert arrays to ndarrays
  const leftNdarray = useMemo(() => {
    return transformedData ? arrayToNdarray(transformedData.array1) : null;
  }, [transformedData]);

  const rightNdarray = useMemo(() => {
    return transformedData ? arrayToNdarray(transformedData.array2) : null;
  }, [transformedData]);

  const diffNdarray = useMemo(() => {
    return transformedData ? arrayToNdarray(transformedData.diff) : null;
  }, [transformedData]);

  // Calculate shared domain for left/right images
  const sharedDomain = useMemo((): Domain | undefined => {
    if (!transformedData) return undefined;

    const [min1, max1] = getArrayMinMax(transformedData.array1);
    const [min2, max2] = getArrayMinMax(transformedData.array2);
    const globalMin = Math.min(min1, min2);
    const globalMax = Math.max(max1, max2);

    return [globalMin, globalMax];
  }, [transformedData]);

  // Make domain safe for the current scale type using h5web's getSafeDomain
  const safeSharedDomain = useMemo((): Domain | undefined => {
    if (!sharedDomain) return undefined;

    // For Linear/SymLog, use original domain as-is (they support negative values)
    if (scaleType === ScaleType.Linear || scaleType === ScaleType.SymLog) {
      return sharedDomain;
    }

    // For Log/Sqrt, create a fallback that preserves positive values
    const [dataMin, dataMax] = sharedDomain;

    // If max is positive, preserve it; otherwise use a small default
    const safeMax = dataMax > 0 ? dataMax : 1;
    // Min should be positive and less than max
    const safeMin = dataMin > 0 ? dataMin : Math.min(1e-10, safeMax * 0.01);
    const fallbackDomain: Domain = [safeMin, safeMax];

    const [safeDomain] = getSafeDomain(sharedDomain, fallbackDomain, scaleType);
    return safeDomain;
  }, [sharedDomain, scaleType]);

  // Calculate symmetric domain for comparison (centered at 0)
  const comparisonDomain = useMemo((): [number, number] | undefined => {
    if (!transformedData) return undefined;

    const [minDiff, maxDiff] = getArrayMinMax(transformedData.diff);
    const maxAbs = Math.max(Math.abs(minDiff), Math.abs(maxDiff));

    return [-maxAbs, maxAbs];
  }, [transformedData]);

  // Calculate pixel width using local q-to-pixel scale (not affected by edge clamping)
  const calculateLocalPixelWidth = useCallback((
    qWidth: number,
    qMatrix: number[][],
    direction: 'horizontal' | 'vertical'
  ): number => {
    if (qWidth <= 0 || !qMatrix || qMatrix.length === 0) return 0;
    if (!qMatrix[0] || qMatrix[0].length === 0) return 0;

    // Calculate average q-to-pixel ratio from the center of the image
    // This gives a consistent width regardless of position
    if (direction === 'horizontal') {
      const rows = qMatrix.length;
      if (rows < 2) return 0;
      // Use middle portion of the image to calculate q-per-pixel
      const midRow = Math.floor(rows / 2);
      const startRow = Math.max(0, midRow - 10);
      const endRow = Math.min(rows - 1, midRow + 10);
      const qRange = Math.abs(qMatrix[endRow][0] - qMatrix[startRow][0]);
      const pixelRange = endRow - startRow;
      if (pixelRange === 0 || qRange === 0) return 0;
      const qPerPixel = qRange / pixelRange;
      return Math.abs(qWidth / qPerPixel);
    } else {
      const cols = qMatrix[0].length;
      if (cols < 2) return 0;
      // Use middle portion of the image to calculate q-per-pixel
      const midCol = Math.floor(cols / 2);
      const startCol = Math.max(0, midCol - 10);
      const endCol = Math.min(cols - 1, midCol + 10);
      const qRange = Math.abs(qMatrix[0][endCol] - qMatrix[0][startCol]);
      const pixelRange = endCol - startCol;
      if (pixelRange === 0 || qRange === 0) return 0;
      const qPerPixel = qRange / pixelRange;
      return Math.abs(qWidth / qPerPixel);
    }
  }, []);

  // Transform linecuts to overlay format for left image
  const leftImageLinecuts = useMemo(() => {
    const linecuts: LinecutOverlayProps['linecuts'] = [];

    // Add horizontal linecuts (use qYMatrix for width calculation)
    horizontalLinecuts.forEach(lc => {
      const pixelWidth = calculateLocalPixelWidth(lc.width, qYMatrix, 'horizontal');
      linecuts.push({
        position: lc.pixelPosition,
        width: pixelWidth,
        color: lc.leftColor,
        type: 'horizontal',
        hidden: lc.hidden,
      });
    });

    // Add vertical linecuts (use qXMatrix for width calculation)
    verticalLinecuts.forEach(lc => {
      const pixelWidth = calculateLocalPixelWidth(lc.width, qXMatrix, 'vertical');
      linecuts.push({
        position: lc.pixelPosition,
        width: pixelWidth,
        color: lc.leftColor,
        type: 'vertical',
        hidden: lc.hidden,
      });
    });

    return linecuts;
  }, [horizontalLinecuts, verticalLinecuts, qYMatrix, qXMatrix, calculateLocalPixelWidth]);

  // Transform linecuts to overlay format for right image
  const rightImageLinecuts = useMemo(() => {
    const linecuts: LinecutOverlayProps['linecuts'] = [];

    // Add horizontal linecuts (use qYMatrix for width calculation)
    horizontalLinecuts.forEach(lc => {
      const pixelWidth = calculateLocalPixelWidth(lc.width, qYMatrix, 'horizontal');
      linecuts.push({
        position: lc.pixelPosition,
        width: pixelWidth,
        color: lc.rightColor,
        type: 'horizontal',
        hidden: lc.hidden,
      });
    });

    // Add vertical linecuts (use qXMatrix for width calculation)
    verticalLinecuts.forEach(lc => {
      const pixelWidth = calculateLocalPixelWidth(lc.width, qXMatrix, 'vertical');
      linecuts.push({
        position: lc.pixelPosition,
        width: pixelWidth,
        color: lc.rightColor,
        type: 'vertical',
        hidden: lc.hidden,
      });
    });

    return linecuts;
  }, [horizontalLinecuts, verticalLinecuts, qYMatrix, qXMatrix, calculateLocalPixelWidth]);

  // Calculate inclined linecut pixel width using average of both q-matrices
  const calculateInclinedPixelWidth = useCallback((qWidth: number): number => {
    // Use average of horizontal and vertical pixel widths for inclined linecuts
    const hPixelWidth = calculateLocalPixelWidth(qWidth, qYMatrix, 'horizontal');
    const vPixelWidth = calculateLocalPixelWidth(qWidth, qXMatrix, 'vertical');
    return (hPixelWidth + vPixelWidth) / 2;
  }, [calculateLocalPixelWidth, qYMatrix, qXMatrix]);

  // Transform inclined linecuts to overlay format for left image
  const leftInclinedLinecuts = useMemo(() => {
    return inclinedLinecuts.map(lc => ({
      angle: lc.angle,
      qWidth: lc.qWidth,
      color: lc.leftColor,
      hidden: lc.hidden,
    }));
  }, [inclinedLinecuts]);

  // Transform inclined linecuts to overlay format for right image
  const rightInclinedLinecuts = useMemo(() => {
    return inclinedLinecuts.map(lc => ({
      angle: lc.angle,
      qWidth: lc.qWidth,
      color: lc.rightColor,
      hidden: lc.hidden,
    }));
  }, [inclinedLinecuts]);

  // Transform azimuthal integrations to overlay format for left image
  const leftAzimuthalIntegrations = useMemo(() => {
    return azimuthalIntegrations.map((int) => ({
      qRange: int.qRange,
      azimuthRange: int.azimuthRange,
      color: int.leftColor,
      hidden: int.hidden,
    }));
  }, [azimuthalIntegrations]);

  // Transform azimuthal integrations to overlay format for right image
  const rightAzimuthalIntegrations = useMemo(() => {
    return azimuthalIntegrations.map((int) => ({
      qRange: int.qRange,
      azimuthRange: int.azimuthRange,
      color: int.rightColor,
      hidden: int.hidden,
    }));
  }, [azimuthalIntegrations]);

  // No data selected state - show message like ScatterSubplot
  const hasValidIndices = typeof leftImageIndex === 'number' && typeof rightImageIndex === 'number';
  const hasData = leftNdarray && rightNdarray && diffNdarray && safeSharedDomain && comparisonDomain;

  if (!hasValidIndices) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <div className="text-center p-8">
          <p className="text-xl text-gray-600 mb-2">No data loaded</p>
          <p className="text-sm text-gray-500">Please select a Tiled container using the "Select Data" button above</p>
        </div>
      </div>
    );
  }

  // Loading state - data is being fetched
  if (!hasData) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <div className="text-center p-8 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-base text-gray-600">Loading images...</p>
        </div>
      </div>
    );
  }

  // Get image dimensions for axis config
  const leftRows = leftNdarray.shape[0];
  const leftCols = leftNdarray.shape[1];

  // Comparison label based on operation type
  const comparisonLabel = operationType === 'subtract' ? 'Difference' : 'Ratio';

  // Compute effective domain based on customDomain and safeSharedDomain
  const effectiveDomain: Domain = [
    customDomain[0] ?? safeSharedDomain[0],
    customDomain[1] ?? safeSharedDomain[1],
  ];

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      {/* Toolbar - shrink-0 ensures it only takes needed height */}
      <div className="shrink-0">
        <Toolbar>
        <DomainWidget
          dataDomain={safeSharedDomain}
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

        <ColorMapSelector
          value={diffColorMap}
          onValueChange={setDiffColorMap}
          invert={invertDiffColorMap}
          onInversionChange={() => setInvertDiffColorMap(!invertDiffColorMap)}
        />
        <Separator />

        <ScaleSelector
          value={scaleType}
          onScaleChange={handleScaleChange}
          options={SCALE_OPTIONS}
        />
        <Separator />

        <ToggleBtn
          label="Flip X"
          Icon={ArrowsHorizontalIcon}
          value={flipXAxis}
          onToggle={() => setFlipXAxis(!flipXAxis)}
        />
        <ToggleBtn
          label="Flip Y"
          Icon={ArrowsVerticalIcon}
          value={flipYAxis}
          onToggle={() => setFlipYAxis(!flipYAxis)}
        />

        <ToggleBtn
          label="Grid"
          Icon={GridFourIcon}
          value={showGrid}
          onToggle={() => setShowGrid(!showGrid)}
        />

        <ToggleBtn
          label="Overlays"
          Icon={StackIcon}
          value={showOverlays}
          onToggle={() => setShowOverlays(!showOverlays)}
        />
        <Separator />

        <ToggleBtn
          label="Q-Space"
          Icon={ChartLineIcon}
          value={showQSpaceAxes}
          onToggle={() => setShowQSpaceAxes(!showQSpaceAxes)}
          disabled={!canToggleQSpace}
        />
        <Separator />

        <SnapshotBtn />
        </Toolbar>
      </div>

      {/* Heatmap grid */}
      <div className="grid grid-cols-3 gap-0 w-full flex-1 min-h-0 overflow-hidden py-2 px-0">
        <HeatmapPanel
          header={leftHeader}
          dataArray={leftNdarray}
          domain={effectiveDomain}
          colorMap={colorMap}
          scaleType={scaleType}
          invertColorMap={invertColorMap}
          rows={leftRows}
          cols={leftCols}
          flipXAxis={flipXAxis}
          flipYAxis={flipYAxis}
          showGrid={showGrid}
          linecuts={showOverlays ? leftImageLinecuts : []}
          inclinedLinecuts={showOverlays ? leftInclinedLinecuts : []}
          inclinedPixelWidthCalculator={calculateInclinedPixelWidth}
          azimuthalIntegrations={showOverlays ? leftAzimuthalIntegrations : []}
          qMagnitudeMatrix={qMagnitudeMatrix}
          beamCenterX={calibrationParams?.beam_center_x}
          beamCenterY={calibrationParams?.beam_center_y}
          maxQValue={maxQValue}
          isLoading={isLoadingImages}
          loadingMessage="Loading image..."
          showQSpaceAxes={showQSpaceAxes}
          qXMatrix={qXMatrix}
          qYMatrix={qYMatrix}
          experimentType={experimentType}
        />
        <HeatmapPanel
          header={rightHeader}
          dataArray={rightNdarray}
          domain={effectiveDomain}
          colorMap={colorMap}
          scaleType={scaleType}
          invertColorMap={invertColorMap}
          rows={leftRows}
          cols={leftCols}
          flipXAxis={flipXAxis}
          flipYAxis={flipYAxis}
          showGrid={showGrid}
          linecuts={showOverlays ? rightImageLinecuts : []}
          inclinedLinecuts={showOverlays ? rightInclinedLinecuts : []}
          inclinedPixelWidthCalculator={calculateInclinedPixelWidth}
          azimuthalIntegrations={showOverlays ? rightAzimuthalIntegrations : []}
          qMagnitudeMatrix={qMagnitudeMatrix}
          beamCenterX={calibrationParams?.beam_center_x}
          beamCenterY={calibrationParams?.beam_center_y}
          maxQValue={maxQValue}
          isLoading={isLoadingImages}
          loadingMessage="Loading image..."
          showQSpaceAxes={showQSpaceAxes}
          qXMatrix={qXMatrix}
          qYMatrix={qYMatrix}
          experimentType={experimentType}
        />
        <HeatmapPanel
          header={comparisonHeader ?? <span className="font-medium">{comparisonLabel}</span>}
          dataArray={diffNdarray}
          domain={comparisonDomain}
          colorMap={diffColorMap}
          scaleType={ScaleType.Linear}
          invertColorMap={invertDiffColorMap}
          rows={leftRows}
          cols={leftCols}
          flipXAxis={flipXAxis}
          flipYAxis={flipYAxis}
          showGrid={showGrid}
          isLoading={isLoadingImages}
          loadingMessage="Loading..."
          showQSpaceAxes={showQSpaceAxes}
          qXMatrix={qXMatrix}
          qYMatrix={qYMatrix}
          experimentType={experimentType}
        />
      </div>
    </div>
  );
});

H5WebScatterSubplot.displayName = 'H5WebScatterSubplot';

export default H5WebScatterSubplot;
