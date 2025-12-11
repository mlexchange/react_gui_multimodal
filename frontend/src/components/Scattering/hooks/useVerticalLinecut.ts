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
   * Restore linecuts from a saved session
   * Pixel positions will be recalculated when qXMatrix is available
   */
  const restoreLinecuts = useCallback((linecuts: Linecut[]) => {
    setVerticalLinecuts(linecuts);
  }, []);

  /**
   * Synchronizes pixel positions when qXMatrix changes
   */
  useEffect(() => {
    // Skip if qXMatrix is empty
    if (!qXMatrix || !qXMatrix.length) return;

    // Update all linecuts with new pixel positions based on their q-values
    setVerticalLinecuts(prev => {
      // Skip if no linecuts exist
      if (!prev.length) return prev;

      return prev.map(linecut => {
        // Recalculate pixel position based on current q-value and new mapping
        const pixelPosition = findClosestPixelForQValue(linecut.position);
        return { ...linecut, pixelPosition };
      });
    });
  }, [qXMatrix, findClosestPixelForQValue]);

  return {
    verticalLinecuts,
    addVerticalLinecut,
    updateVerticalLinecutPosition,
    updateVerticalLinecutWidth,
    updateVerticalLinecutColor,
    deleteVerticalLinecut,
    toggleVerticalLinecutVisibility,
    restoreLinecuts,
  };
}
