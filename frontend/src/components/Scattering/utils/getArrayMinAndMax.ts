export const getArrayMinMax = (data: number[][]): [number, number] => {
    let min = Infinity;
    let max = -Infinity;

    // Single pass through the data
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        for (let j = 0; j < row.length; j++) {
            const val = row[j];
            if (!Number.isNaN(val)) {
                if (val < min) min = val;
                if (val > max) max = val;
            }
        }
    }

    return [min, max];
};
