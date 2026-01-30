/**
 * Health check API service.
 *
 * Provides a unified health check that tells the frontend which optional
 * services are configured and available, with live status polling.
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServiceStatus = "ok" | "error" | "not_configured";

export interface ServiceHealth {
  status: ServiceStatus;
  message?: string;
}

export interface HealthData {
  backend: ServiceHealth;
  tiled_data: ServiceHealth;
  tiled_calibration: ServiceHealth;
  tiled_results: ServiceHealth;
  checked_at: string;
}

export type OverallStatus = "ok" | "error" | "loading";

export interface HealthState {
  tiledCalibrationEnabled: boolean;
  tiledResultsEnabled: boolean;
  health: HealthData | null;
  isHealthLoading: boolean;
  refreshHealth: () => void;
  overallStatus: OverallStatus;
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function fetchHealth(): Promise<HealthData | null> {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) return null;
    return (await response.json()) as HealthData;
  } catch {
    return null;
  }
}

function deriveOverall(
  data: HealthData | null,
  hasFetched: boolean
): OverallStatus {
  if (!data) return hasFetched ? "error" : "loading";
  const services = [
    data.backend,
    data.tiled_data,
    data.tiled_calibration,
    data.tiled_results
  ];
  // "error" if any configured service has status "error"
  if (services.some((s) => s.status === "error")) return "error";
  return "ok";
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 30_000;

/**
 * Hook that checks service health on mount, polls every 30 s,
 * and exposes health data plus derived feature flags.
 */
export function useHealth(): HealthState {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const mountedRef = useRef(true);

  const doFetch = useCallback(async () => {
    setIsHealthLoading(true);
    const data = await fetchHealth();
    if (mountedRef.current) {
      setHealth(data);
      setIsHealthLoading(false);
      setHasFetched(true);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    mountedRef.current = true;
    doFetch();

    const id = setInterval(doFetch, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [doFetch]);

  const overallStatus = deriveOverall(health, hasFetched);

  return {
    tiledCalibrationEnabled: health?.tiled_calibration.status === "ok",
    tiledResultsEnabled: health?.tiled_results.status === "ok",
    health,
    isHealthLoading,
    refreshHealth: doFetch,
    overallStatus
  };
}
