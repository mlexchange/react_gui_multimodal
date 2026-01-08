import { useState, useCallback, useEffect, useRef } from 'react';
import { notifications } from '@/components/ui';
import { unpack } from 'msgpackr';
import { CalibrationParams } from '../types';

// ============================================================================
// Types
// ============================================================================

export type BatchOperationType = 'horizontal' | 'vertical' | 'inclined' | 'azimuthal';
export type BatchStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed';

export interface LinecutResult {
  scan_uri: string;
  scan_name: string;
  q_values: number[];
  intensities: number[];
  success: boolean;
  error_message: string | null;
}

export interface BatchJob {
  id: string | null;
  type: BatchOperationType;
  status: BatchStatus;
  progress: number;
  message: string;
  currentScan: string | null;
  results: LinecutResult[];
  totalScans: number;
  successful: number;
  failed: number;
}

export interface HorizontalLinecutParams {
  position: number;
  width: number;
}

export interface VerticalLinecutParams {
  position: number;
  width: number;
}

export interface InclinedLinecutParams {
  q_x_position: number;
  q_y_position: number;
  angle: number;
  q_width: number;
}

export interface AzimuthalParams {
  azimuth_range: [number, number];
  q_range: [number, number] | null;
}

export type BatchProcessingParams = {
  horizontal?: HorizontalLinecutParams;
  vertical?: VerticalLinecutParams;
  inclined?: InclinedLinecutParams;
  azimuthal?: AzimuthalParams;
};

interface BatchProgressUpdate {
  progress: number;
  message: string;
  batch_id?: string;
  type?: string;
  current_scan?: string;
}

// ============================================================================
// Hook
// ============================================================================

