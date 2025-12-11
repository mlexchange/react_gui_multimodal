import { useCallback, useState, useEffect } from 'react';
import { Linecut } from '../types';
import { leftImageColorPalette, rightImageColorPalette } from '../utils/constants';
import { throttle } from 'lodash';
import { findPixelPositionForQValue } from '../utils/findPixelPositionForQValue';

/**
 * Custom hook for managing horizontal linecuts based on q-values
 *
 * @param qYMatrix - 2D matrix of q-values along Y axis
 * @returns Object with linecut data and management functions
 */
export default function useHorizontalLinecut(
    qYMatrix: number[][]
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
   * Restore linecuts from a saved session
   * Pixel positions will be recalculated when qYMatrix is available
   */
  const restoreLinecuts = useCallback((linecuts: Linecut[]) => {
    setHorizontalLinecuts(linecuts);
  }, []);

  /**
   * Synchronizes pixel positions when qYMatrix changes
   */
  useEffect(() => {
    // Skip if qYMatrix is empty
    if (!qYMatrix || !qYMatrix.length) return;

    // Update all linecuts with new pixel positions based on their q-values
    setHorizontalLinecuts(prev => {
      // Skip if no linecuts exist
      if (!prev.length) return prev;

      return prev.map(linecut => {
        // Recalculate pixel position based on current q-value and new mapping
        const pixelPosition = findClosestPixelForQValue(linecut.position);
        return { ...linecut, pixelPosition };
      });
    });
  }, [qYMatrix, findClosestPixelForQValue]);

  return {
    horizontalLinecuts,
    addHorizontalLinecut,
    updateHorizontalLinecutPosition,
    updateHorizontalLinecutWidth,
    updateHorizontalLinecutColor,
    deleteHorizontalLinecut,
    toggleHorizontalLinecutVisibility,
    restoreLinecuts,
  };
}
