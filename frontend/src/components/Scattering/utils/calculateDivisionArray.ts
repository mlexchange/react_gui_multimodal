  // Function to calculate division array
  export const calculateDivisionArray = (array1: number[][], array2: number[][]): number[][] => {
    if (!array1.length || !array2.length ||
        array1.length !== array2.length ||
        array1[0].length !== array2[0].length) {
      return [];
    }

    const result: number[][] = [];
    for (let i = 0; i < array1.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < array1[i].length; j++) {
        // Avoid division by zero, divid by 1 if denominator is zero
        if (array2[i][j] === 0) {
          row.push(array1[i][j] / 1);
        } else {
          row.push(array1[i][j] / array2[i][j]);
        }
      }
      result.push(row);
    }
    return result;
  };
