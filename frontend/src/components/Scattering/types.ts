// Scattering module types

export type DisplayOption = 'both' | 'max' | 'avg';

export interface Linecut {
  id: number;
  position: number;      // Q-value position (in q-space)
  pixelPosition: number; // Corresponding pixel position for data sampling
  leftColor: string;
  rightColor: string;
  hidden: boolean;
  width: number;
  type?: 'horizontal' | 'vertical';
}


export interface InclinedLinecut {
  id: number;
  xPosition?: number;    // Optional pixel X position
  yPosition?: number;    // Optional pixel Y position
  qXPosition: number;
  qYPosition: number;
  angle: number;
  width: number;
  qWidth: number;
  leftColor: string;
  rightColor: string;
  hidden: boolean;
  type: 'inclined';
}

export interface GenerateLinecutParams {
  linecut: Linecut;
  currentArray: number[][];
  factor: number | null;
  imageWidth?: number;
  imageHeight?: number;
  units?: string;
  qXMatrix?: number[][];
  qYMatrix?: number[][];
}

export interface ResolutionDataType {
    array1: number[][];
    array2: number[][];
    diff: number[][];
    factor: number | null;
  }

export interface AzimuthalIntegration {
        id: number;
        qRange: [number, number] | null;  // q-range for integration
        azimuthRange: [number, number];  // azimuthal range in degrees
        leftColor: string;
        rightColor: string;
        hidden: boolean;
      }

export interface AzimuthalData {
        id: number;
        q: number[];  // q values
        intensity: number[];  // integrated intensities
        qArray: number[][];  // 2D array of q values for visualization
      }


export interface CalibrationParams {
        sample_detector_distance: number;
        beam_center_x: number;
        beam_center_y: number;
        pixel_size_x: number;
        pixel_size_y: number;
        wavelength: number;
        tilt: number;
        tilt_plan_rotation: number;
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
