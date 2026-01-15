import { useState, useCallback, useEffect, useMemo } from 'react';
import { unpack } from 'msgpackr';
import { CalibrationParams, isCalibrationComplete } from '../types';

/**
 * State that can be restored from a saved session
 */
interface RestorableScatteringState {
  experimentType?: string;
  selectedLinecuts?: string[];
  calibrationParams?: CalibrationParams;
  maskUri?: string | null;
}

// Define the response interface for q-matrices
interface QMatricesResponse {
  q_x: number[][];
  q_y: number[][];
}

// Type guard to validate the response
function isQMatricesResponse(value: unknown): value is QMatricesResponse {
  const response = value as QMatricesResponse;
  return (
    typeof response === 'object' &&
    response !== null &&
    Array.isArray(response.q_x) &&
    Array.isArray(response.q_y) &&
    Array.isArray(response.q_x[0]) &&  // Check that it's a 2D array
    Array.isArray(response.q_y[0])     // Check that it's a 2D array
  );
}

export default function useScattering() {
  // Existing state variables
  const [experimentType, setExperimentType] = useState('SAXS');
  const [selectedLinecuts, setSelectedLinecuts] = useState<string[]>([]);
  const [imageHeight, setImageHeight] = useState<number>(100);
  const [imageWidth, setImageWidth] = useState<number>(100);
  const [imageData1, setImageData1] = useState<number[][]>([]);
  const [imageData2, setImageData2] = useState<number[][]>([]);
  const [zoomedXPixelRange, setZoomedXPixelRange] = useState<[number, number] | null>(null);
  const [zoomedYPixelRange, setZoomedYPixelRange] = useState<[number, number] | null>(null);
  const [resolutionMessage, setResolutionMessage] = useState('');

  // Calibration parameters
  const [calibrationParams, setCalibrationParams] = useState<CalibrationParams | null>(null);

  // Mask state
  const [maskUri, setMaskUri] = useState<string | null>(null);
  const [maskData, setMaskData] = useState<Uint8Array | null>(null);
  const [maskShape, setMaskShape] = useState<[number, number] | null>(null);

  // Callback to update mask data and shape together
  const updateMaskData = useCallback((data: Uint8Array | null, shape: [number, number] | null) => {
    setMaskData(data);
    setMaskShape(shape);
  }, []);

  // Check if calibration is complete
  const isCalibrationSet = useMemo(
    () => isCalibrationComplete(calibrationParams),
    [calibrationParams]
  );

  // Q-matrix state (replacing vector state)
  const [qXMatrix, setQXMatrix] = useState<number[][]>([]);
  const [qYMatrix, setQYMatrix] = useState<number[][]>([]);

  /**
   * Fetch q-matrices from the server
   * This fetches both q_x and q_y matrices based on current calibration parameters
   * For GISAXS: returns qip (in-plane) and qoop (out-of-plane)
   * For SAXS: returns standard qx and qy
   */
  const fetchQVectors = useCallback(async () => {
    // Don't fetch if calibration is not set
    if (!isCalibrationSet || !calibrationParams) {
      setQXMatrix([]);
      setQYMatrix([]);
      return;
    }

    try {
      // Create the URL with calibration parameters
      const url = new URL('/api/q-vectors', window.location.origin);

      // Add all calibration parameters to the URL
      Object.entries(calibrationParams).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, value.toString());
        }
      });

      // Add experiment type to determine SAXS vs GISAXS q-vector calculation
      url.searchParams.set('experiment_type', experimentType);

      // Add image dimensions from the loaded image data
      url.searchParams.set('image_height', imageHeight.toString());
      url.searchParams.set('image_width', imageWidth.toString());

      // Fetch the data
      const response = await fetch(url.toString());

      // Check for HTTP errors
      if (!response.ok) {
        throw new Error(`Failed to fetch q-matrices: ${await response.text()}`);
      }

      // Decode the msgpack response
      const decodedData = unpack(new Uint8Array(await response.arrayBuffer()));

      // Validate the response format using the type guard
      if (!isQMatricesResponse(decodedData)) {
        throw new Error('Invalid q-matrices response format');
      }

      // Store the q-matrices
      // For GISAXS: q_x = qip (in-plane), q_y = qoop (out-of-plane)
      // For SAXS: q_x and q_y are standard coordinates
      setQXMatrix(decodedData.q_x);
      setQYMatrix(decodedData.q_y);

    } catch (error) {
      console.error('Error fetching q-matrices:', error);
    }
  }, [calibrationParams, experimentType, imageHeight, imageWidth, isCalibrationSet]);

  /**
   * Update calibration parameters and trigger q-matrix refresh
   */
  const updateCalibration = useCallback((newParams: CalibrationParams) => {
    setCalibrationParams(newParams);
    // The effect will automatically trigger q-matrix refresh
  }, []);

  /**
   * Restore state from a saved session
   */
  const restoreState = useCallback((state: RestorableScatteringState) => {
    if (state.experimentType !== undefined) {
      setExperimentType(state.experimentType);
    }
    if (state.selectedLinecuts !== undefined) {
      setSelectedLinecuts(state.selectedLinecuts);
    }
    if (state.calibrationParams !== undefined) {
      setCalibrationParams(state.calibrationParams);
    }
    if (state.maskUri !== undefined) {
      setMaskUri(state.maskUri);
    }
  }, []);

  // Fetch q-matrices when calibration is set and image dimensions are available
  useEffect(() => {
    // Only fetch Q-vectors if images are loaded AND calibration is set
    if ((imageHeight > 0 || imageWidth > 0) && isCalibrationSet) {
      fetchQVectors();
    }
  }, [fetchQVectors, imageHeight, imageWidth, experimentType, isCalibrationSet]);

  return {
    // Existing state
    experimentType,
    setExperimentType,
    selectedLinecuts,
    setSelectedLinecuts,
    imageHeight,
    setImageHeight,
    imageWidth,
    setImageWidth,
    imageData1,
    setImageData1,
    imageData2,
    setImageData2,
    zoomedXPixelRange,
    setZoomedXPixelRange,
    zoomedYPixelRange,
    setZoomedYPixelRange,
    resolutionMessage,
    setResolutionMessage,

    // Calibration parameters
    calibrationParams,
    updateCalibration,
    isCalibrationSet,

    // Q-matrices instead of Q-vectors
    qXMatrix,
    qYMatrix,

    // Mask
    maskUri,
    setMaskUri,
    maskData,
    maskShape,
    updateMaskData,

    // Session restoration
    restoreState,
  };
}
