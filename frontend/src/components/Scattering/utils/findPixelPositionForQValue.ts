// // Helper function to find pixel position from q-value
// export function findPixelPositionForQValue(qValue: number, qVector: number[]): number {
//   if (!qVector || qVector.length === 0) {
//     return qValue; // Fallback to using the value directly if no mapping is available
//   }

//   // Find the index of the closest q-value in the qVector
//   let closestIndex = 0;
//   let smallestDifference = Math.abs(qVector[0] - qValue);

//   for (let i = 1; i < qVector.length; i++) {
//     const difference = Math.abs(qVector[i] - qValue);
//     if (difference < smallestDifference) {
//       smallestDifference = difference;
//       closestIndex = i;
//     }
//   }

//   return closestIndex; // Return the corresponding pixel position
// }




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
    return 0; // Fallback to 0 if no mapping is available
  }

  // For empty first row/column case
  if (!qMatrix[0] || qMatrix[0].length === 0) {
    return 0;
  }

  if (direction === 'horizontal') {
    // Find the row where q-values are closest to our target
    // For horizontal linecuts (using qYMatrix), we use the first column of each row
    let closestRow = 0;
    let smallestDifference = Math.abs(qMatrix[0][0] - qValue);

    for (let y = 0; y < qMatrix.length; y++) {
      if (qMatrix[y] && qMatrix[y][0] !== undefined) {
        const difference = Math.abs(qMatrix[y][0] - qValue);
        if (difference < smallestDifference) {
          smallestDifference = difference;
          closestRow = y;
        }
      }
    }
    return closestRow;
  } else {
    // Find the column where q-values are closest to our target
    // For vertical linecuts (using qXMatrix), we use the first row's columns
    let closestColumn = 0;
    let smallestDifference = Math.abs(qMatrix[0][0] - qValue);

    for (let x = 0; x < qMatrix[0].length; x++) {
      if (qMatrix[0][x] !== undefined) {
        const difference = Math.abs(qMatrix[0][x] - qValue);
        if (difference < smallestDifference) {
          smallestDifference = difference;
          closestColumn = x;
        }
      }
    }
    return closestColumn;
  }
}
