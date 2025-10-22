export function downsampleArray(array, factor) {
    const downsampled = [];
    for (let i = 0; i < array.length; i += factor) {
      const row = [];
      for (let j = 0; j < array[i].length; j += factor) {
        row.push(array[i][j]); // Select every nth pixel
      }
      downsampled.push(row);
    }
    return downsampled;
  }
