import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { notifications } from "@/components/ui";
import { unpack } from "msgpackr";
import {
  CalibrationParams,
  Linecut,
  InclinedLinecut,
  AzimuthalIntegration,
  BatchLinecutResult
} from "../types";
import {
  hashHorizontalLinecut,
  hashVerticalLinecut,
  hashInclinedLinecut,
  hashAzimuthalIntegration
} from "../utils/parameterHash";

// ============================================================================
// Types
// ============================================================================

export type BatchOperationType =
  | "horizontal"
  | "vertical"
  | "inclined"
  | "azimuthal";
export type BatchStatus =
  | "idle"
  | "pending"
  | "running"
  | "completed"
  | "failed";

export interface BatchJobResult {
  id: string;
  results: BatchLinecutResult[];
  totalScans: number;
  successful: number;
  failed: number;
  processedAt: number;
}

/** Results organized by operation type and linecut ID */
export interface BatchResultsStore {
  horizontal: Record<number, BatchJobResult>;
  vertical: Record<number, BatchJobResult>;
  inclined: Record<number, BatchJobResult>;
  azimuthal: Record<number, BatchJobResult>;
}

/** Parameter hashes for stale detection */
export interface BatchParameterHashes {
  horizontal: Record<number, string>;
  vertical: Record<number, string>;
  inclined: Record<number, string>;
  azimuthal: Record<number, string>;
}

export interface BatchHorizontalLinecutParams {
  id: number;
  position: number;
  width: number;
}

export interface BatchVerticalLinecutParams {
  id: number;
  position: number;
  width: number;
}

export interface BatchInclinedLinecutParams {
  id: number;
  q_x_position: number;
  q_y_position: number;
  angle: number;
  q_width: number;
}

export interface BatchAzimuthalParams {
  id: number;
  azimuth_range: [number, number];
  q_range: [number, number] | null;
}

// Combined batch parameters (used for UI configuration)
export type BatchProcessingParams = {
  horizontal?: Omit<BatchHorizontalLinecutParams, "id">;
  vertical?: Omit<BatchVerticalLinecutParams, "id">;
  inclined?: Omit<BatchInclinedLinecutParams, "id">;
  azimuthal?: Omit<BatchAzimuthalParams, "id">;
};

interface BatchProgressUpdate {
  progress: number;
  message: string;
  batch_id?: string;
  type?: string;
  current_scan?: string;
}

/** Request body for /api/batch-all endpoint */
interface BatchAllRequest {
  scan_uris: string[];
  calibration: object;
  horizontal_linecuts: BatchHorizontalLinecutParams[];
  vertical_linecuts: BatchVerticalLinecutParams[];
  inclined_linecuts: BatchInclinedLinecutParams[];
  azimuthal_integrations: BatchAzimuthalParams[];
}

/** Response from /api/batch-all endpoint */
interface BatchAllResponse {
  batch_id: string;
  total_scans: number;
  successful_scans: number;
  failed_scans: number;
  results: {
    horizontal: Record<string, BatchLinecutResult[]>;
    vertical: Record<string, BatchLinecutResult[]>;
    inclined: Record<string, BatchLinecutResult[]>;
    azimuthal: Record<string, BatchLinecutResult[]>;
  };
}

// ============================================================================
// Hook Props
// ============================================================================

interface UseBatchProcessingProps {
  calibrationParams: CalibrationParams | null;
  experimentType: string;
  horizontalLinecuts: Linecut[];
  verticalLinecuts: Linecut[];
  inclinedLinecuts: InclinedLinecut[];
  azimuthalIntegrations: AzimuthalIntegration[];
}

// ============================================================================
// Initial State
// ============================================================================

const createEmptyResults = (): BatchResultsStore => ({
  horizontal: {},
  vertical: {},
  inclined: {},
  azimuthal: {}
});

const createEmptyHashes = (): BatchParameterHashes => ({
  horizontal: {},
  vertical: {},
  inclined: {},
  azimuthal: {}
});

// ============================================================================
// Hook
// ============================================================================

