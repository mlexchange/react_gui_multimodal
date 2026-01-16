import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  ScaleType,
  Toolbar,
  Separator,
  DomainWidget,
  ColorMapSelector,
  ScaleSelector,
  ToggleBtn,
  getSafeDomain,
  SnapshotBtn,
  type ColorMap,
  type CustomDomain,
} from '@h5web/lib';
import {
  ArrowsHorizontalIcon,
  ArrowsVerticalIcon,
  GridFourIcon,
  StackIcon,
  ChartLineIcon,
  MaskHappyIcon,
} from '@phosphor-icons/react';

import { HeatmapPanel } from './HeatmapPanel';
import { type LinecutOverlayProps } from './utils/generateOverlays';
import { calculateQSpaceToPixelWidth } from './utils/calculateQSpaceToPixelWidth';
import { calculateInclinedQSpaceToPixelWidth } from './utils/calculateQSpaceToPixelWidthInclinedLinecut';
import { SCALE_OPTIONS, type ColorScaleType } from './utils/constants';
import { arrayToNdarray } from './utils/h5webUtils';

// Domain type for heatmap visualization
type Domain = [number, number];

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
  maskData?: Uint8Array | null;
  maskShape?: [number, number] | null;
  experimentType?: string;
  showQSpaceAxes: boolean;
  setShowQSpaceAxes: (value: boolean) => void;
}

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
  maskData,
  maskShape,
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
  const [colorMap, setColorMap] = useState<ColorMap>('Viridis');
  const [diffColorMap, setDiffColorMap] = useState<ColorMap>('RdBu');
  const [invertColorMap, setInvertColorMap] = useState(false);
  const [invertDiffColorMap, setInvertDiffColorMap] = useState(false);
  const [flipXAxis, setFlipXAxis] = useState(false);
  const [flipYAxis, setFlipYAxis] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showOverlays, setShowOverlays] = useState(true);
  const [showMaskOverlay, setShowMaskOverlay] = useState(true);
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

    // Add horizontal linecuts (use qYMatrix for position-aware width calculation)
    horizontalLinecuts.forEach(lc => {
      const pixelWidth = calculateQSpaceToPixelWidth(lc.position, lc.width, qYMatrix, 'horizontal');
      linecuts.push({
        position: lc.pixelPosition,
        width: pixelWidth,
        color: lc.leftColor,
        type: 'horizontal',
        hidden: lc.hidden,
      });
    });

    // Add vertical linecuts (use qXMatrix for position-aware width calculation)
    verticalLinecuts.forEach(lc => {
      const pixelWidth = calculateQSpaceToPixelWidth(lc.position, lc.width, qXMatrix, 'vertical');
      linecuts.push({
        position: lc.pixelPosition,
        width: pixelWidth,
        color: lc.leftColor,
        type: 'vertical',
        hidden: lc.hidden,
      });
    });

    return linecuts;
  }, [horizontalLinecuts, verticalLinecuts, qYMatrix, qXMatrix]);

  // Transform linecuts to overlay format for right image
  const rightImageLinecuts = useMemo(() => {
    const linecuts: LinecutOverlayProps['linecuts'] = [];

    // Add horizontal linecuts (use qYMatrix for position-aware width calculation)
    horizontalLinecuts.forEach(lc => {
      const pixelWidth = calculateQSpaceToPixelWidth(lc.position, lc.width, qYMatrix, 'horizontal');
      linecuts.push({
        position: lc.pixelPosition,
        width: pixelWidth,
        color: lc.rightColor,
        type: 'horizontal',
        hidden: lc.hidden,
      });
    });

    // Add vertical linecuts (use qXMatrix for position-aware width calculation)
    verticalLinecuts.forEach(lc => {
      const pixelWidth = calculateQSpaceToPixelWidth(lc.position, lc.width, qXMatrix, 'vertical');
      linecuts.push({
        position: lc.pixelPosition,
        width: pixelWidth,
        color: lc.rightColor,
        type: 'vertical',
        hidden: lc.hidden,
      });
    });

    return linecuts;
  }, [horizontalLinecuts, verticalLinecuts, qYMatrix, qXMatrix]);

  // Derive 1D q-vectors from 2D matrices for inclined linecut calculations
  const qXVector = useMemo(() => qXMatrix?.[0] ?? [], [qXMatrix]);
  const qYVector = useMemo(() => qYMatrix?.map(row => row[0]) ?? [], [qYMatrix]);

  // Calculate inclined linecut pixel width using position and angle-aware calculation
  const calculateInclinedPixelWidth = useCallback((
    qXPosition: number,
    qYPosition: number,
    angle: number,
    qWidth: number
  ): number => {
    if (!qXVector.length || !qYVector.length) {
      // Fallback to average of horizontal/vertical if vectors not available
      const hPixelWidth = calculateLocalPixelWidth(qWidth, qYMatrix, 'horizontal');
      const vPixelWidth = calculateLocalPixelWidth(qWidth, qXMatrix, 'vertical');
      return (hPixelWidth + vPixelWidth) / 2;
    }
    return calculateInclinedQSpaceToPixelWidth(qXPosition, qYPosition, angle, qWidth, qXVector, qYVector);
  }, [qXVector, qYVector, qXMatrix, qYMatrix, calculateLocalPixelWidth]);

  // Transform inclined linecuts to overlay format for left image
  const leftInclinedLinecuts = useMemo(() => {
    return inclinedLinecuts.map(lc => ({
      angle: lc.angle,
      qWidth: lc.qWidth,
      qXPosition: lc.qXPosition,
      qYPosition: lc.qYPosition,
      color: lc.leftColor,
      hidden: lc.hidden,
    }));
  }, [inclinedLinecuts]);

  // Transform inclined linecuts to overlay format for right image
  const rightInclinedLinecuts = useMemo(() => {
    return inclinedLinecuts.map(lc => ({
      angle: lc.angle,
      qWidth: lc.qWidth,
      qXPosition: lc.qXPosition,
      qYPosition: lc.qYPosition,
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
        <ToggleBtn
          label="Mask"
          Icon={MaskHappyIcon}
          value={showMaskOverlay}
          onToggle={() => setShowMaskOverlay(!showMaskOverlay)}
          disabled={!maskData}
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
          maskData={maskData}
          maskShape={maskShape}
          showMaskOverlay={showMaskOverlay}
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
          maskData={maskData}
          maskShape={maskShape}
          showMaskOverlay={showMaskOverlay}
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
