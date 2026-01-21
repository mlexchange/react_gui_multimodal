import { useState, useCallback, useEffect } from "react";
import {
  leftImageColorPalette,
  rightImageColorPalette
} from "../utils/constants";
import { throttle } from "lodash";
import {
  InclinedLinecut,
  InclinedLinecutData,
  CalibrationParams,
  isCalibrationComplete,
  LinecutResult
} from "../types";
import {
  fetchInclinedLinecut,
  cancelLinecutRequest
} from "../services/linecutApi";

/**
 * Props for the useInclinedLinecut hook.
 */
export interface UseInclinedLinecutProps {
  leftScanUri: string | null;
  rightScanUri: string | null;
  calibrationParams: CalibrationParams | null;
  experimentType: string;
  maskUri?: string | null;
}

/**
 * Custom hook for managing inclined linecuts in q-space.
 * Fetches linecut data from the backend API with debouncing.
 */
export default function useInclinedLinecut({
  leftScanUri,
  rightScanUri,
  calibrationParams,
  experimentType,
  maskUri
}: UseInclinedLinecutProps) {
  // State for linecut definitions
  const [inclinedLinecuts, setInclinedLinecuts] = useState<InclinedLinecut[]>(
    []
  );

  // Legacy format: intensity-only data (used by InclinedLinecutFig)
  const [inclinedLinecutData1, setInclinedLinecutData1] = useState<
    { id: number; data: number[] }[]
  >([]);
  const [inclinedLinecutData2, setInclinedLinecutData2] = useState<
    { id: number; data: number[] }[]
  >([]);

  // API-fetched data with full path distance and intensity arrays
  const [leftLinecutData, setLeftLinecutData] = useState<
    Map<number, InclinedLinecutData>
  >(new Map());
  const [rightLinecutData, setRightLinecutData] = useState<
    Map<number, InclinedLinecutData>
  >(new Map());

  // Loading state per linecut
  const [loadingInclinedLinecuts, setLoadingInclinedLinecuts] = useState<
    Set<number>
  >(new Set());

  // Check if API can be used (calibration complete and scan URIs available)
  const useApi =
    isCalibrationComplete(calibrationParams) && !!(leftScanUri || rightScanUri);

  /**
   * Fetch linecut data from API for both scans.
   */
  const fetchLinecutData = useCallback(
    (linecut: InclinedLinecut) => {
      if (!useApi || !calibrationParams) return;

      setLoadingInclinedLinecuts((prev) => new Set(prev).add(linecut.id));

      const commonParams = {
        calibration: calibrationParams,
        experimentType,
        qXPosition: linecut.qXPosition,
        qYPosition: linecut.qYPosition,
        angle: linecut.angle,
        qWidth: linecut.qWidth,
        maskUri
      };

      // Fetch for left scan
      if (leftScanUri) {
        fetchInclinedLinecut(
          linecut.id,
          "left",
          { ...commonParams, scanUri: leftScanUri },
          {
            onSuccess: (result: LinecutResult) => {
              if (result.success) {
                setLeftLinecutData((prev) => {
                  const updated = new Map(prev);
                  updated.set(linecut.id, {
                    pathDistances: result.q_values, // For inclined, these are path distances
                    intensities: result.intensities
                  });
                  return updated;
                });
                // Also update legacy format for compatibility
                setInclinedLinecutData1((prev) => {
                  const existing = prev.filter((d) => d.id !== linecut.id);
                  return [
                    ...existing,
                    { id: linecut.id, data: result.intensities }
                  ];
                });
              }
              setLoadingInclinedLinecuts((prev) => {
                const updated = new Set(prev);
                if (!rightScanUri) {
                  updated.delete(linecut.id);
                }
                return updated;
              });
            },
            onError: (error) => {
              console.error(
                `[Inclined ${linecut.id}] Left fetch error:`,
                error
              );
              setLoadingInclinedLinecuts((prev) => {
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
        fetchInclinedLinecut(
          linecut.id,
          "right",
          { ...commonParams, scanUri: rightScanUri },
          {
            onSuccess: (result: LinecutResult) => {
              if (result.success) {
                setRightLinecutData((prev) => {
                  const updated = new Map(prev);
                  updated.set(linecut.id, {
                    pathDistances: result.q_values,
                    intensities: result.intensities
                  });
                  return updated;
                });
                // Also update legacy format for compatibility
                setInclinedLinecutData2((prev) => {
                  const existing = prev.filter((d) => d.id !== linecut.id);
                  return [
                    ...existing,
                    { id: linecut.id, data: result.intensities }
                  ];
                });
              }
              setLoadingInclinedLinecuts((prev) => {
                const updated = new Set(prev);
                updated.delete(linecut.id);
                return updated;
              });
            },
            onError: (error) => {
              console.error(
                `[Inclined ${linecut.id}] Right fetch error:`,
                error
              );
              setLoadingInclinedLinecuts((prev) => {
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
   * Create a new inclined linecut at the center of the available q-range.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const addInclinedLinecut = useCallback(
    throttle(() => {
      const existingIds = inclinedLinecuts.map((linecut) => linecut.id);
      const newId = Math.max(0, ...existingIds) + 1;

      const newLinecut: InclinedLinecut = {
        id: newId,
        qXPosition: 0,
        qYPosition: 0,
        angle: 45,
        qWidth: 0,
        width: 0,
        leftColor:
          leftImageColorPalette[(newId - 1) % leftImageColorPalette.length],
        rightColor:
          rightImageColorPalette[(newId - 1) % rightImageColorPalette.length],
        hidden: false,
        type: "inclined"
      };

      setInclinedLinecuts((prev) => [...prev, newLinecut]);

      // Trigger API fetch for the new linecut
      setTimeout(() => {
        if (useApi) {
          fetchLinecutData(newLinecut);
        }
      }, 0);
    }, 200),
    [inclinedLinecuts, useApi, fetchLinecutData]
  );

  /**
   * Updates the angle of an inclined linecut.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateInclinedLinecutAngle = useCallback(
    throttle((id: number, angle: number) => {
      const normalizedAngle = (((angle % 360) + 540) % 360) - 180;

      setInclinedLinecuts((prev) => {
        const updated = prev.map((linecut) =>
          linecut.id === id ? { ...linecut, angle: normalizedAngle } : linecut
        );

        const updatedLinecut = updated.find((l) => l.id === id);
        if (updatedLinecut && useApi) {
          fetchLinecutData(updatedLinecut);
        }

        return updated;
      });
    }, 200),
    [useApi, fetchLinecutData]
  );

  /**
   * Updates the width of an inclined linecut in q-space.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateInclinedLinecutWidth = useCallback(
    throttle((id: number, qWidth: number) => {
      setInclinedLinecuts((prev) => {
        const updated = prev.map((linecut) =>
          linecut.id === id ? { ...linecut, qWidth } : linecut
        );

        const updatedLinecut = updated.find((l) => l.id === id);
        if (updatedLinecut && useApi) {
          fetchLinecutData(updatedLinecut);
        }

        return updated;
      });
    }, 200),
    [useApi, fetchLinecutData]
  );

  /**
   * Updates the color of a linecut.
   */
  const updateInclinedLinecutColor = useCallback(
    (id: number, side: "left" | "right", color: string) => {
      setInclinedLinecuts((prev) =>
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
  const deleteInclinedLinecut = useCallback((id: number) => {
    // Cancel any pending requests for this linecut
    cancelLinecutRequest("inclined", id, "left");
    cancelLinecutRequest("inclined", id, "right");

    setInclinedLinecuts((prev) => {
      const updatedLinecuts = prev.filter((linecut) => linecut.id !== id);
      return updatedLinecuts.map((linecut, index) => ({
        ...linecut,
        id: index + 1
      }));
    });

    setInclinedLinecutData1((prev) =>
      prev
        .filter((data) => data.id !== id)
        .map((data, index) => ({
          ...data,
          id: index + 1
        }))
    );

    setInclinedLinecutData2((prev) =>
      prev
        .filter((data) => data.id !== id)
        .map((data, index) => ({
          ...data,
          id: index + 1
        }))
    );

    setLeftLinecutData((prev) => {
      const updated = new Map(prev);
      updated.delete(id);
      return updated;
    });

    setRightLinecutData((prev) => {
      const updated = new Map(prev);
      updated.delete(id);
      return updated;
    });

    setLoadingInclinedLinecuts((prev) => {
      const updated = new Set(prev);
      updated.delete(id);
      return updated;
    });
  }, []);

  /**
   * Toggles the visibility of a linecut.
   */
  const toggleInclinedLinecutVisibility = useCallback((id: number) => {
    setInclinedLinecuts((prev) =>
      prev.map((linecut) =>
        linecut.id === id ? { ...linecut, hidden: !linecut.hidden } : linecut
      )
    );
  }, []);

  /**
   * Restore linecuts from a saved session.
   */
  const restoreLinecuts = useCallback((linecuts: InclinedLinecut[]) => {
    setInclinedLinecuts(linecuts);
    setInclinedLinecutData1([]);
    setInclinedLinecutData2([]);
    setLeftLinecutData(new Map());
    setRightLinecutData(new Map());
  }, []);

  /**
   * Refetch all linecut data when context changes.
   * Note: Intentionally excludes fetchLinecutData, inclinedLinecuts, and useApi
   * from deps to prevent infinite loops.
   */
  useEffect(() => {
    if (!useApi || inclinedLinecuts.length === 0) return;

    // Refetch data for all linecuts when scan URIs or calibration changes
    inclinedLinecuts.forEach((linecut) => {
      fetchLinecutData(linecut);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftScanUri, rightScanUri, calibrationParams, experimentType, maskUri]);

  return {
    inclinedLinecuts,
    inclinedLinecutData1,
    inclinedLinecutData2,
    leftLinecutData,
    rightLinecutData,
    loadingInclinedLinecuts,
    useApi,
    addInclinedLinecut,
    updateInclinedLinecutAngle,
    updateInclinedLinecutWidth,
    updateInclinedLinecutColor,
    deleteInclinedLinecut,
    toggleInclinedLinecutVisibility,
    restoreLinecuts
  };
}