export default function useBatchProcessing({
  calibrationParams,
  experimentType,
  horizontalLinecuts,
  verticalLinecuts,
  inclinedLinecuts,
  azimuthalIntegrations
}: UseBatchProcessingProps) {
  // =========================================================================
  // State
  // =========================================================================

  // Multi-linecut results storage
  const [results, setResults] = useState<BatchResultsStore>(createEmptyResults);
  const [parameterHashes, setParameterHashes] =
    useState<BatchParameterHashes>(createEmptyHashes);

  // Selected scans (shared across all operations)
  const [selectedScanUris, setSelectedScanUris] = useState<string[]>([]);

  // UI state for tab navigation
  const [activeTab, setActiveTab] = useState<BatchOperationType>("horizontal");
  const [activeLinecutId, setActiveLinecutId] = useState<number | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  // Controls for the batch results overlay
  const [isResultsOpen, setIsResultsOpen] = useState(false);

  // Controls for the scan selector dialog
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  // WebSocket reference for batch progress updates
  const wsRef = useRef<WebSocket | null>(null);
  const currentBatchIdRef = useRef<string | null>(null);

  // AbortController for cancelling fetch requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track if we're waiting for the first batch progress update (to capture batch_id)
  const awaitingBatchIdRef = useRef<boolean>(false);

  // =========================================================================
  // Computed values
  // =========================================================================

  /** Get linecuts for the active tab */
  const activeLinecuts = useMemo(() => {
    switch (activeTab) {
      case "horizontal":
        return horizontalLinecuts;
      case "vertical":
        return verticalLinecuts;
      case "inclined":
        return inclinedLinecuts;
      case "azimuthal":
        return azimuthalIntegrations;
    }
  }, [
    activeTab,
    horizontalLinecuts,
    verticalLinecuts,
    inclinedLinecuts,
    azimuthalIntegrations
  ]);

  /** Get results for the current tab and linecut */
  const currentResult = useMemo(() => {
    if (activeLinecutId === null) return null;
    return results[activeTab][activeLinecutId] || null;
  }, [results, activeTab, activeLinecutId]);

  /** Count of linecuts with results per tab */
  const resultCounts = useMemo(
    () => ({
      horizontal: Object.keys(results.horizontal).length,
      vertical: Object.keys(results.vertical).length,
      inclined: Object.keys(results.inclined).length,
      azimuthal: Object.keys(results.azimuthal).length
    }),
    [results]
  );

  // =========================================================================
  // Stale Detection
  // =========================================================================

  /** Check if a specific linecut result is stale */
  const isStale = useCallback(
    (type: BatchOperationType, linecutId: number): boolean => {
      const storedHash = parameterHashes[type][linecutId];
      if (!storedHash) return false;

      let currentHash: string;
      switch (type) {
        case "horizontal": {
          const linecut = horizontalLinecuts.find((l) => l.id === linecutId);
          if (!linecut) return true;
          currentHash = hashHorizontalLinecut(linecut);
          break;
        }
        case "vertical": {
          const linecut = verticalLinecuts.find((l) => l.id === linecutId);
          if (!linecut) return true;
          currentHash = hashVerticalLinecut(linecut);
          break;
        }
        case "inclined": {
          const linecut = inclinedLinecuts.find((l) => l.id === linecutId);
          if (!linecut) return true;
          currentHash = hashInclinedLinecut(linecut);
          break;
        }
        case "azimuthal": {
          const integration = azimuthalIntegrations.find(
            (i) => i.id === linecutId
          );
          if (!integration) return true;
          currentHash = hashAzimuthalIntegration(integration);
          break;
        }
      }

      return storedHash !== currentHash;
    },
    [
      parameterHashes,
      horizontalLinecuts,
      verticalLinecuts,
      inclinedLinecuts,
      azimuthalIntegrations
    ]
  );

  /** Check if any result in the active tab is stale */
  const hasStaleResults = useMemo(() => {
    const linecutIds = Object.keys(results[activeTab]).map(Number);
    return linecutIds.some((id) => isStale(activeTab, id));
  }, [results, activeTab, isStale]);

  // =========================================================================
  // Auto-select first linecut when tab changes
  // =========================================================================

  useEffect(() => {
    if (activeLinecuts.length > 0) {
      // Try to find a linecut that has results
      const linecutWithResults = activeLinecuts.find(
        (l) => results[activeTab][l.id] !== undefined
      );
      setActiveLinecutId(linecutWithResults?.id ?? activeLinecuts[0].id);
    } else {
      setActiveLinecutId(null);
    }
  }, [activeTab, activeLinecuts, results]);

  // =========================================================================
  // WebSocket Setup
  // =========================================================================

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl =
      process.env.NODE_ENV === "production"
        ? `${protocol}//${window.location.host}/ws/progress`
        : "ws://127.0.0.1:8000/ws/progress";

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("[Batch] WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        if (event.data === "pong") return;

        const data: BatchProgressUpdate = JSON.parse(event.data);

        // Handle batch progress updates
        if (data.type === "batch" && data.batch_id) {
          // If we're awaiting a batch_id, capture it from the first progress update
          if (awaitingBatchIdRef.current && !currentBatchIdRef.current) {
            currentBatchIdRef.current = data.batch_id;
            console.log(
              "[Batch] Captured batch_id from progress:",
              data.batch_id
            );
          }

          // Only handle updates that match our current job
          if (data.batch_id === currentBatchIdRef.current) {
            setProgress(data.progress);
            setProgressMessage(data.message);
          }
        }
      } catch (error) {
        console.error("[Batch] Error parsing WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("[Batch] WebSocket error:", error);
    };

    wsRef.current = ws;

    // Ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // =========================================================================
  // Actions
  // =========================================================================

  /**
   * Run batch processing for ALL linecuts across ALL types.
   */
  const runBatchAll = useCallback(async () => {
    if (!calibrationParams) {
      notifications.show({
        id: "batch-calibration-error",
        title: "Error",
        message: "Calibration parameters are required for batch processing",
        autoClose: 5000
      });
      notifications.update({
        id: "batch-calibration-error",
        title: "Error",
        message: "Calibration parameters are required for batch processing",
        color: "red",
        autoClose: 5000
      });
      throw new Error("Calibration parameters required");
    }

    if (selectedScanUris.length === 0) {
      notifications.show({
        id: "batch-no-scans",
        title: "Error",
        message: "Please select scans to process",
        autoClose: 5000
      });
      notifications.update({
        id: "batch-no-scans",
        title: "Error",
        message: "Please select scans to process",
        color: "red",
        autoClose: 5000
      });
      throw new Error("No scans selected");
    }

    // Count total operations
    const totalLinecuts =
      horizontalLinecuts.length +
      verticalLinecuts.length +
      inclinedLinecuts.length +
      (experimentType === "SAXS" ? azimuthalIntegrations.length : 0);

    if (totalLinecuts === 0) {
      notifications.show({
        id: "batch-no-linecuts",
        title: "Error",
        message:
          "No linecuts defined. Please add linecuts before batch processing.",
        autoClose: 5000
      });
      notifications.update({
        id: "batch-no-linecuts",
        title: "Error",
        message:
          "No linecuts defined. Please add linecuts before batch processing.",
        color: "red",
        autoClose: 5000
      });
      throw new Error("No linecuts defined");
    }

    // Start processing
    setIsProcessing(true);
    setProgress(0);
    setProgressMessage("Starting batch processing...");

    // Clear previous batch_id and set awaiting flag to capture new one from WebSocket
    currentBatchIdRef.current = null;
    awaitingBatchIdRef.current = true;

    // Create AbortController for this batch
    abortControllerRef.current = new AbortController();

    // Show loading notification
    notifications.show({
      id: "batch-processing",
      loading: true,
      title: "Batch Processing",
      message: `Processing ${selectedScanUris.length} scans with ${totalLinecuts} linecuts...`,
      autoClose: false
    });

    try {
      // Validate required calibration parameters
      const requiredParams = [
        "sample_detector_distance",
        "beam_center_x",
        "beam_center_y",
        "pixel_size_x",
        "pixel_size_y",
        "wavelength"
      ] as const;

      const missingParams = requiredParams.filter(
        (param) =>
          calibrationParams[param] === null ||
          calibrationParams[param] === undefined
      );

      if (missingParams.length > 0) {
        const errorMessage = `Missing required calibration parameters: ${missingParams.join(", ")}`;
        notifications.update({
          id: "batch-processing",
          title: "Missing Calibration",
          message: errorMessage,
          color: "red",
          autoClose: 5000
        });
        throw new Error(errorMessage);
      }

      const calibration = {
        sample_detector_distance: calibrationParams.sample_detector_distance,
        beam_center_x: calibrationParams.beam_center_x,
        beam_center_y: calibrationParams.beam_center_y,
        pixel_size_x: calibrationParams.pixel_size_x,
        pixel_size_y: calibrationParams.pixel_size_y,
        wavelength: calibrationParams.wavelength,
        tilt: calibrationParams.tilt ?? 0,
        tilt_plan_rotation: calibrationParams.tilt_plan_rotation ?? 0,
        experiment_type: experimentType,
        incident_angle: calibrationParams.incident_angle ?? 0
      };

      // Build request body with all linecuts
      const requestBody: BatchAllRequest = {
        scan_uris: selectedScanUris,
        calibration,
        horizontal_linecuts: horizontalLinecuts.map((l) => ({
          id: l.id,
          position: l.position,
          width: l.width
        })),
        vertical_linecuts: verticalLinecuts.map((l) => ({
          id: l.id,
          position: l.position,
          width: l.width
        })),
        inclined_linecuts: inclinedLinecuts.map((l) => ({
          id: l.id,
          q_x_position: l.qXPosition,
          q_y_position: l.qYPosition,
          angle: l.angle,
          q_width: l.qWidth
        })),
        azimuthal_integrations:
          experimentType === "SAXS"
            ? azimuthalIntegrations.map((i) => ({
                id: i.id,
                azimuth_range: i.azimuthRange,
                q_range: i.qRange
              }))
            : []
      };

      // Make the API call
      const response = await fetch("/api/batch-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current?.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Batch processing failed: ${errorText}`);
      }

      // Decode msgpack response
      const arrayBuffer = await response.arrayBuffer();
      const result = unpack(new Uint8Array(arrayBuffer)) as BatchAllResponse;

      // Store batch_id for WebSocket filtering
      currentBatchIdRef.current = result.batch_id;

      // Process results and store by linecut ID
      // Backend returns results keyed by the index position in the request arrays
      // Map these back to the original linecut IDs
      const now = Date.now();
      const newResults: BatchResultsStore = createEmptyResults();
      const newHashes: BatchParameterHashes = createEmptyHashes();

      // Helper to count success/failed in single pass (optimized from double filter)
      const countResults = (results: BatchLinecutResult[]) => {
        let successful = 0;
        for (const r of results) {
          if (r.success) successful++;
        }
        return { successful, failed: results.length - successful };
      };

      // Process horizontal results
      for (const [idxStr, linecutResults] of Object.entries(
        result.results.horizontal
      )) {
        const idx = parseInt(idxStr, 10);
        const linecut = horizontalLinecuts[idx];
        if (linecut) {
          const { successful, failed } = countResults(linecutResults);
          newResults.horizontal[linecut.id] = {
            id: result.batch_id,
            results: linecutResults,
            totalScans: linecutResults.length,
            successful,
            failed,
            processedAt: now
          };
          newHashes.horizontal[linecut.id] = hashHorizontalLinecut(linecut);
        }
      }

      // Process vertical results
      for (const [idxStr, linecutResults] of Object.entries(
        result.results.vertical
      )) {
        const idx = parseInt(idxStr, 10);
        const linecut = verticalLinecuts[idx];
        if (linecut) {
          const { successful, failed } = countResults(linecutResults);
          newResults.vertical[linecut.id] = {
            id: result.batch_id,
            results: linecutResults,
            totalScans: linecutResults.length,
            successful,
            failed,
            processedAt: now
          };
          newHashes.vertical[linecut.id] = hashVerticalLinecut(linecut);
        }
      }

      // Process inclined results
      for (const [idxStr, linecutResults] of Object.entries(
        result.results.inclined
      )) {
        const idx = parseInt(idxStr, 10);
        const linecut = inclinedLinecuts[idx];
        if (linecut) {
          const { successful, failed } = countResults(linecutResults);
          newResults.inclined[linecut.id] = {
            id: result.batch_id,
            results: linecutResults,
            totalScans: linecutResults.length,
            successful,
            failed,
            processedAt: now
          };
          newHashes.inclined[linecut.id] = hashInclinedLinecut(linecut);
        }
      }

      // Process azimuthal results
      for (const [idxStr, linecutResults] of Object.entries(
        result.results.azimuthal
      )) {
        const idx = parseInt(idxStr, 10);
        const integration = azimuthalIntegrations[idx];
        if (integration) {
          const { successful, failed } = countResults(linecutResults);
          newResults.azimuthal[integration.id] = {
            id: result.batch_id,
            results: linecutResults,
            totalScans: linecutResults.length,
            successful,
            failed,
            processedAt: now
          };
          newHashes.azimuthal[integration.id] =
            hashAzimuthalIntegration(integration);
        }
      }

      // Update state
      setResults(newResults);
      setParameterHashes(newHashes);
      setProgress(100);
      setProgressMessage(
        `Complete: ${result.successful_scans} successful, ${result.failed_scans} failed`
      );

      // Show success notification
      notifications.update({
        id: "batch-processing",
        color: "green",
        title: "Batch processing complete",
        message: `Processed ${result.total_scans} scans (${result.successful_scans} successful, ${result.failed_scans} failed)`,
        autoClose: 3000
      });

      return result;
    } catch (error) {
      // Handle user cancellation - don't show error notification
      if (error instanceof Error && error.name === "AbortError") {
        setProgressMessage("Cancelled");
        notifications.update({
          id: "batch-processing",
          title: "Batch processing cancelled",
          message: "Batch processing was cancelled by user",
          autoClose: 3000
        });
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      setProgressMessage(errorMessage);

      notifications.update({
        id: "batch-processing",
        color: "red",
        title: "Batch processing failed",
        message: errorMessage,
        autoClose: 5000
      });

      throw error;
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
      awaitingBatchIdRef.current = false;
    }
  }, [
    calibrationParams,
    experimentType,
    selectedScanUris,
    horizontalLinecuts,
    verticalLinecuts,
    inclinedLinecuts,
    azimuthalIntegrations
  ]);

  /**
   * Clear all results
   */
  const clearResults = useCallback(() => {
    currentBatchIdRef.current = null;
    setResults(createEmptyResults());
    setParameterHashes(createEmptyHashes());
    setProgress(0);
    setProgressMessage("");
  }, []);

  /**
   * Cancel the current batch processing
   */
  const cancelBatch = useCallback(() => {
    // Abort the fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Notify backend to stop processing
    if (currentBatchIdRef.current) {
      fetch(`/api/batch-cancel/${currentBatchIdRef.current}`, {
        method: "POST"
      }).catch(() => {
        // Fire and forget - we don't care if this fails
      });
    }

    // Reset state
    setIsProcessing(false);
    setProgress(0);
    setProgressMessage("Cancelled");
    currentBatchIdRef.current = null;
    awaitingBatchIdRef.current = false;
  }, []);

  /**
   * Get result for a specific linecut
   */
  const getResult = useCallback(
    (type: BatchOperationType, linecutId: number): BatchJobResult | null => {
      return results[type][linecutId] || null;
    },
    [results]
  );

  // =========================================================================
  // Restore results from session (will be called by parent component)
  // =========================================================================

  const restoreState = useCallback(
    (
      savedResults: BatchResultsStore,
      savedHashes: BatchParameterHashes,
      savedSelectedUris: string[]
    ) => {
      setResults(savedResults);
      setParameterHashes(savedHashes);
      setSelectedScanUris(savedSelectedUris);
    },
    []
  );

  // =========================================================================
  // Return
  // =========================================================================

  return {
    // Results
    results,
    currentResult,
    resultCounts,
    getResult,

    // Selected scans
    selectedScanUris,
    setSelectedScanUris,

    // Tab navigation
    activeTab,
    setActiveTab,
    activeLinecutId,
    setActiveLinecutId,
    activeLinecuts,

    // Stale detection
    isStale,
    hasStaleResults,
    parameterHashes,

    // Processing state
    isProcessing,
    progress,
    progressMessage,

    // Overlay controls
    isResultsOpen,
    setIsResultsOpen,
    isSelectorOpen,
    setIsSelectorOpen,

    // Actions
    runBatchAll,
    cancelBatch,
    clearResults,
    restoreState
  };
}
