export const calculateDifferenceArray = (array1: number[][], array2: number[][]): number[][] => {
    if (!array1?.length || !array2?.length || !array1[0] || !array2[0]) {
        return [];
    }

    if (array2.length !== array1.length || array2[0].length !== array1[0].length) {
        console.warn('Arrays have mismatched dimensions');
        return [];
    }

    return array1.map((row, i) => {
        const row2 = array2[i];
        return row.map((val, j) => val - row2[j]);
    });
};
