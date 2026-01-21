/**
 * Hook for managing horizontal linecuts.
 * Uses the generic useLinecutBase factory for common functionality.
 */
import { useCallback, useEffect } from "react";
import { Linecut, LinecutData } from "../types";
import { throttle } from "lodash";
import { findPixelPositionForQValue } from "../utils/findPixelPositionForQValue";
import {
  fetchHorizontalLinecut,
  cancelLinecutRequest
} from "../services/linecutApi";
import { useLinecutBase, UseLinecutBaseProps } from "./useLinecutBase";

// ============================================================================
// Types
// ============================================================================

export interface UseHorizontalLinecutProps extends UseLinecutBaseProps {
  qYMatrix: number[][];
}

// ============================================================================
// Hook
// ============================================================================

export default function useHorizontalLinecut({
  qYMatrix,
  leftScanUri,
  rightScanUri,
  calibrationParams,
  experimentType,
  maskUri
}: UseHorizontalLinecutProps) {
  // =========================================================================
  // Configuration for base hook
  // =========================================================================

  const createDefaultLinecut = useCallback(
    (id: number): Linecut => {
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
      const pixelPosition = findPixelPositionForQValue(
        defaultQ,
        qYMatrix,
        "horizontal"
      );

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
    [qYMatrix]
  );

  const getLinecutParams = useCallback((linecut: Linecut) => {
    return {
      position: linecut.position,
      width: linecut.width
    };
  }, []);

  const transformResult = useCallback((result: { q_values: number[]; intensities: number[] }): LinecutData => {
    return {
      qValues: result.q_values,
      intensities: result.intensities
    };
  }, []);

  // =========================================================================
  // Use base hook
  // =========================================================================

  const base = useLinecutBase<Linecut, LinecutData>(
    { leftScanUri, rightScanUri, calibrationParams, experimentType, maskUri },
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
      return findPixelPositionForQValue(targetQ, qYMatrix, "horizontal");
    },
    [qYMatrix]
  );

  // =========================================================================
  // Horizontal-specific: position and width updates
  // =========================================================================

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateHorizontalLinecutPosition = useCallback(
    throttle((id: number, position: number) => {
      const pixelPosition = findClosestPixelForQValue(position);

      base.setLinecuts((prev) => {
        const updated = prev.map((linecut) =>
          linecut.id === id
            ? { ...linecut, position, pixelPosition }
            : linecut
        );

        // Trigger API fetch for updated linecut
        const updatedLinecut = updated.find((l) => l.id === id);
        if (updatedLinecut) {
          base.fetchLinecutData(updatedLinecut);
        }

        return updated;
      });
    }, 200),
    [findClosestPixelForQValue, base.fetchLinecutData]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateHorizontalLinecutWidth = useCallback(
    throttle((id: number, width: number) => {
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
    }, 200),
    [base.fetchLinecutData]
  );

  // =========================================================================
  // Horizontal-specific: sync pixel positions when qYMatrix changes
  // =========================================================================

  useEffect(() => {
    if (!qYMatrix || !qYMatrix.length) return;

    base.setLinecuts((prev) => {
      if (!prev.length) return prev;

      return prev.map((linecut) => {
        const pixelPosition = findClosestPixelForQValue(linecut.position);
        return { ...linecut, pixelPosition };
      });
    });
  }, [qYMatrix, findClosestPixelForQValue, base.setLinecuts]);

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
