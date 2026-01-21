/**
 * Generic linecut hook factory.
 * Eliminates code duplication across horizontal, vertical, and inclined linecut hooks.
 */
import { useCallback, useState, useEffect, useRef } from "react";
import { CalibrationParams, isCalibrationComplete, LinecutResult } from "../types";
import {
  leftImageColorPalette,
  rightImageColorPalette
} from "../utils/constants";
import { throttle } from "lodash";
import {
  renumberItems,
  renumberMapKeys,
  addToLoadingSet,
  removeFromLoadingSet,
  generateNextId
} from "../utils/stateHelpers";

// ============================================================================
// Types
// ============================================================================

/** Base linecut interface - all linecut types must have these fields */
export interface BaseLinecut {
  id: number;
  leftColor: string;
  rightColor: string;
  hidden: boolean;
}

/** Common props for all linecut hooks */
export interface UseLinecutBaseProps {
  leftScanUri: string | null;
  rightScanUri: string | null;
  calibrationParams: CalibrationParams | null;
  experimentType: string;
  maskUri?: string | null;
}

/** Fetch function signature - uses generic params to match various API signatures */
export type FetchLinecutFn = (
  linecutId: number,
  side: "left" | "right",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any,
  callbacks: {
    onSuccess: (result: LinecutResult) => void;
    onError?: (error: Error) => void;
  }
) => void;

/** Cancel request function signature */
export type CancelRequestFn = (
  linecutType: "horizontal" | "vertical" | "inclined",
  linecutId: number,
  side: "left" | "right"
) => void;

/** Configuration for the linecut hook factory */
export interface LinecutHookConfig<TLinecut extends BaseLinecut, TData> {
  /** Linecut type identifier for logging and request cancellation */
  linecutType: "horizontal" | "vertical" | "inclined";

  /** Function to create a new linecut with default values */
  createDefaultLinecut: (id: number) => TLinecut;

  /** Function to extract API parameters from a linecut */
  getLinecutParams: (linecut: TLinecut) => Record<string, unknown>;

  /** Function to transform API result to data format */
  transformResult: (result: LinecutResult) => TData;

  /** API fetch function */
  fetchLinecut: FetchLinecutFn;

  /** API cancel function */
  cancelRequest: CancelRequestFn;
}

/** Return type for the base hook */
export interface UseLinecutBaseReturn<TLinecut extends BaseLinecut, TData> {
  linecuts: TLinecut[];
  setLinecuts: React.Dispatch<React.SetStateAction<TLinecut[]>>;
  leftLinecutData: Map<number, TData>;
  rightLinecutData: Map<number, TData>;
  setLeftLinecutData: React.Dispatch<React.SetStateAction<Map<number, TData>>>;
  setRightLinecutData: React.Dispatch<React.SetStateAction<Map<number, TData>>>;
  loadingLinecuts: Set<number>;
  setLoadingLinecuts: React.Dispatch<React.SetStateAction<Set<number>>>;
  useApi: boolean;
  fetchLinecutData: (linecut: TLinecut) => void;
  addLinecut: () => void;
  deleteLinecut: (id: number) => void;
  toggleVisibility: (id: number) => void;
  updateColor: (id: number, side: "left" | "right", color: string) => void;
  restoreLinecuts: (linecuts: TLinecut[]) => void;
}

// ============================================================================
// Hook Factory
// ============================================================================

/**
 * Creates a linecut management hook with the given configuration.
 * Handles common patterns: state management, API fetching, CRUD operations.
 */
