import { useCallback, useState, useEffect, useRef } from "react";
import {
  Linecut,
  LinecutData,
  CalibrationParams,
  isCalibrationComplete,
  LinecutResult
} from "../types";
import {
  leftImageColorPalette,
  rightImageColorPalette
} from "../utils/constants";
import { throttle } from "lodash";
import { findPixelPositionForQValue } from "../utils/findPixelPositionForQValue";
import {
  fetchHorizontalLinecut,
  cancelLinecutRequest
} from "../services/linecutApi";

/**
 * Props for the useHorizontalLinecut hook.
 */
export interface UseHorizontalLinecutProps {
  qYMatrix: number[][];
  leftScanUri: string | null;
  rightScanUri: string | null;
  calibrationParams: CalibrationParams | null;
  experimentType: string;
  maskUri?: string | null;
}

/**
 * Custom hook for managing horizontal linecuts.
 * Fetches linecut data from the backend API with debouncing.
 */
export default function useHorizontalLinecut({
  qYMatrix,
  leftScanUri,
  rightScanUri,
  calibrationParams,
  experimentType,
  maskUri
}: UseHorizontalLinecutProps) {
  // State for linecut definitions
  const [horizontalLinecuts, setHorizontalLinecuts] = useState<Linecut[]>([]);

  // State for linecut data (fetched from API)
  const [leftLinecutData, setLeftLinecutData] = useState<
    Map<number, LinecutData>
  >(new Map());
  const [rightLinecutData, setRightLinecutData] = useState<
    Map<number, LinecutData>
  >(new Map());

  // Loading state per linecut
  const [loadingHorizontalLinecuts, setLoadingHorizontalLinecuts] = useState<
    Set<number>
  >(new Set());

  // Check if API can be used (calibration complete and scan URIs available)
  const useApi =
    isCalibrationComplete(calibrationParams) && !!(leftScanUri || rightScanUri);

  // Ref to track latest linecuts for callbacks
  const linecutsRef = useRef(horizontalLinecuts);
  linecutsRef.current = horizontalLinecuts;

  /**
   * Converts a q-value to the corresponding pixel row index.
   * Used for overlay positioning on the scattering images.
   */
  const findClosestPixelForQValue = useCallback(
    (targetQ: number): number => {
      return findPixelPositionForQValue(targetQ, qYMatrix, "horizontal");
    },
    [qYMatrix]
  );

  /**
   * Fetch linecut data from API for both scans.
   */
  const fetchLinecutData = useCallback(
    (linecut: Linecut) => {
      if (!useApi || !calibrationParams) return;

      // Set loading state
      setLoadingHorizontalLinecuts((prev) => new Set(prev).add(linecut.id));

      const commonParams = {
        calibration: calibrationParams,
        experimentType,
        position: linecut.position,
        width: linecut.width,
        maskUri
      };

      // Fetch for left scan
      if (leftScanUri) {
        fetchHorizontalLinecut(
          linecut.id,
          "left",
          { ...commonParams, scanUri: leftScanUri },
          {
            onSuccess: (result: LinecutResult) => {
              if (result.success) {
                setLeftLinecutData((prev) => {
                  const updated = new Map(prev);
                  updated.set(linecut.id, {
                    qValues: result.q_values,
                    intensities: result.intensities
                  });
                  return updated;
                });
              }
              // Clear loading state (partially - wait for both)
              setLoadingHorizontalLinecuts((prev) => {
                const updated = new Set(prev);
                if (!rightScanUri) {
                  updated.delete(linecut.id);
                }
                return updated;
              });
            },
            onError: (error) => {
              console.error(`[Linecut ${linecut.id}] Left fetch error:`, error);
              setLoadingHorizontalLinecuts((prev) => {
                const updated = new Set(prev);
                updated.delete(linecut.id);
                return updated;
              });
            }
          }
        );
      }

      // Fetch for right scan
      if (rightScanUri) {
        fetchHorizontalLinecut(
          linecut.id,
          "right",
          { ...commonParams, scanUri: rightScanUri },
          {
            onSuccess: (result: LinecutResult) => {
              if (result.success) {
                setRightLinecutData((prev) => {
                  const updated = new Map(prev);
                  updated.set(linecut.id, {
                    qValues: result.q_values,
                    intensities: result.intensities
                  });
                  return updated;
                });
              }
              // Clear loading state
              setLoadingHorizontalLinecuts((prev) => {
                const updated = new Set(prev);
                updated.delete(linecut.id);
                return updated;
              });
            },
            onError: (error) => {
              console.error(
                `[Linecut ${linecut.id}] Right fetch error:`,
                error
              );
              setLoadingHorizontalLinecuts((prev) => {
                const updated = new Set(prev);
                updated.delete(linecut.id);
                return updated;
              });
            }
          }
        );
      }
    },
    [
      useApi,
      calibrationParams,
      experimentType,
      leftScanUri,
      rightScanUri,
      maskUri
    ]
  );

  /**
   * Creates a new horizontal linecut at the center of the q-range.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const addHorizontalLinecut = useCallback(
    throttle(() => {
      const existingIds = horizontalLinecuts.map((linecut) => linecut.id);
      const newId = Math.max(0, ...existingIds) + 1;

      // Calculate default q-value at the middle of the available range
      let minQ = Infinity;
      let maxQ = -Infinity;

      if (qYMatrix && qYMatrix.length > 0) {
        for (let y = 0; y < qYMatrix.length; y++) {
          if (qYMatrix[y] && qYMatrix[y][0] !== undefined) {
            minQ = Math.min(minQ, qYMatrix[y][0]);
            maxQ = Math.max(maxQ, qYMatrix[y][0]);
          }
        }
      }

      const defaultQ =
        minQ !== Infinity && maxQ !== -Infinity ? (minQ + maxQ) / 2 : 0;

      const pixelPosition = findClosestPixelForQValue(defaultQ);

      const newLinecut: Linecut = {
        id: newId,
        position: defaultQ,
        pixelPosition: pixelPosition,
        leftColor:
          leftImageColorPalette[(newId - 1) % leftImageColorPalette.length],
        rightColor:
          rightImageColorPalette[(newId - 1) % rightImageColorPalette.length],
        hidden: false,
        width: 0.0,
        type: "horizontal"
      };

      setHorizontalLinecuts((prev) => [...prev, newLinecut]);

      // Trigger API fetch for the new linecut
      // Use setTimeout to ensure state is updated first
      setTimeout(() => fetchLinecutData(newLinecut), 0);
    }, 200),
    [horizontalLinecuts, findClosestPixelForQValue, qYMatrix, fetchLinecutData]
  );

  /**
   * Updates the position of an existing linecut.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateHorizontalLinecutPosition = useCallback(
    throttle((id: number, position: number) => {
      const pixelPosition = findClosestPixelForQValue(position);

      setHorizontalLinecuts((prev) => {
        const updated = prev.map((linecut) =>
          linecut.id === id
            ? {
                ...linecut,
                position: position,
                pixelPosition: pixelPosition
              }
            : linecut
        );

        // Trigger API fetch for updated linecut
        const updatedLinecut = updated.find((l) => l.id === id);
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
  const updateHorizontalLinecutWidth = useCallback(
    throttle((id: number, width: number) => {
      setHorizontalLinecuts((prev) => {
        const updated = prev.map((linecut) =>
          linecut.id === id ? { ...linecut, width } : linecut
        );

        // Trigger API fetch for updated linecut
        const updatedLinecut = updated.find((l) => l.id === id);
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
  const updateHorizontalLinecutColor = useCallback(
    (id: number, side: "left" | "right", color: string) => {
      setHorizontalLinecuts((prev) =>
        prev.map((linecut) =>
          linecut.id === id ? { ...linecut, [`${side}Color`]: color } : linecut
        )
      );
    },
    []
  );

  /**
   * Removes a linecut and renumbers the remaining ones.
   */
  const deleteHorizontalLinecut = useCallback((id: number) => {
    cancelLinecutRequest("horizontal", id, "left");
    cancelLinecutRequest("horizontal", id, "right");

    setHorizontalLinecuts((prev) => {
      const updatedLinecuts = prev.filter((linecut) => linecut.id !== id);
      return updatedLinecuts.map((linecut, index) => ({
        ...linecut,
        id: index + 1
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
    setLoadingHorizontalLinecuts((prev) => {
      const updated = new Set(prev);
      updated.delete(id);
      return updated;
    });
  }, []);

  /**
   * Toggles the visibility of a linecut.
   */
  const toggleHorizontalLinecutVisibility = useCallback((id: number) => {
    setHorizontalLinecuts((prev) =>
      prev.map((linecut) =>
        linecut.id === id ? { ...linecut, hidden: !linecut.hidden } : linecut
      )
    );
  }, []);

  /**
   * Restore linecuts from a saved session.
   */
  const restoreLinecuts = useCallback((linecuts: Linecut[]) => {
    setHorizontalLinecuts(linecuts);
    // Clear existing data - will be refetched by effect below
    setLeftLinecutData(new Map());
    setRightLinecutData(new Map());
  }, []);

  /**
   * Synchronizes pixel positions when qYMatrix changes.
   */
  useEffect(() => {
    if (!qYMatrix || !qYMatrix.length) return;

    setHorizontalLinecuts((prev) => {
      if (!prev.length) return prev;

      return prev.map((linecut) => {
        const pixelPosition = findClosestPixelForQValue(linecut.position);
        return { ...linecut, pixelPosition };
      });
    });
  }, [qYMatrix, findClosestPixelForQValue]);

  /**
   * Refetch all linecut data when context changes.
   * Note: Intentionally excludes fetchLinecutData, horizontalLinecuts, and useApi
   * from deps to prevent infinite loops - we only want to refetch when external
   * context (URIs, calibration) changes, not when callbacks or linecuts change.
   */
  useEffect(() => {
    if (!useApi) return;

    // Refetch data for all linecuts when scan URIs or calibration changes
    horizontalLinecuts.forEach((linecut) => {
      fetchLinecutData(linecut);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftScanUri, rightScanUri, calibrationParams, experimentType, maskUri]);

  return {
    horizontalLinecuts,
    leftLinecutData,
    rightLinecutData,
    loadingHorizontalLinecuts,
    useApi,
    addHorizontalLinecut,
    updateHorizontalLinecutPosition,
    updateHorizontalLinecutWidth,
    updateHorizontalLinecutColor,
    deleteHorizontalLinecut,
    toggleHorizontalLinecutVisibility,
    restoreLinecuts
  };
}
