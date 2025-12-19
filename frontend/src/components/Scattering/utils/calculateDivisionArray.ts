export const calculateDivisionArray = (array1: number[][], array2: number[][]): number[][] => {
    if (!array1?.length || !array2?.length || !array1[0] || !array2[0]) {
        return [];
    }

    if (array2.length !== array1.length || array2[0].length !== array1[0].length) {
        return [];
    }

    // Avoid division by zero - return numerator when denominator is zero
    return array1.map((row, i) => {
        const row2 = array2[i];
        return row.map((val, j) => {
            const divisor = row2[j];
            return divisor === 0 ? val : val / divisor;
        });
    });
};
