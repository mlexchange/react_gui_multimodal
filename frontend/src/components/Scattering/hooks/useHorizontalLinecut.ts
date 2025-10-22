// import { useCallback, useState } from 'react';
// import { Linecut } from '../types';
// import { leftImageColorPalette, rightImageColorPalette } from '../utils/constants';
// import { throttle } from 'lodash';

// /**
//  * Custom hook for managing horizontal linecuts based on q-values
//  *
//  * This hook provides functionality to create, manipulate, and visualize horizontal linecuts
//  * on scattering images. Instead of working in pixel space, this implementation operates in
//  * q-space (reciprocal space) which has physical meaning in scattering experiments.
//  *
//  * The hook maintains both q-value positions and their corresponding pixel positions,
//  * handling the mapping between these two spaces automatically using the provided qYVector.
//  *
//  * @param imageHeight - Height of the detector image in pixels
//  * @param imageData1 - 2D array of intensity values for first image
//  * @param imageData2 - 2D array of intensity values for second image
//  * @param qYVector - Array of q-values along Y axis, mapping each pixel index to a q-value
//  * @returns Object with linecut data and management functions
//  */
// export default function useHorizontalLinecut(
//     imageHeight: number,
//     imageData1: number[][],
//     imageData2: number[][],
//     qYVector: number[] // Required qYVector parameter for q-space mapping
// ) {
//   // State for storing the linecut definitions (position, width, colors, etc.)
//   const [horizontalLinecuts, setHorizontalLinecuts] = useState<Linecut[]>([]);

//   /**
//    * Converts a q-value to the corresponding pixel row index
//    *
//    * This is a key function that handles the mapping from q-space (physical units)
//    * to pixel space (image coordinates). It finds the index in qYVector that has
//    * the closest q-value to the target value.
//    *
//    * @param targetQ - The q-value to find in the qYVector
//    * @returns The pixel row index that best corresponds to the given q-value
//    */
//   const findClosestPixelForQValue = useCallback((
//     targetQ: number
//   ): number => {
//     // Handle the case where qYVector is empty with a reasonable default
//     if (!qYVector || qYVector.length === 0) {
//       return Math.floor((imageHeight - 1) / 2); // Default to middle of image
//     }

//     // Find the index with the closest matching q-value through linear search
//     let closestIndex = 0;
//     let smallestDifference = Math.abs(qYVector[0] - targetQ);

//     for (let i = 1; i < qYVector.length; i++) {
//       const difference = Math.abs(qYVector[i] - targetQ);
//       if (difference < smallestDifference) {
//         smallestDifference = difference;
//         closestIndex = i;
//       }
//     }

//     // Return the found pixel position (array index)
//     return closestIndex;
//   }, [qYVector, imageHeight]);

//   /**
//    * Extracts intensity data for a horizontal linecut at a specific pixel row
//    *
//    * This function simply returns the entire row of intensity values from the image
//    * data array at the specified position, giving us the intensity profile along
//    * the horizontal direction.
//    *
//    * @param position - The row index in pixel space to extract
//    * @param imageData - 2D array of intensity values representing the image
//    * @returns 1D array of intensity values along the specified row
//    */
//   const computeHorizontalLinecutData = useCallback((
//     position: number,
//     imageData: number[][]
//   ): number[] => {
//     // Verify position is within bounds of the image before extracting data
//     if (Array.isArray(imageData) && position >= 0 && position < imageData.length) {
//       return imageData[position]; // Simply return the entire row
//     }
//     return []; // Return empty array if out of bounds or data is invalid
//   }, []);

//   /**
//    * Creates a new horizontal linecut at the center of the q-range
//    *
//    * This function calculates a default position in the middle of the available
//    * q-range, finds the corresponding pixel position, and creates a new linecut
//    * with unique colors. It also extracts and stores the intensity data from
//    * both image datasets for the new linecut.
//    */
//   const addHorizontalLinecut = useCallback(throttle(() => {
//     // Find the next available ID for the new linecut
//     const existingIds = horizontalLinecuts.map((linecut) => linecut.id);
//     const newId = Math.max(0, ...existingIds) + 1;

