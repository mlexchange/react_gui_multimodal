// import { useCallback, useState, useEffect } from 'react';
// import { Linecut } from '../types';
// import { leftImageColorPalette, rightImageColorPalette } from '../utils/constants';
// import { throttle } from 'lodash';

// /**
//  * Custom hook for managing vertical linecuts based on q-values
//  *
//  * This hook provides functionality to create, manipulate, and visualize vertical linecuts
//  * on scattering images. Instead of working in pixel space, this implementation operates in
//  * q-space (reciprocal space) which has physical meaning in scattering experiments.
//  *
//  * The hook maintains both q-value positions and their corresponding pixel positions,
//  * handling the mapping between these two spaces automatically using the provided qXVector.
//  *
//  * @param imageWidth - Width of the detector image in pixels
//  * @param imageData1 - 2D array of intensity values for first image
//  * @param imageData2 - 2D array of intensity values for second image
//  * @param qXVector - Array of q-values along X axis, mapping each pixel index to a q-value
//  * @returns Object with linecut data and management functions
//  */
// export default function useVerticalLinecut(
//     imageWidth: number,
//     imageData1: number[][],
//     imageData2: number[][],
//     qXVector: number[] // Required qXVector parameter for q-space mapping
// ) {
//   // State for storing the linecut definitions (position, width, colors, etc.)
//   const [verticalLinecuts, setVerticalLinecuts] = useState<Linecut[]>([]);

//   /**
//    * Converts a q-value to the corresponding pixel column index
//    *
//    * This is a key function that handles the mapping from q-space (physical units)
//    * to pixel space (image coordinates). It finds the index in qXVector that has
//    * the closest q-value to the target value.
//    *
//    * @param targetQ - The q-value to find in the qXVector
//    * @returns The pixel column index that best corresponds to the given q-value
//    */
//   const findClosestPixelForQValue = useCallback((
//     targetQ: number
//   ): number => {
//     // Handle the case where qXVector is empty with a reasonable default
//     if (!qXVector || qXVector.length === 0) {
//       return Math.floor((imageWidth - 1) / 2); // Default to middle of image
//     }

//     // Find the index with the closest matching q-value through linear search
//     let closestIndex = 0;
//     let smallestDifference = Math.abs(qXVector[0] - targetQ);

//     for (let i = 1; i < qXVector.length; i++) {
//       const difference = Math.abs(qXVector[i] - targetQ);
//       if (difference < smallestDifference) {
//         smallestDifference = difference;
//         closestIndex = i;
//       }
//     }

//     // Return the found pixel position (array index)
//     return closestIndex;
//   }, [qXVector, imageWidth]);

//   /**
//    * Extracts intensity data for a vertical linecut at a specific pixel column
//    *
//    * This function extracts a column of intensity values from the image data array
//    * at the specified position, giving us the intensity profile along the vertical direction.
//    *
//    * @param position - The column index in pixel space to extract
//    * @param imageData - 2D array of intensity values representing the image
//    * @returns 1D array of intensity values along the specified column
//    */
//   const computeVerticalLinecutData = useCallback((
//     position: number,
//     imageData: number[][]
//   ): number[] => {
//     // Verify position is within bounds of the image before extracting data
//     if (Array.isArray(imageData) &&
//         imageData.length > 0 &&
//         position >= 0 &&
//         position < (imageData[0]?.length || 0)) {
//       // For vertical linecuts, we extract values from the same column position across all rows
//       return imageData.map(row => row[position]);
//     }
//     return []; // Return empty array if out of bounds or data is invalid
//   }, []);

//   /**
//    * Creates a new vertical linecut at the center of the q-range
//    *
//    * This function calculates a default position in the middle of the available
//    * q-range, finds the corresponding pixel position, and creates a new linecut
//    * with unique colors. It also extracts and stores the intensity data from
//    * both image datasets for the new linecut.
//    */
//   const addVerticalLinecut = useCallback(throttle(() => {
//     // Find the next available ID for the new linecut
//     const existingIds = verticalLinecuts.map((linecut) => linecut.id);
//     const newId = Math.max(0, ...existingIds) + 1;

