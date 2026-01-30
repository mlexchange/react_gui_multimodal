import { useState, useCallback, useEffect } from "react";
import {
  AzimuthalData,
  AzimuthalIntegration,
  CalibrationParams,
  isCalibrationComplete
} from "../types";
import {
  leftImageColorPalette,
  rightImageColorPalette
} from "../utils/constants";
import {
  fetchAzimuthalIntegration,
  cancelAzimuthalRequest,
  AzimuthalIntegrationResult
} from "../services/linecutApi";

/**
 * Custom hook for managing azimuthal integration data.
 *
 * Uses shared debounce infrastructure from linecutApi.ts.
 *
 * @param calibrationParams - Calibration parameters from parent component
 * @param leftScanUri - Tiled URI for the first/left scan
 * @param rightScanUri - Tiled URI for the second/right scan
 * @param maskUri - Optional mask URI
 * @returns Functions and state for azimuthal integration
 */
export default function useAzimuthalIntegration(
  calibrationParams: CalibrationParams | null,
  leftScanUri: string | null,
  rightScanUri: string | null,
  maskUri?: string | null
) {
  // ======== STATE MANAGEMENT ========

  // Azimuthal integrations list and associated data
  const [azimuthalIntegrations, setAzimuthalIntegrations] = useState<
    AzimuthalIntegration[]
  >([]);
  const [azimuthalData1, setAzimuthalData1] = useState<AzimuthalData[]>([]);
  const [azimuthalData2, setAzimuthalData2] = useState<AzimuthalData[]>([]);

  // Loading state per integration
  const [loadingAzimuthalIntegrations, setLoadingAzimuthalIntegrations] =
    useState<Set<number>>(new Set());

  // Track whether we should use API
  const useApi =
    isCalibrationComplete(calibrationParams) && !!(leftScanUri && rightScanUri);

  // ======== UTILITY FUNCTIONS ========

  /**
   * Filters q-arrays by the specified q-range.
   * Sets values outside the range to NaN for visualization.
   */
  const filterByQRange = useCallback(
    (qArray: number[][], qRange: [number, number] | null): number[][] => {
      if (!qRange) return qArray;
      return qArray.map((row) =>
        row.map((value) =>
          value >= qRange[0] && value <= qRange[1] ? value : NaN
        )
      );
    },
    []
  );

  /**
   * Updates azimuthal integration data for both images.
   */
  const updateIntegrationData = useCallback(
    (
      id: number,
      data: {
        q1: number[];
        q2: number[];
        intensity1: number[];
        intensity2: number[];
        qArray: number[][];
      }
    ) => {
      const { q1, q2, intensity1, intensity2, qArray } = data;

      setAzimuthalData1((prev) => {
        const filtered = prev.filter((d) => d.id !== id);
        return [
          ...filtered,
          { id, q: q1, intensity: intensity1, qArray }
        ];
      });

      setAzimuthalData2((prev) => {
        const filtered = prev.filter((d) => d.id !== id);
        return [
          ...filtered,
          { id, q: q2, intensity: intensity2, qArray }
        ];
      });
    },
    []
  );

  /**
   * Fetch azimuthal integration data using shared API service.
   */
  const fetchAzimuthalData = useCallback(
    (
      id: number,
      qRange: [number, number] | null,
      azimuthRange: [number, number]
    ) => {
      if (!useApi || !calibrationParams || !leftScanUri || !rightScanUri) {
        return;
      }

      // Set loading state
      setLoadingAzimuthalIntegrations((prev) => new Set(prev).add(id));

      fetchAzimuthalIntegration(
        id,
        {
          leftScanUri,
          rightScanUri,
          calibration: calibrationParams,
          azimuthStart: azimuthRange[0],
          azimuthEnd: azimuthRange[1],
          qRangeStart: qRange ? qRange[0] : null,
          qRangeEnd: qRange ? qRange[1] : null,
          maskUri
        },
        {
          onSuccess: (result: AzimuthalIntegrationResult) => {
            if (result.success) {
              // Update integration data with filtered values
              updateIntegrationData(id, {
                q1: result.q_1,
                q2: result.q_2,
                intensity1: result.intensity_1,
                intensity2: result.intensity_2,
                qArray: filterByQRange(result.q_array_filtered, qRange)
              });
            } else {
              console.error(
                `Azimuthal integration ${id} failed:`,
                result.error_message
              );
            }

            // Clear loading state
            setLoadingAzimuthalIntegrations((prev) => {
              const updated = new Set(prev);
              updated.delete(id);
              return updated;
            });
          },
          onError: (error) => {
            console.error(`Azimuthal integration ${id} error:`, error);
            setLoadingAzimuthalIntegrations((prev) => {
              const updated = new Set(prev);
              updated.delete(id);
              return updated;
            });
          }
        }
      );
    },
    [
      useApi,
      calibrationParams,
      leftScanUri,
      rightScanUri,
      maskUri,
      filterByQRange,
      updateIntegrationData
    ]
  );

  // ======== INTEGRATION MANAGEMENT FUNCTIONS ========

  /**
   * Creates a new azimuthal integration with default parameters.
   */
  const addAzimuthalIntegration = useCallback(() => {
    const DEFAULT_AZIMUTH_RANGE: [number, number] = [-180, 180];

    const existingIds = azimuthalIntegrations.map(
      (integration) => integration.id
    );
    const newId = Math.max(0, ...existingIds) + 1;

    const newIntegration: AzimuthalIntegration = {
      id: newId,
      qRange: null,
      azimuthRange: DEFAULT_AZIMUTH_RANGE,
      leftColor:
        leftImageColorPalette[(newId - 1) % leftImageColorPalette.length],
      rightColor:
        rightImageColorPalette[(newId - 1) % rightImageColorPalette.length],
      hidden: false
    };

    setAzimuthalIntegrations((prev) => [...prev, newIntegration]);
    // Trigger data fetch (debounced via linecutApi)
    setTimeout(() => fetchAzimuthalData(newId, null, DEFAULT_AZIMUTH_RANGE), 0);
  }, [fetchAzimuthalData, azimuthalIntegrations]);

  /**
   * Updates the Q-range for a specific integration.
   * The fetch is debounced via linecutApi.
   */
  const updateAzimuthalQRange = useCallback(
    (id: number, qRange: [number, number]) => {
      setAzimuthalIntegrations((prev) =>
        prev.map((integration) =>
          integration.id === id ? { ...integration, qRange } : integration
        )
      );

      const currentIntegration = azimuthalIntegrations.find((i) => i.id === id);
      if (currentIntegration) {
        fetchAzimuthalData(
          id,
          qRange,
          currentIntegration.azimuthRange || [-180, 180]
        );
      }
    },
    [azimuthalIntegrations, fetchAzimuthalData]
  );

  /**
   * Updates the azimuth range for a specific integration.
   * The fetch is debounced via linecutApi.
   */
  const updateAzimuthalRange = useCallback(
    (id: number, azimuthRange: [number, number]) => {
      setAzimuthalIntegrations((prev) =>
        prev.map((integration) =>
          integration.id === id ? { ...integration, azimuthRange } : integration
        )
      );

      const currentIntegration = azimuthalIntegrations.find((i) => i.id === id);
      if (currentIntegration) {
        fetchAzimuthalData(id, currentIntegration.qRange, azimuthRange);
      }
    },
    [azimuthalIntegrations, fetchAzimuthalData]
  );

  /**
   * Updates the color of an integration line.
   */
  const updateAzimuthalColor = useCallback(
    (id: number, side: "left" | "right", color: string) => {
      setAzimuthalIntegrations((prev) =>
        prev.map((integration) =>
          integration.id === id
            ? { ...integration, [`${side}Color`]: color }
            : integration
        )
      );
    },
    []
  );

  /**
   * Deletes an integration and its associated data.
   */
  const deleteAzimuthalIntegration = useCallback((id: number) => {
    // Cancel any pending requests for this integration
    cancelAzimuthalRequest(id);

    // Remove the integration's data from image 1
    setAzimuthalData1((prev) =>
      prev
        .filter((data) => data.id !== id)
        .map((data, index) => ({
          ...data,
          id: index + 1
        }))
    );

    // Remove the integration's data from image 2
    setAzimuthalData2((prev) =>
      prev
        .filter((data) => data.id !== id)
        .map((data, index) => ({
          ...data,
          id: index + 1
        }))
    );

    // Update the integrations list
    setAzimuthalIntegrations((prev) => {
      const updatedIntegrations = prev.filter(
        (integration) => integration.id !== id
      );
      return updatedIntegrations.map((integration, index) => ({
        ...integration,
        id: index + 1
      }));
    });

    // Clear loading state
    setLoadingAzimuthalIntegrations((prev) => {
      const updated = new Set(prev);
      updated.delete(id);
      return updated;
    });
  }, []);

  /**
   * Toggles visibility of an integration.
   */
  const toggleAzimuthalVisibility = useCallback((id: number) => {
    setAzimuthalIntegrations((prev) =>
      prev.map((integration) =>
        integration.id === id
          ? { ...integration, hidden: !integration.hidden }
          : integration
      )
    );
  }, []);

  /**
   * Restore integrations from a saved session.
   */
  const restoreIntegrations = useCallback(
    (integrations: AzimuthalIntegration[]) => {
      setAzimuthalIntegrations(integrations);
      setAzimuthalData1([]);
      setAzimuthalData2([]);
    },
    []
  );

  /**
   * Refetch all integration data when context changes.
   * Note: Intentionally excludes fetchAzimuthalData, azimuthalIntegrations, and useApi
   * from deps to prevent infinite loops - we only want to refetch when external
   * context (URIs, calibration) changes, not when callbacks or integrations change.
   */
  useEffect(() => {
    if (!useApi || azimuthalIntegrations.length === 0) return;

    // Refetch data for all integrations when scan URIs or calibration changes
    azimuthalIntegrations.forEach((integration) => {
      fetchAzimuthalData(
        integration.id,
        integration.qRange,
        integration.azimuthRange
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftScanUri, rightScanUri, calibrationParams, maskUri]);

  return {
    // State
    azimuthalIntegrations,
    azimuthalData1,
    azimuthalData2,
    loadingAzimuthalIntegrations,

    // Functions
    addAzimuthalIntegration,
    updateAzimuthalQRange,
    updateAzimuthalRange,
    updateAzimuthalColor,
    deleteAzimuthalIntegration,
    toggleAzimuthalVisibility,
    restoreIntegrations
  };
}