//     // Calculate default q-value at the middle of the available range
//     const minQ = qYVector.length > 0 ? Math.min(...qYVector) : 0;
//     const maxQ = qYVector.length > 0 ? Math.max(...qYVector) : 0;
//     const defaultQ = qYVector.length > 0 ? (minQ + maxQ) / 2 : 0;

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
//       width: 0.0,                 // Start with zero width (just a line)
//       type: 'horizontal'          // Identify this as a horizontal linecut
//     };

//     // Add the new linecut to the state
//     setHorizontalLinecuts((prev) => [...prev, newLinecut]);

//   }, 200), [  // Throttle to prevent rapid creation of multiple linecuts
//     horizontalLinecuts,
//     findClosestPixelForQValue,
//     computeHorizontalLinecutData,
//     imageData1,
//     imageData2,
//     qYVector
//   ]);

//   /**
//    * Updates the position of an existing linecut to a new q-value
//    *
//    * This function handles position changes in q-space, updates the corresponding
//    * pixel position, and refreshes the intensity data for the linecut. The throttling
//    * prevents performance issues during rapid adjustments (e.g., slider movements).
//    */
//   const updateHorizontalLinecutPosition = useCallback(
//     throttle((id: number, position: number) => {
//       // Convert the new q-value position to pixel position
//       const pixelPosition = findClosestPixelForQValue(position);

//       // Update the linecut with both new q-value and corresponding pixel position
//       setHorizontalLinecuts(prev =>
//         prev.map(linecut =>
//           linecut.id === id ? {
//             ...linecut,
//             position: position,        // Store the new q-value
//             pixelPosition: pixelPosition // Store the new pixel position
//           } : linecut
//         )
//       );

//     }, 200), // Throttle to limit updates during rapid adjustments
//     [imageData1, imageData2, computeHorizontalLinecutData, findClosestPixelForQValue]
//   );

//   /**
//    * Updates the width of a linecut in q-space
//    *
//    * This function simply updates the width property of the linecut in q-units.
//    * The actual pixel-space width calculation happens in the overlay generation
//    * function that uses this data.
//    */
//   const updateHorizontalLinecutWidth = useCallback(
//     throttle((id: number, width: number) => {
//       // Update the width property of the specified linecut
//       setHorizontalLinecuts((prev) =>
//         prev.map((linecut) =>
//           linecut.id === id ? { ...linecut, width } : linecut
//         )
//       );
//       // Note: The visual effect of this width change is handled in the
//       // generateHorizontalLinecutOverlay function, which converts the q-space width
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
//   const updateHorizontalLinecutColor = useCallback((id: number, side: 'left' | 'right', color: string) => {
//     // Update the color property for the specified side of the linecut
//     setHorizontalLinecuts((prev) =>
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
//   const deleteHorizontalLinecut = useCallback((id: number) => {
//     // Remove the linecut from the list and renumber remaining linecuts
//     setHorizontalLinecuts((prev) => {
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
//   const toggleHorizontalLinecutVisibility = useCallback((id: number) => {
//     setHorizontalLinecuts((prev) =>
//       prev.map((linecut) =>
//         linecut.id === id ? { ...linecut, hidden: !linecut.hidden } : linecut
//       )
//     );
//   }, []);


//   // Return all the state and functions needed to use and manage linecuts
//   return {
//     horizontalLinecuts,          // Linecut definitions (position, width, colors, etc.)
//     // horizontalLinecutData1,      // Intensity data for first image
//     // horizontalLinecutData2,      // Intensity data for second image
//     addHorizontalLinecut,        // Function to create a new linecut
//     updateHorizontalLinecutPosition, // Function to move a linecut
//     updateHorizontalLinecutWidth,    // Function to change linecut width
//     updateHorizontalLinecutColor,    // Function to update linecut colors
//     deleteHorizontalLinecut,         // Function to remove a linecut
//     toggleHorizontalLinecutVisibility, // Function to show/hide a linecut
//   };
// }





import { useCallback, useState, useEffect } from 'react';
import { Linecut } from '../types';
import { leftImageColorPalette, rightImageColorPalette } from '../utils/constants';
import { throttle } from 'lodash';
import { findPixelPositionForQValue } from '../utils/findPixelPositionForQValue';

/**
 * Custom hook for managing horizontal linecuts based on q-values
 *
 * @param imageHeight - Height of the detector image in pixels
 * @param imageData1 - 2D array of intensity values for first image
 * @param imageData2 - 2D array of intensity values for second image
 * @param qYMatrix - 2D matrix of q-values along Y axis
 * @returns Object with linecut data and management functions
 */