//     // Calculate default q-value at the middle of the available range
//     const minQ = qXVector && qXVector.length > 0 ? Math.min(...qXVector) : 0;
//     const maxQ = qXVector && qXVector.length > 0 ? Math.max(...qXVector) : 0;
//     const defaultQ = qXVector && qXVector.length > 0 ? (minQ + maxQ) / 2 : 0;

//     // Convert the q-value to the corresponding pixel position
//     const pixelPosition = findClosestPixelForQValue(defaultQ);

//     // Create the new linecut object with default properties
//     const newLinecut: Linecut = {
//       id: newId,
//       position: defaultQ,         // Store q-value as the position
//       pixelPosition: pixelPosition, // Also store the corresponding pixel position
//       // Assign colors from palette, cycling through available colors
//       leftColor: leftImageColorPalette[(newId - 1) % leftImageColorPalette.length],
//       rightColor: rightImageColorPalette[(newId - 1) % rightImageColorPalette.length],
//       hidden: false,              // Linecut is visible by default
//       width: 0,                 // Start with a default width
//       type: 'vertical'            // Identify this as a vertical linecut
//     };

//     // Add the new linecut to the state
//     setVerticalLinecuts((prev) => [...prev, newLinecut]);

//   }, 200), [  // Throttle to prevent rapid creation of multiple linecuts
//     verticalLinecuts,
//     findClosestPixelForQValue,
//     computeVerticalLinecutData,
//     imageData1,
//     imageData2,
//     qXVector
//   ]);

//   /**
//    * Updates the position of an existing linecut to a new q-value
//    *
//    * This function handles position changes in q-space, updates the corresponding
//    * pixel position, and refreshes the intensity data for the linecut. The throttling
//    * prevents performance issues during rapid adjustments (e.g., slider movements).
//    */
//   const updateVerticalLinecutPosition = useCallback(
//     throttle((id: number, position: number) => {
//       // Convert the new q-value position to pixel position
//       const pixelPosition = findClosestPixelForQValue(position);

//       // Update the linecut with both new q-value and corresponding pixel position
//       setVerticalLinecuts(prev =>
//         prev.map(linecut =>
//           linecut.id === id ? {
//             ...linecut,
//             position: position,        // Store the new q-value
//             pixelPosition: pixelPosition // Store the new pixel position
//           } : linecut
//         )
//       );

//     }, 200), // Throttle to limit updates during rapid adjustments
//     [imageData1, imageData2, computeVerticalLinecutData, findClosestPixelForQValue]
//   );

//   /**
//    * Updates the width of a linecut in q-space
//    *
//    * This function simply updates the width property of the linecut in q-units.
//    * The actual pixel-space width calculation happens in the overlay generation
//    * function that uses this data.
//    */
//   const updateVerticalLinecutWidth = useCallback(
//     throttle((id: number, width: number) => {
//       // Update the width property of the specified linecut
//       setVerticalLinecuts((prev) =>
//         prev.map((linecut) =>
//           linecut.id === id ? { ...linecut, width } : linecut
//         )
//       );
//       // Note: The visual effect of this width change is handled in the
//       // generateVerticalLinecutOverlay function, which converts the q-space width
//       // to pixel space for visualization
//     }, 200), // Throttle to limit updates during slider adjustments
//     []
//   );

//   /**
//    * Updates the color of a linecut (left or right side)
//    *
//    * @param id - The ID of the linecut to update
//    * @param side - Which side to update ('left' or 'right')
//    * @param color - The new color value (CSS color string)
//    */
//   const updateVerticalLinecutColor = useCallback((id: number, side: 'left' | 'right', color: string) => {
//     // Update the color property for the specified side of the linecut
//     setVerticalLinecuts((prev) =>
//       prev.map((linecut) =>
//         linecut.id === id
//           ? { ...linecut, [`${side}Color`]: color } // Use dynamic property name based on side
//           : linecut
//       )
//     );
//   }, []);

//   /**
//    * Removes a linecut and renumbers the remaining ones
//    *
//    * This function removes a linecut from both the linecut definitions and
//    * the intensity data arrays, and renumbers the remaining linecuts to maintain
//    * sequential IDs.
//    */
//   const deleteVerticalLinecut = useCallback((id: number) => {
//     // Remove the linecut from the list and renumber remaining linecuts
//     setVerticalLinecuts((prev) => {
//       const updatedLinecuts = prev.filter((linecut) => linecut.id !== id);
//       // Renumber the remaining linecuts to maintain sequential IDs
//       return updatedLinecuts.map((linecut, index) => ({
//         ...linecut,
//         id: index + 1,
//       }));
//     });
//   }, []);

