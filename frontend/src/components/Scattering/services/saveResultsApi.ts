/**
 * Save results to Tiled API service.
 *
 * Provides save functions and helper builders for persisting
 * linecut and batch processing results to a writable Tiled container.
 */

import type {
  CalibrationParams,
  BatchLinecutResult,
  Linecut,
  InclinedLinecut,
  AzimuthalIntegration,
  LinecutSaveParams,
  LinecutDataEntry,
  SaveResult
} from "../types";

// ============================================================================
// Helpers
// ============================================================================

/** Build linecut_params for a horizontal or vertical linecut. */
export function buildLinecutParams(
  linecut: Linecut,
  direction: "horizontal" | "vertical"
): LinecutSaveParams {
  return {
    type: direction,
    position: linecut.position,
    width: linecut.width
  };
}

/** Build linecut_params for an inclined linecut. */
export function buildInclinedLinecutParams(
  linecut: InclinedLinecut
): LinecutSaveParams {
  return {
    type: "inclined",
    q_x_position: linecut.qXPosition,
    q_y_position: linecut.qYPosition,
    angle: linecut.angle,
    q_width: linecut.qWidth
  };
}

/** Build linecut_params for an azimuthal integration. */
export function buildAzimuthalParams(
  integration: AzimuthalIntegration
): LinecutSaveParams {
  return {
    type: "azimuthal",
    q_range: integration.qRange,
    azimuth_range: integration.azimuthRange
  };
}

function buildCalibrationPayload(
  calibration: CalibrationParams,
  experimentType: string
) {
  const payload: Record<string, unknown> = {
    sample_detector_distance: calibration.sample_detector_distance ?? 0,
    beam_center_x: calibration.beam_center_x ?? 0,
    beam_center_y: calibration.beam_center_y ?? 0,
    pixel_size_x: calibration.pixel_size_x ?? 0,
    pixel_size_y: calibration.pixel_size_y ?? 0,
    wavelength: calibration.wavelength ?? 0,
    tilt: calibration.tilt ?? 0,
    tilt_plan_rotation: calibration.tilt_plan_rotation ?? 0,
    experiment_type: experimentType
  };
  if (experimentType !== "SAXS") {
    payload.incident_angle = calibration.incident_angle ?? 0;
  }
  return payload;
}

// ============================================================================
// Save Functions
// ============================================================================

/**
 * Save all linecuts from a graph card to Tiled as a single DataFrame.
 * Columns: q (or path_distance), linecut_1_left, linecut_1_right, ...
 */
export async function saveLinecutsToTiled(params: {
  scanUris: string[];
  scanNames: string[];
  calibration: CalibrationParams;
  experimentType: string;
  qValues: number[];
  linecuts: LinecutDataEntry[];
}): Promise<SaveResult> {
  const response = await fetch("/api/save-linecuts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scan_uris: params.scanUris,
      scan_names: params.scanNames,
      calibration: buildCalibrationPayload(
        params.calibration,
        params.experimentType
      ),
      q_values: params.qValues,
      linecuts: params.linecuts
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to save: ${errorText}`);
  }

  const result = (await response.json()) as SaveResult;
  if (!result.success) {
    throw new Error(result.message);
  }
  return result;
}

/**
 * Save batch processing results to Tiled.
 */
export async function saveBatchToTiled(params: {
  calibration: CalibrationParams;
  experimentType: string;
  linecutParameters: LinecutSaveParams;
  results: BatchLinecutResult[];
}): Promise<SaveResult> {
  const response = await fetch("/api/save-batch-results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      calibration: buildCalibrationPayload(
        params.calibration,
        params.experimentType
      ),
      linecut_parameters: params.linecutParameters,
      results: params.results.map((r) => ({
        scan_uri: r.scan_uri,
        scan_name: r.scan_name,
        q_values: r.q_values,
        intensities: r.intensities,
        success: r.success
      }))
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to save: ${errorText}`);
  }

  const result = (await response.json()) as SaveResult;
  if (!result.success) {
    throw new Error(result.message);
  }
  return result;
}
