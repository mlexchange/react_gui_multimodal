import { useCallback, useState, useEffect, useRef } from 'react';
import { Linecut, CalibrationParams, isCalibrationComplete, LinecutResult } from '../types';
import { leftImageColorPalette, rightImageColorPalette } from '../utils/constants';
import { throttle } from 'lodash';
import { findPixelPositionForQValue } from '../utils/findPixelPositionForQValue';
import {
  fetchVerticalLinecut,
  cancelLinecutRequest,
} from '../services/linecutApi';

/**
 * Linecut data for plotting.
 */
export interface LinecutData {
  qValues: number[];
  intensities: number[];
}

/**
 * Props for the useVerticalLinecut hook.
 */
export interface UseVerticalLinecutProps {
  qXMatrix: number[][];
  leftScanUri: string | null;
  rightScanUri: string | null;
  calibrationParams: CalibrationParams | null;
  experimentType: string;
  maskUri?: string | null;
}

/**
 * Custom hook for managing vertical linecuts.
 * Fetches linecut data from the backend API with debouncing.
 */
export default function useVerticalLinecut({
  qXMatrix,
  leftScanUri,
  rightScanUri,
  calibrationParams,
  experimentType,
  maskUri,
}: UseVerticalLinecutProps) {
  // State for linecut definitions
  const [verticalLinecuts, setVerticalLinecuts] = useState<Linecut[]>([]);

  // State for linecut data (fetched from API)
  const [leftLinecutData, setLeftLinecutData] = useState<Map<number, LinecutData>>(new Map());
  const [rightLinecutData, setRightLinecutData] = useState<Map<number, LinecutData>>(new Map());

  // Loading state per linecut
  const [loadingVerticalLinecuts, setLoadingVerticalLinecuts] = useState<Set<number>>(new Set());

  // Check if API can be used (calibration complete and scan URIs available)
  const useApi = isCalibrationComplete(calibrationParams) && !!(leftScanUri || rightScanUri);

  // Ref to track latest linecuts for callbacks
  const linecutsRef = useRef(verticalLinecuts);
  linecutsRef.current = verticalLinecuts;

  /**
   * Converts a q-value to the corresponding pixel column index.
   * Used for overlay positioning on the scattering images.
   */
  const findClosestPixelForQValue = useCallback((targetQ: number): number => {
    return findPixelPositionForQValue(targetQ, qXMatrix, 'vertical');
  }, [qXMatrix]);

  /**
   * Fetch linecut data from API for both scans.
   */
  const fetchLinecutData = useCallback((linecut: Linecut) => {
    if (!useApi || !calibrationParams) return;

    // Set loading state
    setLoadingVerticalLinecuts(prev => new Set(prev).add(linecut.id));

    const commonParams = {
      calibration: calibrationParams,
      experimentType,
      position: linecut.position,
      width: linecut.width,
      maskUri,
    };

    // Fetch for left scan
    if (leftScanUri) {
      fetchVerticalLinecut(
        linecut.id,
        'left',
        { ...commonParams, scanUri: leftScanUri },
        {
          onSuccess: (result: LinecutResult) => {
            if (result.success) {
              setLeftLinecutData(prev => {
                const updated = new Map(prev);
                updated.set(linecut.id, {
                  qValues: result.q_values,
                  intensities: result.intensities,
                });
                return updated;
              });
            }
            // Clear loading state (partially - wait for both)
            setLoadingVerticalLinecuts(prev => {
              const updated = new Set(prev);
              if (!rightScanUri) {
                updated.delete(linecut.id);
              }
              return updated;
            });
          },
          onError: (error) => {
            console.error(`[Linecut ${linecut.id}] Left fetch error:`, error);
            setLoadingVerticalLinecuts(prev => {
              const updated = new Set(prev);
              updated.delete(linecut.id);
              return updated;
            });
          },
        }
      );
    }

    // Fetch for right scan
    if (rightScanUri) {
      fetchVerticalLinecut(
        linecut.id,
        'right',
        { ...commonParams, scanUri: rightScanUri },
        {
          onSuccess: (result: LinecutResult) => {
            if (result.success) {
              setRightLinecutData(prev => {
                const updated = new Map(prev);
                updated.set(linecut.id, {
                  qValues: result.q_values,
                  intensities: result.intensities,
                });
                return updated;
              });
            }
            // Clear loading state
            setLoadingVerticalLinecuts(prev => {
              const updated = new Set(prev);
              updated.delete(linecut.id);
              return updated;
            });
          },
          onError: (error) => {
            console.error(`[Linecut ${linecut.id}] Right fetch error:`, error);
            setLoadingVerticalLinecuts(prev => {
              const updated = new Set(prev);
              updated.delete(linecut.id);
              return updated;
            });
          },
        }
      );
    }
  }, [useApi, calibrationParams, experimentType, leftScanUri, rightScanUri, maskUri]);

  /**
   * Creates a new vertical linecut at the center of the q-range.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const addVerticalLinecut = useCallback(throttle(() => {
    const existingIds = verticalLinecuts.map((linecut) => linecut.id);
    const newId = Math.max(0, ...existingIds) + 1;

    // Calculate default q-value at the middle of the available range
    let minQ = Infinity;
    let maxQ = -Infinity;

    if (qXMatrix && qXMatrix.length > 0 && qXMatrix[0]) {
      for (let x = 0; x < qXMatrix[0].length; x++) {
        if (qXMatrix[0][x] !== undefined) {
          minQ = Math.min(minQ, qXMatrix[0][x]);
          maxQ = Math.max(maxQ, qXMatrix[0][x]);
        }
      }
    }

    const defaultQ = (minQ !== Infinity && maxQ !== -Infinity)
      ? (minQ + maxQ) / 2
      : 0;

    const pixelPosition = findClosestPixelForQValue(defaultQ);

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

    setVerticalLinecuts((prev) => [...prev, newLinecut]);

    // Trigger API fetch for the new linecut
    setTimeout(() => fetchLinecutData(newLinecut), 0);

  }, 200), [verticalLinecuts, findClosestPixelForQValue, qXMatrix, fetchLinecutData]);

  /**
   * Updates the position of an existing linecut.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateVerticalLinecutPosition = useCallback(
    throttle((id: number, position: number) => {
      const pixelPosition = findClosestPixelForQValue(position);

      setVerticalLinecuts(prev => {
        const updated = prev.map(linecut =>
          linecut.id === id ? {
            ...linecut,
            position: position,
            pixelPosition: pixelPosition
          } : linecut
        );

        // Trigger API fetch for updated linecut
        const updatedLinecut = updated.find(l => l.id === id);
        if (updatedLinecut) {
          fetchLinecutData(updatedLinecut);
        }

        return updated;
      });
    }, 200),
    [findClosestPixelForQValue, fetchLinecutData]
  );

  /**
   * Updates the width of a linecut in q-space.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateVerticalLinecutWidth = useCallback(
    throttle((id: number, width: number) => {
      setVerticalLinecuts((prev) => {
        const updated = prev.map((linecut) =>
          linecut.id === id ? { ...linecut, width } : linecut
        );

        // Trigger API fetch for updated linecut
        const updatedLinecut = updated.find(l => l.id === id);
        if (updatedLinecut) {
          fetchLinecutData(updatedLinecut);
        }

        return updated;
      });
    }, 200),
    [fetchLinecutData]
  );

  /**
   * Updates the color of a linecut.
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
   * Removes a linecut and renumbers the remaining ones.
   */
  const deleteVerticalLinecut = useCallback((id: number) => {
    cancelLinecutRequest('vertical', id, 'left');
    cancelLinecutRequest('vertical', id, 'right');

    setVerticalLinecuts((prev) => {
      const updatedLinecuts = prev.filter((linecut) => linecut.id !== id);
      return updatedLinecuts.map((linecut, index) => ({
        ...linecut,
        id: index + 1,
      }));
    });

    // Renumber data Map keys to match new linecut IDs
    const renumberMap = (prev: Map<number, LinecutData>) => {
      const entries = Array.from(prev.entries())
        .filter(([key]) => key !== id)
        .sort(([a], [b]) => a - b)
        .map(([, value], index) => [index + 1, value] as [number, LinecutData]);
      return new Map(entries);
    };

    setLeftLinecutData(renumberMap);
    setRightLinecutData(renumberMap);
    setLoadingVerticalLinecuts(prev => {
      const updated = new Set(prev);
      updated.delete(id);
      return updated;
    });
  }, []);

  /**
   * Toggles the visibility of a linecut.
   */
  const toggleVerticalLinecutVisibility = useCallback((id: number) => {
    setVerticalLinecuts((prev) =>
      prev.map((linecut) =>
        linecut.id === id ? { ...linecut, hidden: !linecut.hidden } : linecut
      )
    );
  }, []);

  /**
   * Restore linecuts from a saved session.
   */
  const restoreLinecuts = useCallback((linecuts: Linecut[]) => {
    setVerticalLinecuts(linecuts);
    // Clear existing data - will be refetched by effect below
    setLeftLinecutData(new Map());
    setRightLinecutData(new Map());
  }, []);

  /**
   * Synchronizes pixel positions when qXMatrix changes.
   */
  useEffect(() => {
    if (!qXMatrix || !qXMatrix.length) return;

    setVerticalLinecuts(prev => {
      if (!prev.length) return prev;

      return prev.map(linecut => {
        const pixelPosition = findClosestPixelForQValue(linecut.position);
        return { ...linecut, pixelPosition };
      });
    });
  }, [qXMatrix, findClosestPixelForQValue]);

  /**
   * Refetch all linecut data when context changes.
   * Note: Intentionally excludes fetchLinecutData, verticalLinecuts, and useApi
   * from deps to prevent infinite loops.
   */
  useEffect(() => {
    if (!useApi) return;

    // Refetch data for all linecuts when scan URIs or calibration changes
    verticalLinecuts.forEach(linecut => {
      fetchLinecutData(linecut);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftScanUri, rightScanUri, calibrationParams, experimentType, maskUri]);

  return {
    verticalLinecuts,
    leftLinecutData,
    rightLinecutData,
    loadingVerticalLinecuts,
    useApi,
    addVerticalLinecut,
    updateVerticalLinecutPosition,
    updateVerticalLinecutWidth,
    updateVerticalLinecutColor,
    deleteVerticalLinecut,
    toggleVerticalLinecutVisibility,
    restoreLinecuts,
  };
}
