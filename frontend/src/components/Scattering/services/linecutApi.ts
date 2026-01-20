/**
 * Linecut and Azimuthal Integration API service.
 *
 * Provides debounced API calls to backend endpoints for:
 * - Horizontal, vertical, and inclined linecuts
 * - Azimuthal integration
 *
 * Uses msgpack for efficient binary response handling.
 */

import { unpack } from "msgpackr";
import { debounce } from "lodash";
import { CalibrationParams, LinecutResult } from "../types";

// ============================================================================
// Types - Linecuts
// ============================================================================

export interface HorizontalLinecutParams {
  scanUri: string;
  calibration: CalibrationParams;
  experimentType: string;
  position: number;
  width: number;
  maskUri?: string | null;
}

export interface VerticalLinecutParams {
  scanUri: string;
  calibration: CalibrationParams;
  experimentType: string;
  position: number;
  width: number;
  maskUri?: string | null;
}

export interface InclinedLinecutParams {
  scanUri: string;
  calibration: CalibrationParams;
  experimentType: string;
  qXPosition: number;
  qYPosition: number;
  angle: number;
  qWidth: number;
  maskUri?: string | null;
}

// ============================================================================
// Types - Azimuthal Integration
// ============================================================================

export interface AzimuthalIntegrationParams {
  leftScanUri: string;
  rightScanUri: string;
  calibration: CalibrationParams;
  azimuthStart: number;
  azimuthEnd: number;
  qRangeStart?: number | null;
  qRangeEnd?: number | null;
  maskUri?: string | null;
}

export interface AzimuthalIntegrationResult {
  q_max: number;
  q_1: number[];
  q_2: number[];
  intensity_1: number[];
  intensity_2: number[];
  q_array_filtered_1: number[][];
  q_array_filtered_2: number[][];
  success: boolean;
  error_message: string | null;
}

// ============================================================================
// Internal fetch function - Linecuts
// ============================================================================

/**
 * Internal function to fetch linecut data from the backend.
 */
async function fetchLinecutInternal(
  linecutType: "horizontal" | "vertical" | "inclined",
  params:
    | HorizontalLinecutParams
    | VerticalLinecutParams
    | InclinedLinecutParams,
  signal?: AbortSignal
): Promise<LinecutResult> {
  // Build request body based on linecut type
  const baseBody = {
    scan_uri: params.scanUri,
    calibration: {
      sample_detector_distance: params.calibration.sample_detector_distance,
      beam_center_x: params.calibration.beam_center_x,
      beam_center_y: params.calibration.beam_center_y,
      pixel_size_x: params.calibration.pixel_size_x,
      pixel_size_y: params.calibration.pixel_size_y,
      wavelength: params.calibration.wavelength,
      tilt: params.calibration.tilt ?? 0,
      tilt_plan_rotation: params.calibration.tilt_plan_rotation ?? 0,
      experiment_type: params.experimentType,
      incident_angle: params.calibration.incident_angle ?? 0
    },
    linecut_type: linecutType,
    mask_uri: params.maskUri || null
  };

  let requestBody: object;

  if (linecutType === "horizontal" || linecutType === "vertical") {
    const typedParams = params as
      | HorizontalLinecutParams
      | VerticalLinecutParams;
    requestBody = {
      ...baseBody,
      position: typedParams.position,
      width: typedParams.width
    };
  } else {
    const typedParams = params as InclinedLinecutParams;
    requestBody = {
      ...baseBody,
      q_x_position: typedParams.qXPosition,
      q_y_position: typedParams.qYPosition,
      angle: typedParams.angle,
      q_width: typedParams.qWidth
    };
  }

  const response = await fetch("/api/extract-linecut", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      q_values: [],
      intensities: [],
      success: false,
      error_message: `Request failed: ${response.status} - ${errorText}`
    };
  }

  const buffer = await response.arrayBuffer();
  return unpack(new Uint8Array(buffer)) as LinecutResult;
}

// ============================================================================
// Internal fetch function - Azimuthal Integration
// ============================================================================

/**
 * Internal function to fetch azimuthal integration data from the backend.
 */