//   /**
//    * Toggles the visibility of a linecut
//    *
//    * This simply flips the 'hidden' flag for the specified linecut, which
//    * controls whether it's displayed in the visualization.
//    */
//   const toggleVerticalLinecutVisibility = useCallback((id: number) => {
//     setVerticalLinecuts((prev) =>
//       prev.map((linecut) =>
//         linecut.id === id ? { ...linecut, hidden: !linecut.hidden } : linecut
//       )
//     );
//   }, []);

//   /**
//    * Synchronizes pixel positions when qXVector changes
//    *
//    * This effect ensures that if the q-value to pixel mapping changes
//    * (due to calibration changes, for example), all the linecuts maintain
//    * their positions in q-space but update their pixel positions accordingly.
//    */
//   useEffect(() => {
//     // Skip if qXVector is empty, undefined, or no linecuts exist
//     if (!qXVector || !qXVector.length || !verticalLinecuts.length || !imageData1 || !imageData2) return;

//     // Update all linecuts with new pixel positions based on their q-values
//     setVerticalLinecuts(prev =>
//       prev.map(linecut => {
//         // Recalculate pixel position based on current q-value and new mapping
//         const pixelPosition = findClosestPixelForQValue(linecut.position);
//         return { ...linecut, pixelPosition };
//       })
//     );

//   }, [qXVector, verticalLinecuts, findClosestPixelForQValue, computeVerticalLinecutData, imageData1, imageData2]);

//   // Return all the state and functions needed to use and manage linecuts
//   return {
//     verticalLinecuts,          // Linecut definitions (position, width, colors, etc.)
//     // verticalLinecutData1,      // Intensity data for first image
//     // verticalLinecutData2,      // Intensity data for second image
//     addVerticalLinecut,        // Function to create a new linecut
//     updateVerticalLinecutPosition, // Function to move a linecut
//     updateVerticalLinecutWidth,    // Function to change linecut width
//     updateVerticalLinecutColor,    // Function to update linecut colors
//     deleteVerticalLinecut,         // Function to remove a linecut
//     toggleVerticalLinecutVisibility, // Function to show/hide a linecut
//   };
// }






import { useCallback, useState, useEffect } from 'react';
import { Linecut } from '../types';
import { leftImageColorPalette, rightImageColorPalette } from '../utils/constants';
import { throttle } from 'lodash';
import { findPixelPositionForQValue } from '../utils/findPixelPositionForQValue';

/**
 * Custom hook for managing vertical linecuts based on q-values
 *
 * @param imageWidth - Width of the detector image in pixels
 * @param imageData1 - 2D array of intensity values for first image
 * @param imageData2 - 2D array of intensity values for second image
 * @param qXMatrix - 2D matrix of q-values along X axis
 * @returns Object with linecut data and management functions
 */