export default function useBatchProcessing(
  calibrationParams: CalibrationParams | null,
  experimentType: string
) {
  // Current batch job state
  const [currentJob, setCurrentJob] = useState<BatchJob>({
    id: null,
    type: 'horizontal',
    status: 'idle',
    progress: 0,
    message: '',
    currentScan: null,
    results: [],
    totalScans: 0,
    successful: 0,
    failed: 0,
  });

  // Controls for the batch results overlay
  const [isResultsOpen, setIsResultsOpen] = useState(false);

  // Controls for the scan selector dialog
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  // Track which operation type the selector is for
  const [selectorOperationType, setSelectorOperationType] = useState<BatchOperationType>('horizontal');

  // WebSocket reference for batch progress updates
  const wsRef = useRef<WebSocket | null>(null);
  const currentBatchIdRef = useRef<string | null>(null);

  // Setup WebSocket connection for batch progress updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = process.env.NODE_ENV === 'production'
      ? `${protocol}//${window.location.host}/ws/progress`
      : 'ws://127.0.0.1:8000/ws/progress';

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[Batch] WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        if (event.data === 'pong') return;

        const data: BatchProgressUpdate = JSON.parse(event.data);

        // Only handle batch updates that match our current job
        if (data.type === 'batch' && data.batch_id === currentBatchIdRef.current) {
          setCurrentJob(prev => ({
            ...prev,
            progress: data.progress,
            message: data.message,
            currentScan: data.current_scan || null,
            status: data.progress >= 100 ? 'completed' : 'running',
          }));
        }
      } catch (error) {
        console.error('[Batch] Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[Batch] WebSocket error:', error);
    };

    wsRef.current = ws;

    // Ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  /**
   * Open the batch scan selector for a specific operation type
   */
  const openBatchSelector = useCallback((operationType: BatchOperationType) => {
    setSelectorOperationType(operationType);
    setIsSelectorOpen(true);
  }, []);

  /**
   * Start a batch processing job
   */
  const startBatchJob = useCallback(async (
    operationType: BatchOperationType,
    scanUris: string[],
    params: BatchProcessingParams
  ) => {
    if (!calibrationParams) {
      notifications.show({
        id: 'batch-calibration-error',
        title: 'Error',
        message: 'Calibration parameters are required for batch processing',
        autoClose: 5000,
      });
      // Update to error style immediately
      notifications.update({
        id: 'batch-calibration-error',
        title: 'Error',
        message: 'Calibration parameters are required for batch processing',
        color: 'red',
        autoClose: 5000,
      });
      throw new Error('Calibration parameters required');
    }

    // Reset job state
    setCurrentJob({
      id: null,
      type: operationType,
      status: 'pending',
      progress: 0,
      message: 'Starting batch processing...',
      currentScan: null,
      results: [],
      totalScans: scanUris.length,
      successful: 0,
      failed: 0,
    });

    // Close selector, open will be handled by results
    setIsSelectorOpen(false);

    // Show loading notification
    notifications.show({
      id: 'batch-processing',
      loading: true,
      title: `Batch ${operationType} processing`,
      message: `Processing ${scanUris.length} scans...`,
      autoClose: false,
    });

    try {
      // Determine endpoint and request body
      const isAzimuthal = operationType === 'azimuthal';
      const endpoint = isAzimuthal ? '/api/batch-azimuthal' : '/api/batch-linecut';

      // Validate required calibration parameters
      const requiredParams = [
        'sample_detector_distance',
        'beam_center_x',
        'beam_center_y',
        'pixel_size_x',
        'pixel_size_y',
        'wavelength',
      ] as const;

      const missingParams = requiredParams.filter(
        (param) => calibrationParams[param] === null || calibrationParams[param] === undefined
      );

      if (missingParams.length > 0) {
        const errorMessage = `Missing required calibration parameters: ${missingParams.join(', ')}`;
        notifications.show({
          id: 'batch-calibration-missing',
          title: 'Missing Calibration',
          message: errorMessage,
          autoClose: 5000,
        });
        notifications.update({
          id: 'batch-calibration-missing',
          title: 'Missing Calibration',
          message: errorMessage,
          color: 'red',
          autoClose: 5000,
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
        incident_angle: calibrationParams.incident_angle ?? 0,
      };

      const requestBody = isAzimuthal
        ? {
            scan_uris: scanUris,
            calibration,
            azimuthal_params: params.azimuthal,
          }
        : {
            scan_uris: scanUris,
            calibration,
            linecut_type: operationType,
            linecut_params: params[operationType],
          };

      // Make the API call
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Batch processing failed: ${errorText}`);
      }

      // Decode msgpack response
      const arrayBuffer = await response.arrayBuffer();
      const result = unpack(new Uint8Array(arrayBuffer)) as {
        batch_id: string;
        operation_type: string;
        total_scans: number;
        successful: number;
        failed: number;
        results: LinecutResult[];
      };

      // Store batch_id for WebSocket filtering
      currentBatchIdRef.current = result.batch_id;

      // Update job state with results
      setCurrentJob(prev => ({
        ...prev,
        id: result.batch_id,
        status: 'completed',
        progress: 100,
        message: `Complete: ${result.successful} successful, ${result.failed} failed`,
        results: result.results,
        successful: result.successful,
        failed: result.failed,
      }));

      // Show success notification
      notifications.update({
        id: 'batch-processing',
        color: 'green',
        title: 'Batch processing complete',
        message: `Processed ${result.total_scans} scans (${result.successful} successful, ${result.failed} failed)`,
        autoClose: 3000,
      });

      // Auto-open results overlay
      setIsResultsOpen(true);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      setCurrentJob(prev => ({
        ...prev,
        status: 'failed',
        message: errorMessage,
      }));

      notifications.update({
        id: 'batch-processing',
        color: 'red',
        title: 'Batch processing failed',
        message: errorMessage,
        autoClose: 5000,
      });

      throw error;
    }
  }, [calibrationParams, experimentType]);

  /**
   * Clear the current batch job
   */
  const clearJob = useCallback(() => {
    currentBatchIdRef.current = null;
    setCurrentJob({
      id: null,
      type: 'horizontal',
      status: 'idle',
      progress: 0,
      message: '',
      currentScan: null,
      results: [],
      totalScans: 0,
      successful: 0,
      failed: 0,
    });
    setIsResultsOpen(false);
  }, []);

  return {
    // Job state
    currentJob,
    isProcessing: currentJob.status === 'pending' || currentJob.status === 'running',

    // Results overlay control
    isResultsOpen,
    setIsResultsOpen,

    // Scan selector control
    isSelectorOpen,
    setIsSelectorOpen,
    selectorOperationType,
    openBatchSelector,

    // Actions
    startBatchJob,
    clearJob,
  };
}
