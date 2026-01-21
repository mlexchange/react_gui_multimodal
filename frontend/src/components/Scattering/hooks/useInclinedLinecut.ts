/**
 * Hook for managing inclined linecuts in q-space.
 * Uses the generic useLinecutBase factory for common functionality.
 */
import { useCallback } from "react";
import { InclinedLinecut, InclinedLinecutData } from "../types";
import {
  fetchInclinedLinecut,
  cancelLinecutRequest
} from "../services/linecutApi";
import { useLinecutBase, UseLinecutBaseProps } from "./useLinecutBase";
import { useThrottledCallback } from "./useThrottledCallback";

// ============================================================================
// Types
// ============================================================================

export type UseInclinedLinecutProps = UseLinecutBaseProps;

// ============================================================================
// Hook
// ============================================================================

export default function useInclinedLinecut({
  leftScanUri,
  rightScanUri,
  calibrationParams,
  experimentType,
  maskUri
}: UseInclinedLinecutProps) {
  // =========================================================================
  // Configuration for base hook
  // =========================================================================

  const createDefaultLinecut = useCallback((id: number): InclinedLinecut => {
    return {
      id,
      qXPosition: 0,
      qYPosition: 0,
      angle: 45,
      qWidth: 0,
      width: 0,
      leftColor: "",
      rightColor: "",
      hidden: false,
      type: "inclined"
    };
  }, []);

  const getLinecutParams = useCallback((linecut: InclinedLinecut) => {
    return {
      qXPosition: linecut.qXPosition,
      qYPosition: linecut.qYPosition,
      angle: linecut.angle,
      qWidth: linecut.qWidth
    };
  }, []);

  const transformResult = useCallback(
    (result: {
      q_values: number[];
      intensities: number[];
    }): InclinedLinecutData => {
      return {
        pathDistances: result.q_values,
        intensities: result.intensities
      };
    },
    []
  );

  // =========================================================================
  // Use base hook
  // =========================================================================

  const base = useLinecutBase<InclinedLinecut, InclinedLinecutData>(
    { leftScanUri, rightScanUri, calibrationParams, experimentType, maskUri },
    {
      linecutType: "inclined",
      createDefaultLinecut,
      getLinecutParams,
      transformResult,
      fetchLinecut: fetchInclinedLinecut,
      cancelRequest: cancelLinecutRequest
    }
  );

  // =========================================================================
  // Inclined-specific: angle and width updates
  // =========================================================================

  const updateInclinedLinecutAngle = useThrottledCallback(
    (id: number, angle: number) => {
      const normalizedAngle = (((angle % 360) + 540) % 360) - 180;

      base.setLinecuts((prev) => {
        const updated = prev.map((linecut) =>
          linecut.id === id ? { ...linecut, angle: normalizedAngle } : linecut
        );

        const updatedLinecut = updated.find((l) => l.id === id);
        if (updatedLinecut && base.useApi) {
          base.fetchLinecutData(updatedLinecut);
        }

        return updated;
      });
    },
    200
  );

  const updateInclinedLinecutWidth = useThrottledCallback(
    (id: number, qWidth: number) => {
      base.setLinecuts((prev) => {
        const updated = prev.map((linecut) =>
          linecut.id === id ? { ...linecut, qWidth } : linecut
        );

        const updatedLinecut = updated.find((l) => l.id === id);
        if (updatedLinecut && base.useApi) {
          base.fetchLinecutData(updatedLinecut);
        }

        return updated;
      });
    },
    200
  );

  // =========================================================================
  // Return with inclined-specific naming
  // =========================================================================

  return {
    inclinedLinecuts: base.linecuts,
    leftLinecutData: base.leftLinecutData,
    rightLinecutData: base.rightLinecutData,
    loadingInclinedLinecuts: base.loadingLinecuts,
    useApi: base.useApi,
    addInclinedLinecut: base.addLinecut,
    updateInclinedLinecutAngle,
    updateInclinedLinecutWidth,
    updateInclinedLinecutColor: base.updateColor,
    deleteInclinedLinecut: base.deleteLinecut,
    toggleInclinedLinecutVisibility: base.toggleVisibility,
    restoreLinecuts: base.restoreLinecuts
  };
}
