export const getArrayMinMax = (data: number[][]): [number, number] => {
    let min = Infinity;
    let max = -Infinity;

    for (const row of data) {
        for (const val of row) {
            if (val < min) min = val;
            if (val > max) max = val;
        }
    }

    return [min, max];
};
