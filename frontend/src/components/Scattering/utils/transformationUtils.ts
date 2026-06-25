/**
 * Calculate global percentiles across two 2D arrays
 * Used for calculating initial domain bounds (e.g., 1% and 99% percentiles)
 */
export const calculateGlobalPercentiles = (
  data1: number[][],
  data2: number[][],
  lowPercentile: number,
  highPercentile: number
): [number, number] => {
  // Calculate total length first (excluding NaN values)
  let totalLength = 0;
  for (let i = 0; i < data1.length; i++) {
    for (let j = 0; j < data1[i].length; j++) {
      if (!Number.isNaN(data1[i][j])) totalLength++;
    }
  }
  for (let i = 0; i < data2.length; i++) {
    for (let j = 0; j < data2[i].length; j++) {
      if (!Number.isNaN(data2[i][j])) totalLength++;
    }
  }

  // Pre-allocate array
  const values = new Float32Array(totalLength);
  let idx = 0;

  // Fill array with non-NaN values
  for (let i = 0; i < data1.length; i++) {
    for (let j = 0; j < data1[i].length; j++) {
      if (!Number.isNaN(data1[i][j])) {
        values[idx++] = data1[i][j];
      }
    }
  }
  for (let i = 0; i < data2.length; i++) {
    for (let j = 0; j < data2[i].length; j++) {
      if (!Number.isNaN(data2[i][j])) {
        values[idx++] = data2[i][j];
      }
    }
  }

  // Sort the values
  values.sort();

  // Calculate percentile indices
  const lowIndex = Math.ceil((lowPercentile / 100) * totalLength);
  const highIndex = Math.floor((highPercentile / 100) * totalLength);

  return [values[lowIndex], values[highIndex]];
};