async function fetchAzimuthalInternal(
  params: AzimuthalIntegrationParams,
  signal?: AbortSignal
): Promise<AzimuthalIntegrationResult> {
  const url = new URL("/api/azimuthal-integrator", window.location.origin);

  // Add scan URIs
  url.searchParams.set("left_scan_uri", params.leftScanUri);
  url.searchParams.set("right_scan_uri", params.rightScanUri);

  // Add calibration parameters
  const cal = params.calibration;
  url.searchParams.set(
    "sample_detector_distance",
    cal.sample_detector_distance.toString()
  );
  url.searchParams.set("beam_center_x", cal.beam_center_x.toString());
  url.searchParams.set("beam_center_y", cal.beam_center_y.toString());
  url.searchParams.set("pixel_size_x", cal.pixel_size_x.toString());
  url.searchParams.set("pixel_size_y", cal.pixel_size_y.toString());
  url.searchParams.set("wavelength", cal.wavelength.toString());
  url.searchParams.set("tilt", (cal.tilt ?? 0).toString());
  url.searchParams.set(
    "tilt_plan_rotation",
    (cal.tilt_plan_rotation ?? 0).toString()
  );

  // Add azimuth range (split parameters)
  url.searchParams.set("azimuth_start_deg", params.azimuthStart.toString());
  url.searchParams.set("azimuth_end_deg", params.azimuthEnd.toString());

  // Add q-range if provided (split parameters)
  if (params.qRangeStart != null) {
    url.searchParams.set("q_range_start", params.qRangeStart.toString());
  }
  if (params.qRangeEnd != null) {
    url.searchParams.set("q_range_end", params.qRangeEnd.toString());
  }

  // Add mask URI if provided
  if (params.maskUri) {
    url.searchParams.set("mask_uri", params.maskUri);
  }

  const response = await fetch(url.toString(), { signal });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      q_max: 0,
      q_1: [],
      q_2: [],
      intensity_1: [],
      intensity_2: [],
      q_array_filtered_1: [],
      q_array_filtered_2: [],
      success: false,
      error_message: `Request failed: ${response.status} - ${errorText}`
    };
  }

  const buffer = await response.arrayBuffer();
  const data = unpack(new Uint8Array(buffer)) as Omit<
    AzimuthalIntegrationResult,
    "success" | "error_message"
  >;
  return {
    ...data,
    success: true,
    error_message: null
  };
}

// ============================================================================
// Debounce Configuration
// ============================================================================

const DEBOUNCE_DELAY_MS = 300;

// Track active abort controllers for cancellation
const activeControllers: Map<string, AbortController> = new Map();

/**
 * Get or create abort controller for a linecut.
 * Cancels any previous pending request for the same linecut.
 */
function getAbortController(linecutKey: string): AbortController {
  // Cancel any existing request for this linecut
  const existing = activeControllers.get(linecutKey);
  if (existing) {
    existing.abort();
  }

  // Create new controller
  const controller = new AbortController();
  activeControllers.set(linecutKey, controller);
  return controller;
}

/**
 * Clean up abort controller after request completes.
 */
function cleanupController(linecutKey: string, controller: AbortController) {
  // Only remove if it's still the current controller
  if (activeControllers.get(linecutKey) === controller) {
    activeControllers.delete(linecutKey);
  }
}

// ============================================================================
// Public API - Debounced fetch functions
// ============================================================================

export type LinecutCallback = (result: LinecutResult) => void;
export type ErrorCallback = (error: Error) => void;

interface DebouncedFetchOptions {
  onSuccess: LinecutCallback;
  onError?: ErrorCallback;
}

/**
 * Map of debounced functions per linecut key.
 * Each linecut (identified by type + id) gets its own debounced function
 * so that left and right scan requests don't interfere with each other.
 */
const debouncedFetchers: Map<string, ReturnType<typeof debounce>> = new Map();

/**
 * Get or create a debounced fetcher for a specific linecut key.
 *
 * Each linecut key gets its own debounced function so that:
 * - Left and right scan requests have separate debounce timers
 * - Rapid updates to the same linecut are debounced together
 */
function getDebouncedFetcher<
  T extends
    | HorizontalLinecutParams
    | VerticalLinecutParams
    | InclinedLinecutParams