export function useLinecutBase<TLinecut extends BaseLinecut, TData>(
  props: UseLinecutBaseProps,
  config: LinecutHookConfig<TLinecut, TData>
): UseLinecutBaseReturn<TLinecut, TData> {
  const {
    leftScanUri,
    rightScanUri,
    calibrationParams,
    experimentType,
    maskUri
  } = props;

  const {
    linecutType,
    createDefaultLinecut,
    getLinecutParams,
    transformResult,
    fetchLinecut,
    cancelRequest
  } = config;

  // =========================================================================
  // State
  // =========================================================================

  const [linecuts, setLinecuts] = useState<TLinecut[]>([]);
  const [leftLinecutData, setLeftLinecutData] = useState<Map<number, TData>>(
    new Map()
  );
  const [rightLinecutData, setRightLinecutData] = useState<Map<number, TData>>(
    new Map()
  );
  const [loadingLinecuts, setLoadingLinecuts] = useState<Set<number>>(
    new Set()
  );

  // Check if API can be used
  const useApi =
    isCalibrationComplete(calibrationParams) && !!(leftScanUri || rightScanUri);

  // Ref to track latest linecuts for callbacks
  const linecutsRef = useRef(linecuts);
  linecutsRef.current = linecuts;

  // =========================================================================
  // Fetch Data
  // =========================================================================

  const fetchLinecutData = useCallback(
    (linecut: TLinecut) => {
      if (!useApi || !calibrationParams) return;

      setLoadingLinecuts((prev) => addToLoadingSet(prev, linecut.id));

      const linecutParams = getLinecutParams(linecut);
      const commonParams = {
        calibration: calibrationParams,
        experimentType,
        maskUri,
        ...linecutParams
      };

      // Fetch for left scan
      if (leftScanUri) {
        fetchLinecut(
          linecut.id,
          "left",
          { ...commonParams, scanUri: leftScanUri },
          {
            onSuccess: (result: LinecutResult) => {
              if (result.success) {
                setLeftLinecutData((prev) => {
                  const updated = new Map(prev);
                  updated.set(linecut.id, transformResult(result));
                  return updated;
                });
              }
              // Clear loading state (partially - wait for both if right scan exists)
              if (!rightScanUri) {
                setLoadingLinecuts((prev) =>
                  removeFromLoadingSet(prev, linecut.id)
                );
              }
            },
            onError: (error) => {
              console.error(
                `[${linecutType} ${linecut.id}] Left fetch error:`,
                error
              );
              setLoadingLinecuts((prev) =>
                removeFromLoadingSet(prev, linecut.id)
              );
            }
          }
        );
      }

      // Fetch for right scan
      if (rightScanUri) {
        fetchLinecut(
          linecut.id,
          "right",
          { ...commonParams, scanUri: rightScanUri },
          {
            onSuccess: (result: LinecutResult) => {
              if (result.success) {
                setRightLinecutData((prev) => {
                  const updated = new Map(prev);
                  updated.set(linecut.id, transformResult(result));
                  return updated;
                });
              }
              setLoadingLinecuts((prev) =>
                removeFromLoadingSet(prev, linecut.id)
              );
            },
            onError: (error) => {
              console.error(
                `[${linecutType} ${linecut.id}] Right fetch error:`,
                error
              );
              setLoadingLinecuts((prev) =>
                removeFromLoadingSet(prev, linecut.id)
              );
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
      maskUri,
      linecutType,
      getLinecutParams,
      transformResult,
      fetchLinecut
    ]
  );

  // =========================================================================
  // CRUD Operations
  // =========================================================================

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const addLinecut = useCallback(
    throttle(() => {
      const newId = generateNextId(linecuts);

      const newLinecut: TLinecut = {
        ...createDefaultLinecut(newId),
        leftColor:
          leftImageColorPalette[(newId - 1) % leftImageColorPalette.length],
        rightColor:
          rightImageColorPalette[(newId - 1) % rightImageColorPalette.length]
      };

      setLinecuts((prev) => [...prev, newLinecut]);

      // Trigger API fetch after state update
      setTimeout(() => {
        if (useApi) {
          fetchLinecutData(newLinecut);
        }
      }, 0);
    }, 200),
    [linecuts, createDefaultLinecut, useApi, fetchLinecutData]
  );

  const deleteLinecut = useCallback(
    (id: number) => {
      cancelRequest(linecutType, id, "left");
      cancelRequest(linecutType, id, "right");

      setLinecuts((prev) => renumberItems(prev, id));
      setLeftLinecutData((prev) => renumberMapKeys(prev, id));
      setRightLinecutData((prev) => renumberMapKeys(prev, id));
      setLoadingLinecuts((prev) => removeFromLoadingSet(prev, id));
    },
    [linecutType, cancelRequest]
  );

  const toggleVisibility = useCallback((id: number) => {
    setLinecuts((prev) =>
      prev.map((linecut) =>
        linecut.id === id ? { ...linecut, hidden: !linecut.hidden } : linecut
      )
    );
  }, []);

  const updateColor = useCallback(
    (id: number, side: "left" | "right", color: string) => {
      setLinecuts((prev) =>
        prev.map((linecut) =>
          linecut.id === id
            ? { ...linecut, [`${side}Color`]: color }
            : linecut
        )
      );
    },
    []
  );

  const restoreLinecuts = useCallback((savedLinecuts: TLinecut[]) => {
    setLinecuts(savedLinecuts);
    setLeftLinecutData(new Map());
    setRightLinecutData(new Map());
  }, []);

  // =========================================================================
  // Effects
  // =========================================================================

  /**
   * Refetch all linecut data when context changes.
   * Note: Intentionally excludes some deps to prevent infinite loops.
   */
  useEffect(() => {
    if (!useApi || linecuts.length === 0) return;

    linecuts.forEach((linecut) => {
      fetchLinecutData(linecut);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftScanUri, rightScanUri, calibrationParams, experimentType, maskUri]);

  // =========================================================================
  // Return
  // =========================================================================

  return {
    linecuts,
    setLinecuts,
    leftLinecutData,
    rightLinecutData,
    setLeftLinecutData,
    setRightLinecutData,
    loadingLinecuts,
    setLoadingLinecuts,
    useApi,
    fetchLinecutData,
    addLinecut,
    deleteLinecut,
    toggleVisibility,
    updateColor,
    restoreLinecuts
  };
}