export default function useVerticalLinecut(
    imageWidth: number,
    imageData1: number[][],
    imageData2: number[][],
    qXMatrix: number[][] // Changed from qXVector to qXMatrix
) {
  // State for storing the linecut definitions
  const [verticalLinecuts, setVerticalLinecuts] = useState<Linecut[]>([]);

  /**
   * Converts a q-value to the corresponding pixel column index
   */
  const findClosestPixelForQValue = useCallback((
    targetQ: number
  ): number => {
    return findPixelPositionForQValue(targetQ, qXMatrix, 'vertical');
  }, [qXMatrix]);

  /**
   * Creates a new vertical linecut
   */
  const addVerticalLinecut = useCallback(throttle(() => {
    // Find the next available ID for the new linecut
    const existingIds = verticalLinecuts.map((linecut) => linecut.id);
    const newId = Math.max(0, ...existingIds) + 1;

    // Calculate default q-value at the middle of the available range
    let minQ = Infinity;
    let maxQ = -Infinity;

    // Find min/max q-values in the matrix's first row
    if (qXMatrix && qXMatrix.length > 0 && qXMatrix[0]) {
      for (let x = 0; x < qXMatrix[0].length; x++) {
        if (qXMatrix[0][x] !== undefined) {
          minQ = Math.min(minQ, qXMatrix[0][x]);
          maxQ = Math.max(maxQ, qXMatrix[0][x]);
        }
      }
    }

    // Default to center of range, or 0 if matrix is empty
    const defaultQ = (minQ !== Infinity && maxQ !== -Infinity)
      ? (minQ + maxQ) / 2
      : 0;

    // Convert the q-value to the corresponding pixel position
    const pixelPosition = findClosestPixelForQValue(defaultQ);

    // Create the new linecut object with default properties
    const newLinecut: Linecut = {
      id: newId,
      position: defaultQ,
      pixelPosition: pixelPosition,
      leftColor: leftImageColorPalette[(newId - 1) % leftImageColorPalette.length],
      rightColor: rightImageColorPalette[(newId - 1) % rightImageColorPalette.length],
      hidden: false,
      width: 0.0,
      type: 'vertical'
    };

    // Add the new linecut to the state
    setVerticalLinecuts((prev) => [...prev, newLinecut]);

  }, 200), [verticalLinecuts, findClosestPixelForQValue, qXMatrix]);

  /**
   * Updates the position of an existing linecut
   */
  const updateVerticalLinecutPosition = useCallback(
    throttle((id: number, position: number) => {
      // Convert the new q-value position to pixel position
      const pixelPosition = findClosestPixelForQValue(position);

      // Update the linecut with both new q-value and corresponding pixel position
      setVerticalLinecuts(prev =>
        prev.map(linecut =>
          linecut.id === id ? {
            ...linecut,
            position: position,
            pixelPosition: pixelPosition
          } : linecut
        )
      );
    }, 200),
    [findClosestPixelForQValue]
  );

  /**
   * Updates the width of a linecut in q-space
   */
  const updateVerticalLinecutWidth = useCallback(
    throttle((id: number, width: number) => {
      setVerticalLinecuts((prev) =>
        prev.map((linecut) =>
          linecut.id === id ? { ...linecut, width } : linecut
        )
      );
    }, 200),
    []
  );

  /**
   * Updates the color of a linecut
   */
  const updateVerticalLinecutColor = useCallback((id: number, side: 'left' | 'right', color: string) => {
    setVerticalLinecuts((prev) =>
      prev.map((linecut) =>
        linecut.id === id
          ? { ...linecut, [`${side}Color`]: color }
          : linecut
      )
    );
  }, []);

  /**
   * Removes a linecut and renumbers the remaining ones
   */
  const deleteVerticalLinecut = useCallback((id: number) => {
    setVerticalLinecuts((prev) => {
      const updatedLinecuts = prev.filter((linecut) => linecut.id !== id);
      return updatedLinecuts.map((linecut, index) => ({
        ...linecut,
        id: index + 1,
      }));
    });
  }, []);

  /**
   * Toggles the visibility of a linecut
   */
  const toggleVerticalLinecutVisibility = useCallback((id: number) => {
    setVerticalLinecuts((prev) =>
      prev.map((linecut) =>
        linecut.id === id ? { ...linecut, hidden: !linecut.hidden } : linecut
      )
    );
  }, []);

  /**
   * Synchronizes pixel positions when qXMatrix changes
   */
  useEffect(() => {
    // Skip if qXMatrix is empty or no linecuts exist
    if (!qXMatrix || !qXMatrix.length || !verticalLinecuts.length) return;

    // Update all linecuts with new pixel positions based on their q-values
    setVerticalLinecuts(prev =>
      prev.map(linecut => {
        // Recalculate pixel position based on current q-value and new mapping
        const pixelPosition = findClosestPixelForQValue(linecut.position);
        return { ...linecut, pixelPosition };
      })
    );
  }, [qXMatrix, verticalLinecuts, findClosestPixelForQValue]);

  return {
    verticalLinecuts,
    addVerticalLinecut,
    updateVerticalLinecutPosition,
    updateVerticalLinecutWidth,
    updateVerticalLinecutColor,
    deleteVerticalLinecut,
    toggleVerticalLinecutVisibility,
  };
}