>(
  linecutKey: string,
  linecutType: "horizontal" | "vertical" | "inclined"
): (params: T, options: DebouncedFetchOptions) => void {
  let fetcher = debouncedFetchers.get(linecutKey);

  if (!fetcher) {
    fetcher = debounce(
      async (params: T, options: DebouncedFetchOptions) => {
        const controller = getAbortController(linecutKey);

        try {
          const result = await fetchLinecutInternal(
            linecutType,
            params,
            controller.signal
          );
          options.onSuccess(result);
        } catch (error) {
          // Ignore abort errors - they're expected when cancelling
          if (error instanceof Error && error.name === "AbortError") {
            return;
          }
          if (options.onError) {
            options.onError(
              error instanceof Error ? error : new Error(String(error))
            );
          }
        } finally {
          cleanupController(linecutKey, controller);
        }
      },
      DEBOUNCE_DELAY_MS,
      { leading: false, trailing: true }
    );
    debouncedFetchers.set(linecutKey, fetcher);
  }

  return fetcher as (params: T, options: DebouncedFetchOptions) => void;
}

/**
 * Fetch horizontal linecut data with debouncing.
 *
 * @param linecutId - Unique identifier for this linecut (1, 2, 3...)
 * @param side - Which image side ('left' or 'right')
 * @param params - Linecut parameters
 * @param options - Callback options for success/error handling
 */
export function fetchHorizontalLinecut(
  linecutId: number,
  side: "left" | "right",
  params: HorizontalLinecutParams,
  options: DebouncedFetchOptions
): void {
  const key = `horizontal-${side}-${linecutId}`;
  const fetcher = getDebouncedFetcher<HorizontalLinecutParams>(
    key,
    "horizontal"
  );
  fetcher(params, options);
}

/**
 * Fetch vertical linecut data with debouncing.
 *
 * @param linecutId - Unique identifier for this linecut (1, 2, 3...)
 * @param side - Which image side ('left' or 'right')
 * @param params - Linecut parameters
 * @param options - Callback options for success/error handling
 */
export function fetchVerticalLinecut(
  linecutId: number,
  side: "left" | "right",
  params: VerticalLinecutParams,
  options: DebouncedFetchOptions
): void {
  const key = `vertical-${side}-${linecutId}`;
  const fetcher = getDebouncedFetcher<VerticalLinecutParams>(key, "vertical");
  fetcher(params, options);
}

/**
 * Fetch inclined linecut data with debouncing.
 *
 * @param linecutId - Unique identifier for this linecut (1, 2, 3...)
 * @param side - Which image side ('left' or 'right')
 * @param params - Linecut parameters
 * @param options - Callback options for success/error handling
 */
export function fetchInclinedLinecut(
  linecutId: number,
  side: "left" | "right",
  params: InclinedLinecutParams,
  options: DebouncedFetchOptions
): void {
  const key = `inclined-${side}-${linecutId}`;
  const fetcher = getDebouncedFetcher<InclinedLinecutParams>(key, "inclined");
  fetcher(params, options);
}

// ============================================================================
// Azimuthal Integration - Debounced Fetch
// ============================================================================

export type AzimuthalCallback = (result: AzimuthalIntegrationResult) => void;

interface AzimuthalFetchOptions {
  onSuccess: AzimuthalCallback;
  onError?: ErrorCallback;
}

/**
 * Fetch azimuthal integration data with debouncing.
 *
 * Unlike linecuts which fetch left and right separately, azimuthal integration
 * fetches both images in a single request.
 *
 * @param integrationId - Unique identifier for this integration (1, 2, 3...)
 * @param params - Azimuthal integration parameters (includes both scan URIs)
 * @param options - Callback options for success/error handling
 */
export function fetchAzimuthalIntegration(
  integrationId: number,
  params: AzimuthalIntegrationParams,
  options: AzimuthalFetchOptions
): void {
  const key = `azimuthal-${integrationId}`;

  // Get or create debounced fetcher for this key
  let fetcher = debouncedFetchers.get(key);
  if (!fetcher) {
    fetcher = debounce(
      async (p: AzimuthalIntegrationParams, opts: AzimuthalFetchOptions) => {
        const controller = getAbortController(key);
        try {
          const result = await fetchAzimuthalInternal(p, controller.signal);
          opts.onSuccess(result);
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            return;
          }
          if (opts.onError) {
            opts.onError(
              error instanceof Error ? error : new Error(String(error))
            );
          }
        } finally {
          cleanupController(key, controller);
        }
      },
      DEBOUNCE_DELAY_MS,
      { leading: false, trailing: true }
    );
    debouncedFetchers.set(key, fetcher);
  }

  (
    fetcher as (
      p: AzimuthalIntegrationParams,
      opts: AzimuthalFetchOptions
    ) => void
  )(params, options);
}

