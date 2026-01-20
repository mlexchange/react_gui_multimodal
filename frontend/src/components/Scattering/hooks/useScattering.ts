import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { unpack } from "msgpackr";
import { CalibrationParams, isCalibrationComplete } from "../types";

/**
 * State that can be restored from a saved session
 */
interface RestorableScatteringState {
  experimentType?: string;
  selectedLinecuts?: string[];
  calibrationParams?: CalibrationParams;
  maskUri?: string | null;
  showQSpaceAxes?: boolean;
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
    typeof response === "object" &&
    response !== null &&
    Array.isArray(response.q_x) &&
    Array.isArray(response.q_y) &&
    Array.isArray(response.q_x[0]) && // Check that it's a 2D array
    Array.isArray(response.q_y[0]) // Check that it's a 2D array
  );
}

export default function useScattering() {
  // Existing state variables
  const [experimentType, setExperimentType] = useState("SAXS");
  const [selectedLinecuts, setSelectedLinecuts] = useState<string[]>([]);
  const [imageHeight, setImageHeight] = useState<number>(100);
  const [imageWidth, setImageWidth] = useState<number>(100);
  const [imageData1, setImageData1] = useState<number[][]>([]);
  const [imageData2, setImageData2] = useState<number[][]>([]);
  const [zoomedXPixelRange, setZoomedXPixelRange] = useState<
    [number, number] | null
  >(null);
  const [zoomedYPixelRange, setZoomedYPixelRange] = useState<
    [number, number] | null
  >(null);

  // Calibration parameters
  const [calibrationParams, setCalibrationParams] =
    useState<CalibrationParams | null>(null);

  // Mask state
  const [maskUri, setMaskUri] = useState<string | null>(null);
  const [maskData, setMaskData] = useState<Uint8Array | null>(null);
  const [maskShape, setMaskShape] = useState<[number, number] | null>(null);
  const [showMaskOverlay, setShowMaskOverlay] = useState(false);

  // Q-space axes toggle (for switching between pixel and Q-space display)
  const [showQSpaceAxes, setShowQSpaceAxes] = useState(false);

  // Callback to update mask data and shape together
  const updateMaskData = useCallback(
    (data: Uint8Array | null, shape: [number, number] | null) => {
      setMaskData(data);
      setMaskShape(shape);
    },
    []
  );

  // Check if calibration is complete
  const isCalibrationSet = useMemo(
    () => isCalibrationComplete(calibrationParams),
    [calibrationParams]
  );

  // Q-matrix state (replacing vector state)
  const [qXMatrix, setQXMatrix] = useState<number[][]>([]);
  const [qYMatrix, setQYMatrix] = useState<number[][]>([]);

  // Track previous experiment type to detect changes
  const prevExperimentType = useRef(experimentType);

  // Clear calibration-related state when experiment type changes
  useEffect(() => {
    // Skip on initial render (when previous matches current)
    if (prevExperimentType.current === experimentType) {
      return;
    }

    console.log(
      `Experiment type changed from ${prevExperimentType.current} to ${experimentType}, clearing calibration state`
    );

    // Clear Q matrices
    setQXMatrix([]);
    setQYMatrix([]);

    // Clear calibration parameters
    setCalibrationParams(null);

    // Clear mask
    setMaskUri(null);
    setMaskData(null);
    setMaskShape(null);
    setShowMaskOverlay(false);

    // Reset Q-space axes toggle
    setShowQSpaceAxes(false);

    // Clear selected linecuts
    setSelectedLinecuts([]);

    // Update ref to current value
    prevExperimentType.current = experimentType;
  }, [experimentType]);

  /**
   * Fetch q-matrices from the server (SAXS only)
   * For GISAXS, Q matrices come from the image fetch (pyFAI FiberIntegrator)
   * For SAXS: fetches standard qx and qy from /api/q-space
   */
  const fetchQVectors = useCallback(async () => {
    // Don't fetch if calibration is not set
    if (!isCalibrationSet || !calibrationParams) {
      setQXMatrix([]);
      setQYMatrix([]);
      return;
    }

    // For GISAXS, Q matrices come from the image fetch (setGisaxsQMatrices)
    // This ensures consistency with the pyFAI FiberIntegrator calculations
    if (experimentType === "GISAXS") {
      return;
    }

    try {
      // Create the URL with calibration parameters
      const url = new URL("/api/q-space", window.location.origin);

      // Add all calibration parameters to the URL
      Object.entries(calibrationParams).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, value.toString());
        }
      });

      // Add experiment type to determine SAXS vs GISAXS q-vector calculation
      url.searchParams.set("experiment_type", experimentType);

      // Add image dimensions from the loaded image data
      url.searchParams.set("image_height", imageHeight.toString());
      url.searchParams.set("image_width", imageWidth.toString());

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
        throw new Error("Invalid q-matrices response format");
      }

      // Store the q-matrices (SAXS: q_x and q_y are standard coordinates)
      setQXMatrix(decodedData.q_x);
      setQYMatrix(decodedData.q_y);
    } catch (error) {
      console.error("Error fetching q-matrices:", error);
    }
  }, [
    calibrationParams,
    experimentType,
    imageHeight,
    imageWidth,
    isCalibrationSet
  ]);

  /**
   * Set Q matrices directly from GISAXS pixel Q data (from image fetch)
   * This ensures the same pyFAI FiberIntegrator calculations are used for
   * both the image display and the linecut sliders.
   */
  const setGisaxsQMatrices = useCallback(
    (qipMatrix: number[][], qoopMatrix: number[][]) => {
      setQXMatrix(qipMatrix);
      setQYMatrix(qoopMatrix);
    },
    []
  );

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
    if (state.showQSpaceAxes !== undefined) {
      setShowQSpaceAxes(state.showQSpaceAxes);
    }
  }, []);

  // Fetch q-matrices when calibration is set and image dimensions are available
  useEffect(() => {
    // Only fetch Q-vectors if images are loaded AND calibration is set
    if ((imageHeight > 0 || imageWidth > 0) && isCalibrationSet) {
      fetchQVectors();
    }
  }, [
    fetchQVectors,
    imageHeight,
    imageWidth,
    experimentType,
    isCalibrationSet
  ]);

  // Track if we're currently restoring mask to prevent duplicate fetches
  const isRestoringMask = useRef(false);

  // Restore mask data when maskUri is set but maskData is null (e.g., after page refresh)
  useEffect(() => {
    // Skip if no maskUri, mask data already loaded, or currently restoring
    if (!maskUri || maskData !== null || isRestoringMask.current) {
      return;
    }

    isRestoringMask.current = true;

    const restoreMask = async () => {
      try {
        // 1. Try backend cache first (works for ALL mask types)
        const cacheUrl = new URL("/api/get-mask", window.location.origin);
        cacheUrl.searchParams.set("mask_id", maskUri);

        const cacheResponse = await fetch(cacheUrl.toString());
        if (cacheResponse.ok) {
          const buffer = await cacheResponse.arrayBuffer();
          const data = unpack(new Uint8Array(buffer)) as {
            mask_id: string;
            shape: [number, number];
            data: Uint8Array;
          };
          console.log(`Restored mask from backend cache: ${maskUri}`);
          setMaskData(new Uint8Array(data.data));
          setMaskShape(data.shape);
          return;
        }

        // 2. For Tiled masks only: fallback to fetching from Tiled server
        if (!maskUri.startsWith("uploaded_")) {
          const tiledUrl = new URL(
            "/api/load-mask-from-tiled",
            window.location.origin
          );
          tiledUrl.searchParams.set("mask_uri", maskUri);

          const tiledResponse = await fetch(tiledUrl.toString());
          if (tiledResponse.ok) {
            const buffer = await tiledResponse.arrayBuffer();
            const data = unpack(new Uint8Array(buffer)) as {
              mask_uri: string;
              shape: [number, number];
              data: Uint8Array;
            };
            console.log(`Restored mask from Tiled: ${maskUri}`);
            setMaskData(new Uint8Array(data.data));
            setMaskShape(data.shape);
            return;
          }
        }

        // 3. Both failed - clear the invalid URI
        console.log("Mask not found in cache or Tiled, clearing");
        setMaskUri(null);
      } catch (error) {
        console.error("Failed to restore mask:", error);
        setMaskUri(null);
      } finally {
        isRestoringMask.current = false;
      }
    };

    restoreMask();
  }, [maskUri, maskData]);

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

    // Calibration parameters
    calibrationParams,
    updateCalibration,
    isCalibrationSet,

    // Q-matrices instead of Q-vectors
    qXMatrix,
    qYMatrix,
    setGisaxsQMatrices, // For GISAXS: set Q matrices from image fetch

    // Mask
    maskUri,
    setMaskUri,
    maskData,
    maskShape,
    updateMaskData,
    showMaskOverlay,
    setShowMaskOverlay,

    // Q-space axes toggle
    showQSpaceAxes,
    setShowQSpaceAxes,

    // Session restoration
    restoreState
  };
}
