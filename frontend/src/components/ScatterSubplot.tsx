import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Plot from "react-plotly.js";
import { decode } from "@msgpack/msgpack";
import {
  ResolutionDataType,
  InclinedLinecut,
  Linecut,
  AzimuthalIntegration,
  AzimuthalData,
  CalibrationParams,
  TransformDataFunction,
} from "../types";
import { downsampleArray } from "../utils/downsampleArray";
import { handleRelayout } from '../utils/handleRelayout';
import { extractBinary, reconstructFloat32Array } from '../utils/dataProcessingScatterSubplot';
import { generateHorizontalLinecutOverlay } from "../utils/generateHorizontalLinecutOverlay";
import { generateVerticalLinecutOverlay } from "../utils/generateVerticalLinecutOverlay";
import { generateInclinedLinecutOverlay } from "../utils/generateInclinedLinecutOverlay";
import { generateAzimuthalOverlay } from "../utils/generateAzimuthalOverlay";
import { getArrayMinMax } from "../utils/getArrayMinAndMax";
// import { calculateMinMax } from "../utils/transformationUtils";
import { calculateDifferenceArray } from "../utils/calculateDifferenceArray";
import { Select } from '@mantine/core';

import AzimuthalLoadingSpinner from "./AzimuthalLoadingSpinner";
import { calculateDivisionArray } from "../utils/calculateDivisionArray";

// Add a type for operation
type OperationType = 'subtract' | 'divide';

interface ScatterSubplotProps {
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
  isThirdCollapsed: boolean;
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
  isLoadingImages?: boolean;
  setIsLoadingImages?: (isLoading: boolean) => void;
  isAzimuthalProcessing?: boolean;
}


const ScatterSubplot: React.FC<ScatterSubplotProps> = React.memo(({
  setImageHeight,
  setImageWidth,
  setImageData1,
  setImageData2,
  horizontalLinecuts,
  verticalLinecuts,
  inclinedLinecuts,
  setZoomedXPixelRange,
  setZoomedYPixelRange,
  isThirdCollapsed,
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


  // Add state for the operation type
  const [operationType, setOperationType] = useState<OperationType>('subtract');

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

    // Skip if indices aren't valid numbers
    if (typeof leftImageIndex !== 'number' || typeof rightImageIndex !== 'number') {
      return;
    }

    // // Show loading spinner
    setIsLoadingImages(true);

    // Construct the URL with query parameters for the indices
    const url = new URL("/api/scatter-subplot", window.location.origin);
    url.searchParams.append("left_image_index", leftImageIndex.toString());
    url.searchParams.append("right_image_index", rightImageIndex.toString());

    fetch(url.toString())
      .then(response => response.arrayBuffer())
      .then(buffer => {
        const decoded = decode(new Uint8Array(buffer)) as any;

        // Reconstruct full resolution data
        const fullArray1 = reconstructFloat32Array(extractBinary(decoded.array_1), decoded.metadata.shape_1);
        const fullArray2 = reconstructFloat32Array(extractBinary(decoded.array_2), decoded.metadata.shape_2);
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

        // Initialize plot with clipped low resolution data but full range colorbar
        const plotlyData = decoded.metadata.plotly;
        plotlyData.data[0].z = array1DownsampledLowRes;
        plotlyData.data[1].z = array2DownsampledLowRes;
        plotlyData.data[2].z = diffDownsampledLowRes;

        const globalMinValue = Math.min(minValue1, minValue2);
        const globalMaxValue = Math.max(maxValue1, maxValue2);

        // Set the data range for display
        plotlyData.data[0].zmin = globalMinValue;
        plotlyData.data[0].zmax = globalMaxValue;
        plotlyData.data[1].zmin = globalMinValue;
        plotlyData.data[1].zmax = globalMaxValue;
        plotlyData.data[2].zmin = minValueDiff;
        plotlyData.data[2].zmax = maxValueDiff;

        // Set the colorbar range to show full data range
        if (plotlyData.layout.coloraxis) {
          plotlyData.layout.coloraxis.cmin = globalMinValue;
          plotlyData.layout.coloraxis.cmax = globalMaxValue;
        }
        if (plotlyData.layout.coloraxis2) {
          const maxAbsDiff = Math.max(Math.abs(minValueDiff), Math.abs(maxValueDiff));
          plotlyData.layout.coloraxis2.cmin = -maxAbsDiff;
          plotlyData.layout.coloraxis2.cmax = maxAbsDiff;
          plotlyData.layout.coloraxis2.cmid = 0;
        }

        setPlotData(plotlyData);
        setIsLoadingImages(false); // Hide loading spinner

      })
      .catch(error => {
        console.error("Error fetching scatter subplot:", error);
      });

  }, [
    leftImageIndex,
    rightImageIndex,
    setImageHeight,
    setImageWidth,
    setImageData1,
    setImageData2,
    setIsLoadingImages,
    // calculateResult,
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
          len: isThirdCollapsed ? 1.0 : 0.53,
        }
      },
      coloraxis2: {
        ...plotData?.layout.coloraxis2,
        colorbar: {
          ...plotData?.layout.coloraxis2?.colorbar,
          len: isThirdCollapsed ? 1.0 : 0.53,
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
  }, [dragMode, isThirdCollapsed, plotData, resolutionData, currentResolution]);



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


    // Operation select options
    const operationOptions = [
      { value: 'subtract', label: 'Subtract (-)' },
      { value: 'divide', label: 'Divide (÷)' }
    ];


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
          <p>Loading scatter subplot...</p>
        )}
        {isThirdCollapsed && (
          <>
          {/* Operation selection dropdown between images */}
          <div className="absolute top-1/2 left-[27%] -translate-y-1/2 z-10 font-bold">
            <Select
              value={operationType}
              onChange={(value) => setOperationType(value as OperationType)}
              data={operationOptions}
              style={{ width: '170px' }}
              size="md"
            />
          </div>
          <div className="absolute top-1/2 left-[67%] -translate-y-1/2 font-bold">=</div>
        </>
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
