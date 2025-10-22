export const calculateDifferenceArray = (array1: number[][], array2: number[][]): number[][] => {
    // Check if arrays exist and have content
    if (!array1 || !array2 || !array1.length || !array2.length || !array1[0] || !array2[0]) {
        return [];
    }

    // Check if arrays have matching dimensions
    const rows = array1.length;
    const cols = array1[0].length;
    if (array2.length !== rows || array2[0].length !== cols) {
        console.warn('Arrays have mismatched dimensions');
        return [];
    }

    const result: number[][] = new Array(rows);

    for (let i = 0; i < rows; i++) {
        result[i] = new Array(cols);
        for (let j = 0; j < cols; j++) {
            const val1 = array1[i][j];
            const val2 = array2[i][j];
            result[i][j] = Number.isNaN(val1) || Number.isNaN(val2) ?
                NaN :
                val1 - val2;
        }
    }
    return result;
};
