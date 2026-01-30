/**
 * Hook for managing horizontal linecuts.
 * Uses the generic useLinecutBase factory for common functionality.
 */
import { useCallback, useEffect } from "react";
import { Linecut, LinecutData } from "../types";
import { findPixelPositionForQValue } from "../utils/findPixelPositionForQValue";
import {
  fetchHorizontalLinecut,
  cancelLinecutRequest
} from "../services/linecutApi";
import { useLinecutBase, UseLinecutBaseProps } from "./useLinecutBase";
import { useThrottledCallback } from "./useThrottledCallback";

// ============================================================================
// Types
// ============================================================================

export interface UseHorizontalLinecutProps extends UseLinecutBaseProps {
  qYVector: number[];
  npt?: number;
}

// ============================================================================
// Hook
// ============================================================================

export default function useHorizontalLinecut({
  qYVector,
  leftScanUri,
  rightScanUri,
  calibrationParams,
  experimentType,
  maskUri,
  npt
}: UseHorizontalLinecutProps) {
  // =========================================================================
  // Configuration for base hook
  // =========================================================================

  const createDefaultLinecut = useCallback(
    (id: number): Linecut => {
      // Calculate default q-value at the middle of the available range
      let minQ = Infinity;
      let maxQ = -Infinity;

      if (qYVector && qYVector.length > 0) {
        for (let y = 0; y < qYVector.length; y++) {
          if (qYVector[y] !== undefined) {
            minQ = Math.min(minQ, qYVector[y]);
            maxQ = Math.max(maxQ, qYVector[y]);
          }
        }
      }

      const defaultQ =
        minQ !== Infinity && maxQ !== -Infinity ? (minQ + maxQ) / 2 : 0;
      const pixelPosition = findPixelPositionForQValue(defaultQ, qYVector);

      return {
        id,
        position: defaultQ,
        pixelPosition,
        leftColor: "", // Will be set by base hook
        rightColor: "", // Will be set by base hook
        hidden: false,
        width: 0.0,
        type: "horizontal"
      };
    },
    [qYVector]
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
    {
      leftScanUri,
      rightScanUri,
      calibrationParams,
      experimentType,
      maskUri,
      npt
    },
    {
      linecutType: "horizontal",
      createDefaultLinecut,
      getLinecutParams,
      transformResult,
      fetchLinecut: fetchHorizontalLinecut,
      cancelRequest: cancelLinecutRequest
    }
  );

  // =========================================================================
  // Horizontal-specific: pixel position helpers
  // =========================================================================

  const findClosestPixelForQValue = useCallback(
    (targetQ: number): number => {
      return findPixelPositionForQValue(targetQ, qYVector);
    },
    [qYVector]
  );

  // =========================================================================
  // Horizontal-specific: position and width updates
  // =========================================================================

  const updateHorizontalLinecutPosition = useThrottledCallback(
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

  const updateHorizontalLinecutWidth = useThrottledCallback(
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
  // Horizontal-specific: sync pixel positions when qYVector changes
  // =========================================================================

  const { setLinecuts } = base;
  useEffect(() => {
    if (!qYVector || !qYVector.length) return;

    setLinecuts((prev) => {
      if (!prev.length) return prev;

      return prev.map((linecut) => {
        const pixelPosition = findClosestPixelForQValue(linecut.position);
        return { ...linecut, pixelPosition };
      });
    });
  }, [qYVector, findClosestPixelForQValue, setLinecuts]);

  // =========================================================================
  // Return with horizontal-specific naming
  // =========================================================================

  return {
    horizontalLinecuts: base.linecuts,
    leftLinecutData: base.leftLinecutData,
    rightLinecutData: base.rightLinecutData,
    loadingHorizontalLinecuts: base.loadingLinecuts,
    useApi: base.useApi,
    addHorizontalLinecut: base.addLinecut,
    updateHorizontalLinecutPosition,
    updateHorizontalLinecutWidth,
    updateHorizontalLinecutColor: base.updateColor,
    deleteHorizontalLinecut: base.deleteLinecut,
    toggleHorizontalLinecutVisibility: base.toggleVisibility,
    restoreLinecuts: base.restoreLinecuts
  };
}
