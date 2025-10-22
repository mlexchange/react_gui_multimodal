

export const calculateGlobalPercentiles = (
    data1: number[][],
    data2: number[][],
    lowPercentile: number,
    highPercentile: number
  ): [number, number] => {
    // Calculate total length first
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


export const calculateMinMax = (data1: number[][], data2: number[][]) => {
    let min = Infinity;
    let max = -Infinity;

    // Calculate min and max across both arrays
    for (let i = 0; i < data1.length; i++) {
        for (let j = 0; j < data1[i].length; j++) {
            const val = data1[i][j];
            if (!Number.isNaN(val)) {
                min = Math.min(min, val);
                max = Math.max(max, val);
            }
        }
    }
    for (let i = 0; i < data2.length; i++) {
        for (let j = 0; j < data2[i].length; j++) {
            const val = data2[i][j];
            if (!Number.isNaN(val)) {
                min = Math.min(min, val);
                max = Math.max(max, val);
            }
        }
    }

    return { min, max };
  };


export const calculateMeanStd = (data1: number[][], data2: number[][]) => {
        let sum = 0;
        let count = 0;

        // First pass: calculate mean
        for (let i = 0; i < data1.length; i++) {
            for (let j = 0; j < data1[i].length; j++) {
                const val = data1[i][j];
                if (!Number.isNaN(val)) {
                    sum += val;
                    count++;
                }
            }
        }
        for (let i = 0; i < data2.length; i++) {
            for (let j = 0; j < data2[i].length; j++) {
                const val = data2[i][j];
                if (!Number.isNaN(val)) {
                    sum += val;
                    count++;
                }
            }
        }

        const mean = sum / count;

        // Second pass: calculate variance
        let variance = 0;
        for (let i = 0; i < data1.length; i++) {
            for (let j = 0; j < data1[i].length; j++) {
                const val = data1[i][j];
                if (!Number.isNaN(val)) {
                    variance += Math.pow(val - mean, 2);
                }
            }
        }
        for (let i = 0; i < data2.length; i++) {
            for (let j = 0; j < data2[i].length; j++) {
                const val = data2[i][j];
                if (!Number.isNaN(val)) {
                    variance += Math.pow(val - mean, 2);
                }
            }
        }

        const std = Math.sqrt(variance / count);

        return { mean, std };
    };

// Clip array to the percentile bounds
export const clipArray = (arr: number[][], minVal: number, maxVal: number) =>
      arr.map(row => row.map(val =>
        Number.isNaN(val) ? val :  // Preserve NaN values
        val < minVal ? minVal : (val > maxVal ? maxVal : val)
      ));
