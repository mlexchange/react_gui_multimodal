import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Plot from "react-plotly.js";
import { decode } from "@msgpack/msgpack";
import { notifications } from '@mantine/notifications';
import {
  ResolutionDataType,
  InclinedLinecut,
  Linecut,
  AzimuthalIntegration,
  AzimuthalData,
  CalibrationParams,
  TransformDataFunction,
} from './types';
import { downsampleArray } from './utils/downsampleArray';
import { handleRelayout } from './utils/handleRelayout';
import { extractBinary, reconstructFloat32Array } from './utils/dataProcessingScatterSubplot';
import { generateHorizontalLinecutOverlay } from './utils/generateHorizontalLinecutOverlay';
import { generateVerticalLinecutOverlay } from './utils/generateVerticalLinecutOverlay';
import { generateInclinedLinecutOverlay } from './utils/generateInclinedLinecutOverlay';
import { generateAzimuthalOverlay } from './utils/generateAzimuthalOverlay';
import { getArrayMinMax } from './utils/getArrayMinAndMax';
// import { calculateMinMax } from './utils/transformationUtils';
import { calculateDifferenceArray } from './utils/calculateDifferenceArray';

import AzimuthalLoadingSpinner from "./AzimuthalLoadingSpinner";
import { calculateDivisionArray } from './utils/calculateDivisionArray';
import { fetchWithCache } from './services/scatteringImageCache';

// Add a type for operation
export type OperationType = 'subtract' | 'divide';

interface ScatterSubplotProps {
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
  azimuthalIntegrations: AzimuthalIntegration[];  // List of active integrations
  azimuthalData1: AzimuthalData[];               // Integration data for first image
  azimuthalData2: AzimuthalData[];               // Integration data for second image
  maxQValue: number;
  calibrationParams: CalibrationParams;
  qYMatrix: number[][]; // qYMatrix for q-value mapping
  qXMatrix: number[][]; // qXMatrix for q-value mapping
  // qYVector: number[]; // qYVector for q-value mapping
  // qXVector: number[]; // qXVector for q-value mapping
  units: string;
  mainTransformDataFunction: TransformDataFunction;
  leftImageIndex?: number | "";
  rightImageIndex?: number | "";
  scanUris?: string[];
  isLoadingImages?: boolean;
  setIsLoadingImages?: (isLoading: boolean) => void;
  isAzimuthalProcessing?: boolean;
}


