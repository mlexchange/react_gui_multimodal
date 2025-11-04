import { useState, useCallback, useEffect } from 'react';
import { decode } from "@msgpack/msgpack";
import { CalibrationParams } from '../types';

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

export default function useMultimodal() {
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
  const [calibrationParams, setCalibrationParams] = useState<CalibrationParams>({
    sample_detector_distance: 274.83,
    beam_center_x: 317.8,
    beam_center_y: 1245.28,
    pixel_size_x: 172,
    pixel_size_y: 172,
    wavelength: 1.2398,
    tilt: 0,
    tilt_plan_rotation: 0
  });

  // Q-matrix state (replacing vector state)
  const [qXMatrix, setQXMatrix] = useState<number[][]>([]);
  const [qYMatrix, setQYMatrix] = useState<number[][]>([]);

  /**
   * Fetch q-matrices from the server
   * This fetches both q_x and q_y matrices based on current calibration parameters
   */
  const fetchQVectors = useCallback(async () => {
    try {
      // Create the URL with calibration parameters
      const url = new URL('/api/q-vectors', window.location.origin);

      // Add all calibration parameters to the URL
      Object.entries(calibrationParams).forEach(([key, value]) => {
        url.searchParams.set(key, value.toString());
      });

      // Add image dimensions from the loaded image data
      const imageHeight = imageData1.length;
      const imageWidth = imageData1[0]?.length || 0;
      url.searchParams.set('image_height', imageHeight.toString());
      url.searchParams.set('image_width', imageWidth.toString());

      // Fetch the data
      const response = await fetch(url.toString());

      // Check for HTTP errors
      if (!response.ok) {
        throw new Error(`Failed to fetch q-matrices: ${await response.text()}`);
      }

      // Decode the msgpack response
      const decodedData = decode(new Uint8Array(await response.arrayBuffer()));

      // Validate the response format using the type guard
      if (!isQMatricesResponse(decodedData)) {
        throw new Error('Invalid q-matrices response format');
      }

      // Store the q-matrices
      setQXMatrix(decodedData.q_x);
      setQYMatrix(decodedData.q_y);

    } catch (error) {
      console.error('Error fetching q-matrices:', error);
    }
  }, [calibrationParams, imageData1]);

  /**
   * Update calibration parameters and trigger q-matrix refresh
   */
  const updateCalibration = useCallback((newParams: CalibrationParams) => {
    setCalibrationParams(newParams);
    // The effect will automatically trigger q-matrix refresh
  }, []);

  // Fetch q-matrices when calibration parameters change
  // Only fetch if we have actual image data loaded (not initial empty state)
  useEffect(() => {
    // Only fetch Q-vectors if images are loaded
    if (imageData1.length > 0 || imageData2.length > 0) {
      fetchQVectors();
    }
  }, [fetchQVectors, imageData1.length, imageData2.length]);

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

    // Q-matrices instead of Q-vectors
    qXMatrix,
    qYMatrix,
  };
}
