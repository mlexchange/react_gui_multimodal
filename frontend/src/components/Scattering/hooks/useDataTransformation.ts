import { useState } from 'react';
import { useCallback } from 'react';
import { calculateGlobalPercentiles, clipArray, calculateMinMax, calculateMeanStd }
from '../utils/transformationUtils';


export default function useDataTransformation() {

    const [isLogScale, setIsLogScale] = useState(false);
    const [lowerPercentile, setLowerPercentile] = useState(1);
    const [upperPercentile, setUpperPercentile] = useState(99);
    const [normalization, setNormalization] = useState<string>('none');
    const [imageColormap, setImageColormap] = useState('Viridis');
    const [differenceColormap, setDifferenceColormap] = useState('RdBu');
    const [normalizationMode, setNormalizationMode] = useState('together');


    const mainTransformDataFunction = useCallback((
        data1: number[][],
        data2: number[][],
        isLog: boolean,
        lowerPerc: number,
        upperPerc: number,
        normalization: string = 'none',
        normalizationMode: string = 'together'
      ): { array1: number[][], array2: number[][] } => {
        if (!data1.length || !data2.length) return { array1: [], array2: [] };

        // Function to process a single array with log scale
        const applyLogScale = (data: number[][]) => {
          // Get dimensions of the image
          const rows = data.length;
          const cols = data[0]?.length || 0;
          const totalSize = rows * cols;

          // Create TypedArrays for input and output
          // Float32Array is chosen because:
          // - It's more memory efficient than Float64Array
          // - Provides enough precision for image processing
          // - Is commonly used in WebGL and image processing
          const flatInput = new Float32Array(totalSize);
          const result = new Float32Array(totalSize);

          // First pass: Flatten 2D array and find minimum positive value
          // We flatten the array because:
          // - Sequential memory access is faster than jumping between array rows
          // - CPU cache can better predict and prefetch sequential data
          // - Reduces memory fragmentation
          let minPositive = Infinity;
          let idx = 0;

          for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
              const val = data[i][j];
              flatInput[idx++] = val;
              // Track minimum positive value for log scaling
              // We need this to handle values <= 0 which can't be log scaled
              if (val > 0) {
                minPositive = Math.min(minPositive, val);
              }
            }
          }

          // Calculate log of minimum positive value once
          // This will be used as replacement for values <= 0
          const logMinPositive = Math.log10(minPositive);

          // Second pass: Apply log scaling to all values
          // Process linearly through the TypedArray for better performance
          // This is faster than processing the 2D array because:
          // - Better memory locality
          // - Simpler array bounds checking
          // - Better CPU branch prediction
          for (let i = 0; i < totalSize; i++) {
            const val = flatInput[i];
            result[i] = val < 0 ? logMinPositive : val == 0 ? 0 : Math.log10(val);
          }

          // Convert back to 2D array if required by the calling code
          // Note: If possible, modifying the code to work with flat arrays
          // would be more efficient than this conversion
          const output: number[][] = new Array(rows);
          for (let i = 0; i < rows; i++) {
            // subarray creates a view into the existing array
            // This is more efficient than copying the data
            output[i] = Array.from(result.subarray(i * cols, (i + 1) * cols));
          }

          return output;
        };

        // Function to process percentiles for a single array
        const calculateSingleArrayPercentiles = (data: number[][], lowPercentile: number, highPercentile: number): [number, number] => {
          let totalLength = 0;
          for (let i = 0; i < data.length; i++) {
            for (let j = 0; j < data[i].length; j++) {
              if (!Number.isNaN(data[i][j])) totalLength++;
            }
          }

          const values = new Float32Array(totalLength);
          let idx = 0;

          for (let i = 0; i < data.length; i++) {
            for (let j = 0; j < data[i].length; j++) {
              if (!Number.isNaN(data[i][j])) {
                values[idx++] = data[i][j];
              }
            }
          }

          values.sort();
          const lowIndex = Math.ceil((lowPercentile / 100) * totalLength);
          const highIndex = Math.floor((highPercentile / 100) * totalLength);
          return [values[lowIndex], values[highIndex]];
        };

        // Function to calculate min-max for a single array
        const calculateSingleArrayMinMax = (data: number[][]) => {
          let min = Infinity;
          let max = -Infinity;

          for (let i = 0; i < data.length; i++) {
            for (let j = 0; j < data[i].length; j++) {
              const val = data[i][j];
              if (!Number.isNaN(val)) {
                min = Math.min(min, val);
                max = Math.max(max, val);
              }
            }
          }

          return { min, max };
        };

        // Function to calculate mean-std for a single array
        const calculateSingleArrayMeanStd = (data: number[][]) => {
          let sum = 0;
          let count = 0;

          // First pass: calculate mean
          for (let i = 0; i < data.length; i++) {
            for (let j = 0; j < data[i].length; j++) {
              const val = data[i][j];
              if (!Number.isNaN(val)) {
                sum += val;
                count++;
              }
            }
          }

          const mean = sum / count;

          // Second pass: calculate variance
          let variance = 0;
          for (let i = 0; i < data.length; i++) {
            for (let j = 0; j < data[i].length; j++) {
              const val = data[i][j];
              if (!Number.isNaN(val)) {
                variance += Math.pow(val - mean, 2);
              }
            }
          }

          const std = Math.sqrt(variance / count);
          return { mean, std };
        };

        // First apply log transform if needed
        let transformed1 = isLog ? applyLogScale(data1) : data1;
        let transformed2 = isLog ? applyLogScale(data2) : data2;


        if (normalizationMode === 'together') {
            if (lowerPerc === 0 && upperPerc === 100) {
                // Skip clipping if using full range
                transformed1 = transformed1.map(row => row.map(val => Number.isNaN(val) ? 0 : val));
                transformed2 = transformed2.map(row => row.map(val => Number.isNaN(val) ? 0 : val));

              } else {
                // Calculate global percentiles and clip both arrays using the global limits
                const [minValue, maxValue] = calculateGlobalPercentiles(transformed1, transformed2, lowerPerc, upperPerc);
                transformed1 = clipArray(transformed1, minValue, maxValue);
                transformed2 = clipArray(transformed2, minValue, maxValue);
              }

          // Apply normalization if needed
          switch (normalization) {
            case 'minmax': {
              const { min, max } = calculateMinMax(transformed1, transformed2);
              const range = max - min;
              const normalize = (arr: number[][]) => arr.map(row =>
                row.map(val =>
                  Number.isNaN(val) ? 0 : range === 0 ? 0 : (val - min) / range
                )
              );
              transformed1 = normalize(transformed1);
              transformed2 = normalize(transformed2);
              break;
            }
            case 'mean': {
              const { mean, std } = calculateMeanStd(transformed1, transformed2);
              const normalize = (arr: number[][]) => arr.map(row =>
                row.map(val =>
                  Number.isNaN(val) ? 0 : std === 0 ? 0 : (val - mean) / std
                )
              );
              transformed1 = normalize(transformed1);
              transformed2 = normalize(transformed2);
              break;
            }
            default:
              transformed1 = transformed1.map(row => row.map(val => Number.isNaN(val) ? 0 : val));
              transformed2 = transformed2.map(row => row.map(val => Number.isNaN(val) ? 0 : val));

          }
        } else {
            // Process each array individually
            if (lowerPerc === 0 && upperPerc === 100) {
                // Skip clipping if using full range
                transformed1 = transformed1.map(row => row.map(val => Number.isNaN(val) ? 0 : val));
                transformed2 = transformed2.map(row => row.map(val => Number.isNaN(val) ? 0 : val));
            } else {
                // Apply percentile clipping individually
                const [minValue1, maxValue1] = calculateSingleArrayPercentiles(transformed1, lowerPerc, upperPerc);
                const [minValue2, maxValue2] = calculateSingleArrayPercentiles(transformed2, lowerPerc, upperPerc);
                transformed1 = clipArray(transformed1, minValue1, maxValue1);
                transformed2 = clipArray(transformed2, minValue2, maxValue2);
            }
        //   // Process each array individually
        //   // Apply percentile clipping individually
        //   const [minValue1, maxValue1] = calculateSingleArrayPercentiles(transformed1, lowerPerc, upperPerc);
        //   const [minValue2, maxValue2] = calculateSingleArrayPercentiles(transformed2, lowerPerc, upperPerc);
        //   transformed1 = clipArray(transformed1, minValue1, maxValue1);
        //   transformed2 = clipArray(transformed2, minValue2, maxValue2);

          // Apply normalization individually
          switch (normalization) {
            case 'minmax': {
              // Normalize array1
              const { min: min1, max: max1 } = calculateSingleArrayMinMax(transformed1);
              const range1 = max1 - min1;
              transformed1 = transformed1.map(row =>
                row.map(val =>
                  Number.isNaN(val) ? 0 : range1 === 0 ? 0 : (val - min1) / range1
                )
              );

              // Normalize array2
              const { min: min2, max: max2 } = calculateSingleArrayMinMax(transformed2);
              const range2 = max2 - min2;
              transformed2 = transformed2.map(row =>
                row.map(val =>
                  Number.isNaN(val) ? 0 : range2 === 0 ? 0 : (val - min2) / range2
                )
              );
              break;
            }
            case 'mean': {
              // Normalize array1
              const { mean: mean1, std: std1 } = calculateSingleArrayMeanStd(transformed1);
              transformed1 = transformed1.map(row =>
                row.map(val =>
                  Number.isNaN(val) ? 0 : std1 === 0 ? 0 : (val - mean1) / std1
                )
              );

              // Normalize array2
              const { mean: mean2, std: std2 } = calculateSingleArrayMeanStd(transformed2);
              transformed2 = transformed2.map(row =>
                row.map(val =>
                  Number.isNaN(val) ? 0 : std2 === 0 ? 0 : (val - mean2) / std2
                )
              );
              break;
            }
            default:
              transformed1 = transformed1.map(row => row.map(val => Number.isNaN(val) ? 0 : val));
              transformed2 = transformed2.map(row => row.map(val => Number.isNaN(val) ? 0 : val));
          }
        }
        return { array1: transformed1, array2: transformed2 };
      }, []);

    return {
        isLogScale,
        setIsLogScale,
        lowerPercentile,
        setLowerPercentile,
        upperPercentile,
        setUpperPercentile,
        normalization,
        setNormalization,
        imageColormap,
        setImageColormap,
        differenceColormap,
        setDifferenceColormap,
        normalizationMode,
        setNormalizationMode,
        mainTransformDataFunction
    }
}