const ScatterSubplot: React.FC<ScatterSubplotProps> = React.memo(({
  operationType,
  setImageHeight,
  setImageWidth,
  setImageData1,
  setImageData2,
  horizontalLinecuts,
  verticalLinecuts,
  inclinedLinecuts,
  setZoomedXPixelRange,
  setZoomedYPixelRange,
  setResolutionMessage,
  isLogScale,
  lowerPercentile,
  upperPercentile,
  normalization,
  imageColormap,
  differenceColormap,
  normalizationMode,
  azimuthalIntegrations,
  azimuthalData1,
  azimuthalData2,
  maxQValue,
  calibrationParams,
  qYMatrix,
  qXMatrix,
  // qYVector,
  // qXVector,
  units,
  mainTransformDataFunction,
  leftImageIndex,
  rightImageIndex,
  scanUris,
  isLoadingImages,
  setIsLoadingImages,
  isAzimuthalProcessing = false,
}) => {
  const [plotData, setPlotData] = useState<any>(null);
  const plotContainer = useRef<HTMLDivElement>(null);
  const [currentResolution, setCurrentResolution] = useState<'low' | 'medium' | 'full'>('low');
  const [dragMode, setDragMode] = useState('zoom');
  const plotDataRef = useRef<any>(null);


  // Resolution-specific states
  const [resolutionData, setResolutionData] = useState<{
    low: ResolutionDataType;
    medium: ResolutionDataType;
    full: ResolutionDataType;
  }>({
    low: { array1: [], array2: [], diff: [], factor: null },
    medium: { array1: [], array2: [], diff: [], factor: null },
    full: { array1: [], array2: [], diff: [], factor: 1 }
  });


  // Calculate the result based on the operation type
  const calculateResult = useCallback((array1: number[][], array2: number[][]) => {
    if (operationType === 'subtract') {
      return calculateDifferenceArray(array1, array2);
    } else {
      return calculateDivisionArray(array1, array2);
    }
  }, [operationType]);



  // =====================================================================================================================
  // Transform data based on log scale and clipping settings
  // =====================================================================================================================

  // Keep a reference to the latest plotData for use in other effects
  useEffect(() => {
    plotDataRef.current = plotData;
  }, [plotData]);


  // Transform the data for the current resolution level (low, medium, or full)
  const transformedPlotData = useMemo(() => {
    if (!resolutionData[currentResolution]) return null;

    const currentData = resolutionData[currentResolution];

    // Transform both arrays together
    const { array1: transformedArray1, array2: transformedArray2 } = mainTransformDataFunction(
      currentData.array1,
      currentData.array2,
      isLogScale,
      lowerPercentile,
      upperPercentile,
      normalization,
      normalizationMode,
    );

    // Then calculate difference using transformed data
    return {
      array1: transformedArray1,
      array2: transformedArray2,
      diff: calculateResult(transformedArray1, transformedArray2)
      // diff: calculateDifferenceArray(transformedArray1, transformedArray2)
    };
  }, [
    resolutionData,
    currentResolution,
    isLogScale,
    lowerPercentile,
    upperPercentile,
    normalization,
    normalizationMode,
    mainTransformDataFunction,
    calculateResult
  ]);

  // Transform the full resolution data for linecut calculations
  const transformedLineData = useMemo(() => {
    if (!resolutionData.full) return null;

    const { array1, array2 } = mainTransformDataFunction(
      resolutionData.full.array1,
      resolutionData.full.array2,
      isLogScale,
      lowerPercentile,
      upperPercentile,
      normalization,
      normalizationMode,
    );

    return { array1, array2 };
  }, [
    resolutionData.full,
    isLogScale,
    lowerPercentile,
    upperPercentile,
    normalization,
    normalizationMode,
    mainTransformDataFunction
  ]);


  const colorScales = useMemo(() => {
    // Decide which data to use for color scaling - prefer full resolution data when available
    const dataForScaling = transformedLineData || transformedPlotData;

    if (!dataForScaling || !dataForScaling.array1 || !dataForScaling.array2) {
      return null;
    }

    // Calculate min/max from full resolution data for more accurate color scaling
    const [minValue1, maxValue1] = getArrayMinMax(dataForScaling.array1);
    const [minValue2, maxValue2] = getArrayMinMax(dataForScaling.array2);

    // Calculate diff or use existing diff value
    const diffData = transformedPlotData ? transformedPlotData.diff
      : calculateResult(dataForScaling.array1, dataForScaling.array2);
      // : calculateDifferenceArray(dataForScaling.array1, dataForScaling.array2);
    const [minValueDiff, maxValueDiff] = getArrayMinMax(diffData);

    // Rest of your code...
    const globalMinValue = Math.min(minValue1, minValue2);
    const globalMaxValue = Math.max(maxValue1, maxValue2);
    const maxAbsDiff = Math.max(Math.abs(minValueDiff), Math.abs(maxValueDiff));

    return {
      array1: { min: minValue1, max: maxValue1 },
      array2: { min: minValue2, max: maxValue2 },
      diff: { min: -maxAbsDiff, max: maxAbsDiff },
      global: { min: globalMinValue, max: globalMaxValue },
      maxAbsDiff,
    };
  }, [
    transformedPlotData,
    transformedLineData,
    calculateResult,
  ]);



  // Effect to update the plot with transformed data and color scales
  useEffect(() => {
    const currentPlotData = plotDataRef.current;

    if (!currentPlotData?.data || !transformedPlotData || !colorScales) return;

    // Update the data arrays and their min/max values
    const newData = currentPlotData.data.map((plotItem: any, index: number) => {
      const dataKey = index === 0 ? 'array1' : index === 1 ? 'array2' : 'diff';
      const transformedData = transformedPlotData[dataKey];

      // Use global min/max for the first two plots (array1 and array2)
      if (index <= 1) {
        return {
          ...plotItem,
          z: transformedData,
          zmin: colorScales.global.min,  // Use global min
          zmax: colorScales.global.max,  // Use global max
          coloraxis: 'coloraxis',  // Link to the first coloraxis
        };
      } else {
        // For difference plot, use symmetric min/max
        return {
          ...plotItem,
          z: transformedData,
          zmin: -colorScales.maxAbsDiff,
          zmax: colorScales.maxAbsDiff,
          coloraxis: 'coloraxis2',  // Link to the second coloraxis
        };
      }
    });

    // Update the coloraxis settings in the layout
    const newLayout = {
      ...currentPlotData.layout,
      coloraxis: currentPlotData.layout.coloraxis ? {
        ...currentPlotData.layout.coloraxis,
        cmin: colorScales.global.min,
        cmax: colorScales.global.max,
        colorscale: imageColormap,
      } : undefined,
      coloraxis2: currentPlotData.layout.coloraxis2 ? {
        ...currentPlotData.layout.coloraxis2,
        cmin: -colorScales.maxAbsDiff,
        cmax: colorScales.maxAbsDiff,
        cmid: 0,
        colorscale: differenceColormap,
      } : undefined
    };

    // Check if data values or ranges have changed
    const hasDataChanged = newData.some((item: any, index: number) => {
      const oldItem = currentPlotData.data[index];
      return (
        !oldItem ||
        item.z !== oldItem.z ||
        item.zmin !== oldItem.zmin ||
        item.zmax !== oldItem.zmax ||
        item.coloraxis !== oldItem.coloraxis ||
        item.coloraxis2 !== oldItem.coloraxis2 ||
        item.colorscale !== oldItem.colorscale ||
        item.showscale !== oldItem.showscale ||
        item.colorbar !== oldItem.colorbar
      );
    });

    // Check if color axis settings have changed
    const hasLayoutChanged =
      currentPlotData.layout.coloraxis?.cmin !== newLayout.coloraxis?.cmin ||
      currentPlotData.layout.coloraxis?.cmax !== newLayout.coloraxis?.cmax ||
      currentPlotData.layout.coloraxis?.colorscale !== newLayout.coloraxis?.colorscale ||
      currentPlotData.layout.coloraxis2?.cmin !== newLayout.coloraxis2?.cmin ||
      currentPlotData.layout.coloraxis2?.cmax !== newLayout.coloraxis2?.cmax ||
      currentPlotData.layout.coloraxis2?.cmid !== newLayout.coloraxis2?.cmid ||
      currentPlotData.layout.coloraxis2?.colorscale !== newLayout.coloraxis2?.colorscale;

    // Only update if something has changed
    if (hasDataChanged || hasLayoutChanged) {
      setPlotData(prev => ({
        ...prev,
        data: newData,
        layout: newLayout
      }));
    }
  }, [transformedPlotData, colorScales, imageColormap, differenceColormap]);


  // Effect to update linecut data when transformations change
  useEffect(() => {
    if (!transformedLineData) return;

    // Update the full resolution image data
    setImageData1(transformedLineData.array1);
    setImageData2(transformedLineData.array2);

  }, [
    transformedLineData,
    setImageData1,
    setImageData2,
  ]);



  // =============================================================================================================== End of Data Transformation


  // Get current resolution factor
  const getCurrentFactor = useCallback(() => {
    return resolutionData[currentResolution].factor;
  }, [currentResolution, resolutionData]);


  // Update the handleRelayout function in ScatterSubplot
  const relayoutHandler = useCallback((relayoutData: any) => {
    handleRelayout(relayoutData, {
      plotData,
      currentResolution,
      resolutionData,
      setCurrentResolution,
      setZoomedXPixelRange,
      setZoomedYPixelRange,
      setPlotData,
      setDragMode,
      transformData: mainTransformDataFunction,
      isLogScale,
      lowerPercentile,
      upperPercentile,
      normalization,
      normalizationMode,
    });
  }, [
    plotData,
    currentResolution,
    resolutionData,
    setCurrentResolution,
    setZoomedXPixelRange,
    setZoomedYPixelRange,
    setPlotData,
    setDragMode,
    mainTransformDataFunction,
    isLogScale,
    lowerPercentile,
    upperPercentile,
    normalization,
    normalizationMode,
  ]);



  // Handle container resizing
  useEffect(() => {
    const currentContainer = plotContainer.current;
    if (!currentContainer) return;

    const handleResize = (entries: ResizeObserverEntry[]) => {
      const entry = entries[0];
      if (!entry) return;

      const { width, height } = entry.contentRect;
      setPlotData(prev => {
        if (!prev || !prev.layout) return prev;

        // Only update if dimensions have actually changed
        if (prev.layout.width === width && prev.layout.height === height) {
          return prev;
        }

        return {
          ...prev,
          layout: {
            ...prev.layout,
            width,
            height,
          },
        };
      });
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(currentContainer);

    return () => {
      resizeObserver.disconnect();
    };
  }, []); // Empty dependency array since we're using refs and closure


  // Initial data fetch
  useEffect(() => {

    // Skip if indices aren't valid numbers or scanUris isn't available
    if (typeof leftImageIndex !== 'number' || typeof rightImageIndex !== 'number') {
      return;
    }

    if (!scanUris || scanUris.length === 0) {
      return;
    }

    // Get scan URIs for the selected indices
    const leftScanUri = scanUris[leftImageIndex];
    const rightScanUri = scanUris[rightImageIndex];

    if (!leftScanUri || !rightScanUri) {
      console.error('Scan URIs not found for selected indices');
      return;
    }

    // Show loading spinner
    setIsLoadingImages(true);

    // Fetch both images in parallel (using IndexedDB cache)
    Promise.all([
      fetchWithCache(leftScanUri),
      fetchWithCache(rightScanUri)
    ])
      .then(([leftBuffer, rightBuffer]) => {
        // Decode both responses
        const decodedLeft = decode(new Uint8Array(leftBuffer)) as any;
        const decodedRight = decode(new Uint8Array(rightBuffer)) as any;

        // Reconstruct full resolution data
        const fullArray1 = reconstructFloat32Array(extractBinary(decodedLeft.image), decodedLeft.metadata.shape);
        const fullArray2 = reconstructFloat32Array(extractBinary(decodedRight.image), decodedRight.metadata.shape);
        const fullDiff = calculateDifferenceArray(fullArray1, fullArray2);
        // const fullDiff = calculateResult(fullArray1, fullArray2);

        // Determine factors based on image width
        const lowFactor = fullArray1[0].length > 2000 || fullArray1.length > 2000 ? 8 : 4;
        const mediumFactor = fullArray1[0].length > 2000 || fullArray1.length > 2000 ? 4 : 2;

        const [minValue1, maxValue1] = getArrayMinMax(fullArray1);
        const [minValue2, maxValue2] = getArrayMinMax(fullArray2);
        const [minValueDiff, maxValueDiff] = getArrayMinMax(fullDiff);

        // Set dimensions and full resolution data for linecuts
        setImageHeight(fullArray1.length);
        setImageWidth(fullArray1[0].length);
        setImageData1(fullArray1);
        setImageData2(fullArray2);

        const array1DownsampledLowRes = downsampleArray(fullArray1, lowFactor);
        const array2DownsampledLowRes = downsampleArray(fullArray2, lowFactor);
        const diffDownsampledLowRes = downsampleArray(fullDiff, lowFactor);

        const array1DownsampledMediumRes = downsampleArray(fullArray1, mediumFactor);
        const array2DownsampledMediumRes = downsampleArray(fullArray2, mediumFactor);
        const diffDownsampledMediumRes = downsampleArray(fullDiff, mediumFactor);


        // Update resolution data with clipped arrays for display
        setResolutionData({
          low: {
            array1: array1DownsampledLowRes,
            array2: array2DownsampledLowRes,
            diff: diffDownsampledLowRes,
            factor: lowFactor
          },
          medium: {
            array1: array1DownsampledMediumRes,
            array2: array2DownsampledMediumRes,
            diff: diffDownsampledMediumRes,
            factor: mediumFactor
          },
          full: {
            array1: fullArray1,
            array2: fullArray2,
            diff: fullDiff,
            factor: 1
          }
        });

        // Calculate global min/max values for consistent color scaling
        const globalMinValue = Math.min(minValue1, minValue2);
        const globalMaxValue = Math.max(maxValue1, maxValue2);
        const maxAbsDiff = Math.max(Math.abs(minValueDiff), Math.abs(maxValueDiff));

        // Create Plotly data structure
        const plotlyData = {
          data: [
            {
              type: 'heatmap',
              z: array1DownsampledLowRes,
              zmin: globalMinValue,
              zmax: globalMaxValue,
              coloraxis: 'coloraxis',
              xaxis: 'x',
              yaxis: 'y',
              hovertemplate: 'x: %{x}<br>y: %{y}<br>intensity: %{z}<extra></extra>',
            },
            {
              type: 'heatmap',
              z: array2DownsampledLowRes,
              zmin: globalMinValue,
              zmax: globalMaxValue,
              coloraxis: 'coloraxis',
              xaxis: 'x2',
              yaxis: 'y2',
              hovertemplate: 'x: %{x}<br>y: %{y}<br>intensity: %{z}<extra></extra>',
            },
            {
              type: 'heatmap',
              z: diffDownsampledLowRes,
              zmin: -maxAbsDiff,
              zmax: maxAbsDiff,
              coloraxis: 'coloraxis2',
              xaxis: 'x3',
              yaxis: 'y3',
              hovertemplate: 'x: %{x}<br>y: %{y}<br>difference: %{z}<extra></extra>',
            }
          ],
          layout: {
            grid: {
              rows: 1,
              columns: 3,
              pattern: 'independent',
              xgap: 0.1,
              ygap: 0
            },
            xaxis: {
              title: { text: 'X (pixels)', font: { size: 12 } },
              tickfont: { size: 11 },
              scaleanchor: 'y',
              scaleratio: 1,
              constrain: 'domain',
            },
            yaxis: {
              title: { text: 'Y (pixels)', font: { size: 12 } },
              tickfont: { size: 11 },
              scaleanchor: 'x',
              scaleratio: 1,
              constrain: 'domain',
            },
            xaxis2: {
              title: { text: 'X (pixels)', font: { size: 12 } },
              tickfont: { size: 11 },
              scaleanchor: 'y2',
              scaleratio: 1,
              constrain: 'domain',
            },
            yaxis2: {
              title: { text: 'Y (pixels)', font: { size: 12 } },
              tickfont: { size: 11 },
              scaleanchor: 'x2',
              scaleratio: 1,
              constrain: 'domain',
            },
            xaxis3: {
              title: { text: 'X (pixels)', font: { size: 12 } },
              tickfont: { size: 11 },
              scaleanchor: 'y3',
              scaleratio: 1,
              constrain: 'domain',
            },
            yaxis3: {
              title: { text: 'Y (pixels)', font: { size: 12 } },
              tickfont: { size: 11 },
              scaleanchor: 'x3',
              scaleratio: 1,
              constrain: 'domain',
            },
            coloraxis: {
              colorscale: 'Viridis',
              cmin: globalMinValue,
              cmax: globalMaxValue,
              colorbar: {
                x: 0.305,
                y: 0.5,
                len: 0.8,
                thickness: 15,
                tickfont: { size: 11 },
                title: {
                  text: 'Intensity',
                  side: 'right',
                  font: { size: 12 }
                }
              }
            },
            coloraxis2: {
              colorscale: 'RdBu',
              cmin: -maxAbsDiff,
              cmax: maxAbsDiff,
              cmid: 0,
              colorbar: {
                x: 1.02,
                y: 0.5,
                len: 0.8,
                thickness: 15,
                tickfont: { size: 11 },
                title: {
                  text: 'Difference',
                  side: 'right',
                  font: { size: 12 }
                }
              }
            },
            margin: { l: 50, r: 50, t: 30, b: 50 },
            showlegend: false,
          }
        };

        setPlotData(plotlyData);
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
  ]);


  // Memoize plot components
  const mainPlotData = plotData?.data || [];


  const linecutOverlays = useMemo(() => {
    if (!plotData) return [];

    const factor = getCurrentFactor() || 1;
    const currentArrayData = resolutionData[currentResolution].array1;
    const imageWidth = currentArrayData[0]?.length || 0;
    const imageHeight = currentArrayData.length;

    return [
      ...(horizontalLinecuts || [])
        .filter(l => !l.hidden)
        .flatMap(linecut => generateHorizontalLinecutOverlay({
          linecut,
          currentArray: currentArrayData,
          factor: getCurrentFactor(),
          qYMatrix, // Pass qYMatrix to the function
          // qYVector, // Pass qYMatrix to the function
          units: units // Pass units
        })),
      ...(verticalLinecuts || [])
        .filter(l => !l.hidden)
        .flatMap(linecut => generateVerticalLinecutOverlay({
          linecut,
          currentArray: currentArrayData,
          factor: getCurrentFactor(),
          qXMatrix, // Pass qXMatrix to the function
          // qXVector, // Pass qXMatrix to the function
          units: units // Pass units
        })),
        // Inclined linecuts
      ...(inclinedLinecuts || [])
      .filter(l => !l.hidden)
      .flatMap(linecut => {
        return generateInclinedLinecutOverlay({
          linecut: linecut, //scaledLinecut,
          currentArray: resolutionData[currentResolution].array1,
          factor,
          imageWidth,
          imageHeight,
          beam_center_x: calibrationParams.beam_center_x,
          beam_center_y: calibrationParams.beam_center_y,
          // qXVector,
          // qYVector,
          qXVector: qXMatrix[0], // First row as X vector
          qYVector: qYMatrix.map(row => row[0]), // First column as Y vector
        });
      }),

      // Azimuthal integration overlays
      ...(azimuthalIntegrations || [])
      .filter(integration => !integration.hidden)
      .flatMap(integration => {
        // Get the data for this integration
        const data1 = azimuthalData1.find(d => d.id === integration.id);
        const data2 = azimuthalData2.find(d => d.id === integration.id);

        if (!data1 || !data2) return [];  // Skip if data not available

        // Generate and spread both overlays' traces
        return [
          ...generateAzimuthalOverlay({
            integration,
            azimuthalData: data1,
            axisNumber: 1,
            factor,
            currentArray: currentArrayData,
            maxQValue: maxQValue,
            beamCenterX: calibrationParams.beam_center_x,
            beamCenterY: calibrationParams.beam_center_y,
          }),
          ...generateAzimuthalOverlay({
            integration,
            azimuthalData: data2,
            axisNumber: 2,
            factor,
            currentArray: currentArrayData,
            maxQValue: maxQValue,
            beamCenterX: calibrationParams.beam_center_x,
            beamCenterY: calibrationParams.beam_center_y,
          })
        ];
      })

    ];
  }, [
    plotData,
    horizontalLinecuts,
    verticalLinecuts,
    inclinedLinecuts,
    azimuthalIntegrations,
    azimuthalData1,
    azimuthalData2,
    resolutionData,
    currentResolution,
    getCurrentFactor,
    maxQValue,
    calibrationParams,
    qYMatrix,
    qXMatrix,
    // qYVector,
    // qXVector,
    units,
  ]);



  // Memoize layout options
  const layoutOptions = useMemo(() => {
    const baseLayout = {
      dragmode: dragMode,
      coloraxis: {
        ...plotData?.layout.coloraxis,
        colorbar: {
          ...plotData?.layout.coloraxis?.colorbar,
          len: 0.53,
        }
      },
      coloraxis2: {
        ...plotData?.layout.coloraxis2,
        colorbar: {
          ...plotData?.layout.coloraxis2?.colorbar,
          len: 0.53,
        }
      },
    };

    // Only add the axis configurations when in low resolution
    // This is to make sure the image does not move when the linecuts are added
    if (currentResolution === 'low' && plotData) {
      return {
        ...baseLayout,
        xaxis: {
          ...plotData.layout.xaxis,
          range: [0, resolutionData[currentResolution].array1[0]?.length || 0],
          autorange: false,
        },
        xaxis2: {
          ...plotData.layout.xaxis2,
          range: [0, resolutionData[currentResolution].array1[0]?.length || 0],
          autorange: false,
        },
        xaxis3: {
          ...plotData.layout.xaxis3,
          range: [0, resolutionData[currentResolution].array1[0]?.length || 0],
          autorange: false,
        },
        yaxis: {
          ...plotData.layout.yaxis,
          range: [resolutionData[currentResolution].array1?.length + 30 || 0, -20],
          autorange: false,
        },
        yaxis2: {
          ...plotData.layout.yaxis2,
          range: [resolutionData[currentResolution].array1?.length + 30 || 0, -20],
          autorange: false,
        },
        yaxis3: {
          ...plotData.layout.yaxis3,
          range: [resolutionData[currentResolution].array1?.length + 30 || 0, -20],
          autorange: false,
        },
      };
    }

    // Return only the base layout for medium and full resolution
    return baseLayout;
  }, [dragMode, plotData, resolutionData, currentResolution]);



    // Update resolution message whenever resolution changes
    useEffect(() => {
      const resInfo = {
        low: {
          factor: resolutionData.low.factor
        },
        medium: {
          factor: resolutionData.medium.factor
        },
        full: {
          factor: resolutionData.full.factor
        }
      };
      const info = resInfo[currentResolution];
      setResolutionMessage(
        `Downsampling Factor: ${info.factor}x\u00A0\u00A0|\u00A0\u00A0Images and colorbars are clipped to ${lowerPercentile}st-${upperPercentile}th percentile`
      );
    }, [currentResolution, resolutionData, setResolutionMessage, lowerPercentile, upperPercentile]);


  return (
    <div className="relative w-full h-full">
      <div
        ref={plotContainer}
        className="w-full h-full"
        >
        {plotData ? (
          <Plot
            data={[...mainPlotData, ...linecutOverlays]}
            layout={{
              ...plotData.layout,
              ...layoutOptions,
            }}
            config={{
              scrollZoom: true,
              responsive: true,
              displayModeBar: true,
              displaylogo: false,
              modeBarButtons: [
                ['pan2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
              ],
              showTips: true,
            }}
            useResizeHandler={false}  // Disable Plotly's built-in resize handler
            style={{ width: "100%", height: "100%" }}
            onRelayout={(relayoutData) => {
              if (relayoutData.dragmode) {
                setDragMode(relayoutData.dragmode);
              }
              relayoutHandler(relayoutData);
            }}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <div className="text-center p-8">
              <p className="text-xl text-gray-600 mb-2">No data loaded</p>
              <p className="text-sm text-gray-500">Please select a folder using the "Select Data" button above</p>
            </div>
          </div>
        )}

        {/* Loading spinner for image selection */}
        <AzimuthalLoadingSpinner
          isLoading={isLoadingImages}
          message="Loading selected images..."
        />

        <AzimuthalLoadingSpinner
          isLoading={isAzimuthalProcessing}
          message="Calculating azimuthal integration..."
        />

      </div>
    </div>
  );
});

export default ScatterSubplot;