/**
 * Cancel pending azimuthal integration request.
 *
 * @param integrationId - Unique identifier for the integration
 */
export function cancelAzimuthalRequest(integrationId: number): void {
  const key = `azimuthal-${integrationId}`;

  const controller = activeControllers.get(key);
  if (controller) {
    controller.abort();
    activeControllers.delete(key);
  }

  const fetcher = debouncedFetchers.get(key);
  if (fetcher) {
    fetcher.cancel();
    debouncedFetchers.delete(key);
  }
}

// ============================================================================
// Cancel Functions
// ============================================================================

/**
 * Cancel all pending requests (linecuts and azimuthal).
 */
export function cancelAllPendingRequests(): void {
  // Cancel all in-flight requests
  for (const controller of activeControllers.values()) {
    controller.abort();
  }
  activeControllers.clear();

  // Cancel all debounced functions
  for (const fetcher of debouncedFetchers.values()) {
    fetcher.cancel();
  }
  debouncedFetchers.clear();
}

/**
 * Cancel pending request for a specific linecut.
 *
 * @param linecutType - Type of linecut ('horizontal', 'vertical', 'inclined')
 * @param linecutId - Unique identifier for this linecut (1, 2, 3...)
 * @param side - Which image side ('left' or 'right')
 */
export function cancelLinecutRequest(
  linecutType: "horizontal" | "vertical" | "inclined",
  linecutId: number,
  side: "left" | "right"
): void {
  const key = `${linecutType}-${side}-${linecutId}`;

  // Cancel in-flight request
  const controller = activeControllers.get(key);
  if (controller) {
    controller.abort();
    activeControllers.delete(key);
  }

  // Cancel debounced function
  const fetcher = debouncedFetchers.get(key);
  if (fetcher) {
    fetcher.cancel();
    debouncedFetchers.delete(key);
  }
}

// ============================================================================
// Q-Vectors API - For overlay rendering
// ============================================================================

export interface QVectorsParams {
  calibration: CalibrationParams;
  experimentType: string;
  imageWidth: number;
  imageHeight: number;
}

export interface QVectorsResult {
  q_x: number[][];
  q_y: number[][];
}

/**
 * Fetch Q-vectors (q_x and q_y matrices) from the backend.
 * Used for computing Q-magnitude matrix for azimuthal overlay rendering.
 *
 * @param params - Parameters including calibration, experiment type, and image dimensions
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to q_x and q_y matrices
 */
export async function fetchQVectors(
  params: QVectorsParams,
  signal?: AbortSignal
): Promise<QVectorsResult> {
  const url = new URL("/api/q-space", window.location.origin);

  const cal = params.calibration;
  url.searchParams.set(
    "sample_detector_distance",
    cal.sample_detector_distance.toString()
  );
  url.searchParams.set("beam_center_x", cal.beam_center_x.toString());
  url.searchParams.set("beam_center_y", cal.beam_center_y.toString());
  url.searchParams.set("pixel_size_x", cal.pixel_size_x.toString());
  url.searchParams.set("pixel_size_y", cal.pixel_size_y.toString());
  url.searchParams.set("wavelength", cal.wavelength.toString());
  url.searchParams.set("tilt", (cal.tilt ?? 0).toString());
  url.searchParams.set(
    "tilt_plan_rotation",
    (cal.tilt_plan_rotation ?? 0).toString()
  );
  url.searchParams.set("experiment_type", params.experimentType);
  url.searchParams.set("incident_angle", (cal.incident_angle ?? 0).toString());
  url.searchParams.set("image_width", params.imageWidth.toString());
  url.searchParams.set("image_height", params.imageHeight.toString());

  const response = await fetch(url.toString(), { signal });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch Q-vectors: ${response.status} - ${errorText}`
    );
  }

  const buffer = await response.arrayBuffer();
  return unpack(new Uint8Array(buffer)) as QVectorsResult;
}
