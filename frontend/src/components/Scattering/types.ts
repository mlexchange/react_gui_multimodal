// Scattering module types

export type DisplayOption = "both" | "max" | "avg";

export type OperationType = "subtract" | "divide";

export interface Linecut {
  id: number;
  position: number; // Q-value position (in q-space)
  pixelPosition: number; // Corresponding pixel position for data sampling
  leftColor: string;
  rightColor: string;
  hidden: boolean;
  width: number;
  type?: "horizontal" | "vertical";
}

export interface InclinedLinecut {
  id: number;
  xPosition?: number; // Optional pixel X position
  yPosition?: number; // Optional pixel Y position
  qXPosition: number;
  qYPosition: number;
  angle: number;
  width: number;
  qWidth: number;
  leftColor: string;
  rightColor: string;
  hidden: boolean;
  type: "inclined";
}

export interface AzimuthalIntegration {
  id: number;
  qRange: [number, number] | null; // q-range for integration
  azimuthRange: [number, number]; // azimuthal range in degrees
  leftColor: string;
  rightColor: string;
  hidden: boolean;
}

export interface AzimuthalData {
  id: number;
  q: number[]; // q values
  intensity: number[]; // integrated intensities
  qArray: number[][]; // 2D array of q values for visualization
}

export interface CalibrationParams {
  sample_detector_distance?: number;
  beam_center_x?: number;
  beam_center_y?: number;
  pixel_size_x?: number;
  pixel_size_y?: number;
  wavelength?: number;
  tilt?: number;
  tilt_plan_rotation?: number;
  incident_angle?: number; // For GISAXS (degrees)
}

// Required fields that must be set before analysis can proceed
const REQUIRED_CALIBRATION_FIELDS: (keyof CalibrationParams)[] = [
  "sample_detector_distance",
  "beam_center_x",
  "beam_center_y",
  "pixel_size_x",
  "pixel_size_y",
  "wavelength"
];

/**
 * Check if all required calibration parameters are set and valid
 * @param params - CalibrationParams object or null
 * @returns true if all required fields are set and are valid numbers
 */
export function isCalibrationComplete(
  params: CalibrationParams | null
): boolean {
  if (!params) return false;
  return REQUIRED_CALIBRATION_FIELDS.every((key) => {
    const value = params[key];
    return value !== undefined && !isNaN(value);
  });
}

/**
 * Check if GISAXS-specific calibration is complete (includes incident_angle)
 * @param params - CalibrationParams object or null
 * @returns true if base calibration is complete AND incident_angle is set
 */
export function isGisaxsCalibrationComplete(
  params: CalibrationParams | null
): boolean {
  if (!isCalibrationComplete(params)) return false;
  const incidentAngle = params?.incident_angle;
  return incidentAngle !== undefined && !isNaN(incidentAngle);
}

export interface TransformDataFunction {
  /**
   * Transform two 2D arrays of data based on specified processing options
   *
   * @param data1 - First 2D array of intensity values to transform
   * @param data2 - Second 2D array of intensity values to transform
   * @param isLog - Whether to apply logarithmic scaling to the data
   * @param lowerPerc - Lower percentile boundary for clipping (0-100)
   * @param upperPerc - Upper percentile boundary for clipping (0-100)
   * @param normalization - Normalization method ('none', 'minmax', or 'mean')
   * @param normalizationMode - How to apply normalization ('together' or 'separate')
   * @returns Object containing the transformed arrays
   */
  (
    data1: number[][],
    data2: number[][],
    isLog: boolean,
    lowerPerc: number,
    upperPerc: number,
    normalization: string,
    normalizationMode: string
  ): {
    array1: number[][];
    array2: number[][];
  };
}

export interface ScatteringProps {
  isCollapsed: boolean;
  isThirdCollapsed: boolean;
  onToggleCollapse?: () => void;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Base result from linecut extraction API.
 */
export interface LinecutResult {
  q_values: number[];
  intensities: number[];
  success: boolean;
  error_message: string | null;
}

/**
 * Extended linecut result for batch processing, includes scan identification.
 */
export interface BatchLinecutResult extends LinecutResult {
  scan_uri: string;
  scan_name: string;
}
