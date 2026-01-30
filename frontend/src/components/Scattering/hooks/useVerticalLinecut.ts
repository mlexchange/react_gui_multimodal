/**
 * Hook for managing vertical linecuts.
 * Uses the generic useLinecutBase factory for common functionality.
 */
import { useCallback, useEffect } from "react";
import { Linecut, LinecutData } from "../types";
import { findPixelPositionForQValue } from "../utils/findPixelPositionForQValue";
import {
  fetchVerticalLinecut,
  cancelLinecutRequest
} from "../services/linecutApi";
import { useLinecutBase, UseLinecutBaseProps } from "./useLinecutBase";
import { useThrottledCallback } from "./useThrottledCallback";

// ============================================================================
// Types
// ============================================================================

export interface UseVerticalLinecutProps extends UseLinecutBaseProps {
  qXVector: number[];
}

// ============================================================================
// Hook
// ============================================================================

export default function useVerticalLinecut({
  qXVector,
  leftScanUri,
  rightScanUri,
  calibrationParams,
  experimentType,
  maskUri
}: UseVerticalLinecutProps) {
  // =========================================================================
  // Configuration for base hook
  // =========================================================================

  const createDefaultLinecut = useCallback(
    (id: number): Linecut => {
      // Calculate default q-value at the middle of the available range
      let minQ = Infinity;
      let maxQ = -Infinity;

      if (qXVector && qXVector.length > 0) {
        for (let x = 0; x < qXVector.length; x++) {
          if (qXVector[x] !== undefined) {
            minQ = Math.min(minQ, qXVector[x]);
            maxQ = Math.max(maxQ, qXVector[x]);
          }
        }
      }

      const defaultQ =
        minQ !== Infinity && maxQ !== -Infinity ? (minQ + maxQ) / 2 : 0;
      const pixelPosition = findPixelPositionForQValue(defaultQ, qXVector);

      return {
        id,
        position: defaultQ,
        pixelPosition,
        leftColor: "", // Will be set by base hook
        rightColor: "", // Will be set by base hook
        hidden: false,
        width: 0.0,
        type: "vertical"
      };
    },
    [qXVector]
  );

  const getLinecutParams = useCallback((linecut: Linecut) => {
    return {
      position: linecut.position,
      width: linecut.width
    };
  }, []);

  const transformResult = useCallback(
    (result: { q_values: number[]; intensities: number[] }): LinecutData => {
      return {
        qValues: result.q_values,
        intensities: result.intensities
      };
    },
    []
  );

  // =========================================================================
  // Use base hook
  // =========================================================================

  const base = useLinecutBase<Linecut, LinecutData>(
    { leftScanUri, rightScanUri, calibrationParams, experimentType, maskUri },
    {
      linecutType: "vertical",
      createDefaultLinecut,
      getLinecutParams,
      transformResult,
      fetchLinecut: fetchVerticalLinecut,
      cancelRequest: cancelLinecutRequest
    }
  );

  // =========================================================================
  // Vertical-specific: pixel position helpers
  // =========================================================================

  const findClosestPixelForQValue = useCallback(
    (targetQ: number): number => {
      return findPixelPositionForQValue(targetQ, qXVector);
    },
    [qXVector]
  );

  // =========================================================================
  // Vertical-specific: position and width updates
  // =========================================================================

  const updateVerticalLinecutPosition = useThrottledCallback(
    (id: number, position: number) => {
      const pixelPosition = findClosestPixelForQValue(position);

      base.setLinecuts((prev) => {
        const updated = prev.map((linecut) =>
          linecut.id === id ? { ...linecut, position, pixelPosition } : linecut
        );

        // Trigger API fetch for updated linecut
        const updatedLinecut = updated.find((l) => l.id === id);
        if (updatedLinecut) {
          base.fetchLinecutData(updatedLinecut);
        }

        return updated;
      });
    },
    200
  );

  const updateVerticalLinecutWidth = useThrottledCallback(
    (id: number, width: number) => {
      base.setLinecuts((prev) => {
        const updated = prev.map((linecut) =>
          linecut.id === id ? { ...linecut, width } : linecut
        );

        const updatedLinecut = updated.find((l) => l.id === id);
        if (updatedLinecut) {
          base.fetchLinecutData(updatedLinecut);
        }

        return updated;
      });
    },
    200
  );

  // =========================================================================
  // Vertical-specific: sync pixel positions when qXVector changes
  // =========================================================================

  const { setLinecuts } = base;
  useEffect(() => {
    if (!qXVector || !qXVector.length) return;

    setLinecuts((prev) => {
      if (!prev.length) return prev;

      return prev.map((linecut) => {
        const pixelPosition = findClosestPixelForQValue(linecut.position);
        return { ...linecut, pixelPosition };
      });
    });
  }, [qXVector, findClosestPixelForQValue, setLinecuts]);

  // =========================================================================
  // Return with vertical-specific naming
  // =========================================================================

  return {
    verticalLinecuts: base.linecuts,
    leftLinecutData: base.leftLinecutData,
    rightLinecutData: base.rightLinecutData,
    loadingVerticalLinecuts: base.loadingLinecuts,
    useApi: base.useApi,
    addVerticalLinecut: base.addLinecut,
    updateVerticalLinecutPosition,
    updateVerticalLinecutWidth,
    updateVerticalLinecutColor: base.updateColor,
    deleteVerticalLinecut: base.deleteLinecut,
    toggleVerticalLinecutVisibility: base.toggleVisibility,
    restoreLinecuts: base.restoreLinecuts
  };
}
