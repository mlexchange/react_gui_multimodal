import { binarySearchClosest } from './h5webUtils';

/**
 * Generic helper function to find pixel position from q-value using a matrix
 * @param qValue The q-value to find in the matrix
 * @param qMatrix The q-value matrix
 * @param direction 'horizontal' (searches rows) or 'vertical' (searches columns)
 * @returns The pixel index (row or column) corresponding to the q-value
 */
export function findPixelPositionForQValue(
  qValue: number,
  qMatrix: number[][],
  direction: 'horizontal' | 'vertical' = 'horizontal'
): number {
  if (!qMatrix || qMatrix.length === 0) {
    return 0;
  }

  if (!qMatrix[0] || qMatrix[0].length === 0) {
    return 0;
  }

  if (direction === 'horizontal') {
    // Extract first column values for binary search
    const columnValues = qMatrix.map(row => row[0]).filter(v => v !== undefined);
    return binarySearchClosest(columnValues, qValue);
  } else {
    // Use first row for binary search
    const rowValues = qMatrix[0].filter(v => v !== undefined);
    return binarySearchClosest(rowValues, qValue);
  }
}
