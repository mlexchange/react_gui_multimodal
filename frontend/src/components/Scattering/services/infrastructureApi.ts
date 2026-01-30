/**
 * Infrastructure API service.
 *
 * Provides a unified feature/capability check that tells the frontend
 * which optional services are configured and available.
 */

import { useState, useEffect } from "react";

export interface InfrastructureState {
  tiledCalibrationEnabled: boolean;
  tiledResultsEnabled: boolean;
}

const DEFAULT_STATE: InfrastructureState = {
  tiledCalibrationEnabled: false,
  tiledResultsEnabled: false
};

/**
 * Fetch infrastructure feature flags from the backend.
 */
export async function checkInfrastructure(): Promise<InfrastructureState> {
  try {
    const response = await fetch("/api/infrastructure");
    if (!response.ok) return DEFAULT_STATE;
    const data = await response.json();
    return {
      tiledCalibrationEnabled: data.tiled_calibration_enabled ?? false,
      tiledResultsEnabled: data.tiled_results_enabled ?? false
    };
  } catch {
    return DEFAULT_STATE;
  }
}

/**
 * Hook that checks once on mount which infrastructure features are available.
 * Returns defaults (all disabled) on any failure (graceful degradation).
 */
export function useInfrastructure(): InfrastructureState {
  const [state, setState] = useState<InfrastructureState>(DEFAULT_STATE);

  useEffect(() => {
    let cancelled = false;
    checkInfrastructure().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