export default function useHorizontalLinecut(
    imageHeight: number,
    imageData1: number[][],
    imageData2: number[][],
    qYMatrix: number[][] // Changed from qYVector to qYMatrix
) {
  // State for storing the linecut definitions
  const [horizontalLinecuts, setHorizontalLinecuts] = useState<Linecut[]>([]);

  /**
   * Converts a q-value to the corresponding pixel row index
   */
  const findClosestPixelForQValue = useCallback((
    targetQ: number
  ): number => {
    return findPixelPositionForQValue(targetQ, qYMatrix, 'horizontal');
  }, [qYMatrix]);

  /**
   * Creates a new horizontal linecut at the center of the q-range
   */
  const addHorizontalLinecut = useCallback(throttle(() => {
    // Find the next available ID for the new linecut
    const existingIds = horizontalLinecuts.map((linecut) => linecut.id);
    const newId = Math.max(0, ...existingIds) + 1;

    // Calculate default q-value at the middle of the available range
    let minQ = Infinity;
    let maxQ = -Infinity;

    // Find min/max q-values in the matrix's first column
    if (qYMatrix && qYMatrix.length > 0) {
      for (let y = 0; y < qYMatrix.length; y++) {
        if (qYMatrix[y] && qYMatrix[y][0] !== undefined) {
          minQ = Math.min(minQ, qYMatrix[y][0]);
          maxQ = Math.max(maxQ, qYMatrix[y][0]);
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
      position: defaultQ,         // Store q-value as the position
      pixelPosition: pixelPosition, // Also store the corresponding pixel position
      // Assign colors from palette, cycling through available colors
      leftColor: leftImageColorPalette[(newId - 1) % leftImageColorPalette.length],
      rightColor: rightImageColorPalette[(newId - 1) % rightImageColorPalette.length],
      hidden: false,              // Linecut is visible by default
      width: 0.0,                 // Start with zero width (just a line)
      type: 'horizontal'          // Identify this as a horizontal linecut
    };

    // Add the new linecut to the state
    setHorizontalLinecuts((prev) => [...prev, newLinecut]);

  }, 200), [horizontalLinecuts, findClosestPixelForQValue, qYMatrix]);

  /**
   * Updates the position of an existing linecut
   */
  const updateHorizontalLinecutPosition = useCallback(
    throttle((id: number, position: number) => {
      // Convert the new q-value position to pixel position
      const pixelPosition = findClosestPixelForQValue(position);

      // Update the linecut with both new q-value and corresponding pixel position
      setHorizontalLinecuts(prev =>
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
  const updateHorizontalLinecutWidth = useCallback(
    throttle((id: number, width: number) => {
      setHorizontalLinecuts((prev) =>
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
  const updateHorizontalLinecutColor = useCallback((id: number, side: 'left' | 'right', color: string) => {
    setHorizontalLinecuts((prev) =>
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
  const deleteHorizontalLinecut = useCallback((id: number) => {
    setHorizontalLinecuts((prev) => {
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
  const toggleHorizontalLinecutVisibility = useCallback((id: number) => {
    setHorizontalLinecuts((prev) =>
      prev.map((linecut) =>
        linecut.id === id ? { ...linecut, hidden: !linecut.hidden } : linecut
      )
    );
  }, []);

  /**
   * Synchronizes pixel positions when qYMatrix changes
   */
  useEffect(() => {
    // Skip if qYMatrix is empty or no linecuts exist
    if (!qYMatrix || !qYMatrix.length || !horizontalLinecuts.length) return;

    // Update all linecuts with new pixel positions based on their q-values
    setHorizontalLinecuts(prev =>
      prev.map(linecut => {
        // Recalculate pixel position based on current q-value and new mapping
        const pixelPosition = findClosestPixelForQValue(linecut.position);
        return { ...linecut, pixelPosition };
      })
    );
  }, [qYMatrix, horizontalLinecuts, findClosestPixelForQValue]);

  return {
    horizontalLinecuts,
    addHorizontalLinecut,
    updateHorizontalLinecutPosition,
    updateHorizontalLinecutWidth,
    updateHorizontalLinecutColor,
    deleteHorizontalLinecut,
    toggleHorizontalLinecutVisibility,
  };
}
