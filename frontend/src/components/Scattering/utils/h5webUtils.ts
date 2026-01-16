/**
 * H5Web visualization utilities and constants
 */

import ndarray, { NdArray } from 'ndarray';

/**
 * H5Web axis offset constants (from h5web/packages/lib/src/vis/utils.ts)
 * With labels: left = 80 (ticks) + 24 (label) = 104, right = 24
 */
export const AXIS_LEFT_OFFSET = 104;  // px for y-axis ticks + label
export const AXIS_RIGHT_OFFSET = 24;  // px for right padding

/**
 * Format tick value as integer (no scientific notation)
 */
export const formatTickAsInteger = (val: number): string => {
  return Math.round(val).toLocaleString('en-US', { useGrouping: false });
};

/**
 * Convert 2D number array to ndarray for H5Web visualization
 */
export const arrayToNdarray = (arr: number[][]): NdArray<Float32Array> | null => {
  if (!arr || arr.length === 0 || !arr[0] || arr[0].length === 0) {
    return null;
  }
  const height = arr.length;
  const width = arr[0].length;
  const flat = new Float32Array(height * width);
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      flat[i * width + j] = arr[i][j];
    }
  }
  return ndarray(flat, [height, width]);
};
