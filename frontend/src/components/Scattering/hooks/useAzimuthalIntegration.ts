import { useState, useCallback, useRef, useEffect } from 'react';
import { debounce } from 'lodash';
import { decode } from "@msgpack/msgpack";
import { AzimuthalData, AzimuthalIntegration, CalibrationParams } from '../types';
import { leftImageColorPalette, rightImageColorPalette } from '../utils/constants';

/**
 * Response type for azimuthal integration data
 * This contains the core integration results
 */
interface AzimuthalIntegratorResponse {
    q_max: number;         // Maximum q-value
    q_1: number[];         // q-values for first integration
    q_2: number[];         // q-values for second integration
    intensity_1: number[]; // Intensity values for first integration
    intensity_2: number[]; // Intensity values for second integration
    q_array_filtered_1: number[][]; // 2D array of filtered q-values for visualization (img 1)
    q_array_filtered_2: number[][]; // 2D array of filtered q-values for visualization (img 2)
}

/**
 * Our cache structure to prevent unnecessary API calls
 * Note: This is separate from what the server sends
 */
interface CachedMatrixData {
    qArray1: number[][];       // 2D array for image 1 visualization
    qArray2: number[][];       // 2D array for image 2 visualization
    calibrationHash: string;   // Hash of calibration + azimuth for cache validation
    azimuthRange: [number, number]; // Current azimuth range
    intensityData1: number[];  // Intensity values for first integration
    intensityData2: number[];  // Intensity values for second integration
    qValues1: number[];        // q-values for first integration
    qValues2: number[];        // q-values for second integration
}

/**
 * Type guard to validate azimuthal integration response
 * Ensures the response has the expected structure
 */
function isAzimuthalIntegratorResponse(value: unknown): value is AzimuthalIntegratorResponse {
    const response = value as AzimuthalIntegratorResponse;
    return (
        typeof response === 'object' &&
        response !== null &&
        typeof response.q_max === 'number' &&
        Array.isArray(response.q_1) &&
        Array.isArray(response.q_2) &&
        Array.isArray(response.intensity_1) &&
        Array.isArray(response.intensity_2) &&
        Array.isArray(response.q_array_filtered_1) &&
        Array.isArray(response.q_array_filtered_2)
    );
}

/**
 * Custom hook for managing azimuthal integration data
 * Now accepts calibration parameters and q-vectors from parent
 *
 * @param calibrationParams - Calibration parameters from parent component
 * @returns Functions and state for azimuthal integration
 */
export default function useAzimuthalIntegration(calibrationParams: CalibrationParams) {
    // ======== STATE MANAGEMENT ========

    // Azimuthal integrations list and associated data
    const [azimuthalIntegrations, setAzimuthalIntegrations] = useState<AzimuthalIntegration[]>([]);
    const [azimuthalData1, setAzimuthalData1] = useState<AzimuthalData[]>([]);
    const [azimuthalData2, setAzimuthalData2] = useState<AzimuthalData[]>([]);

    // Q-range, azimuth range, and max Q value
    const [maxQValue, setMaxQValue] = useState<number>(2);
    const [globalQRange, setGlobalQRange] = useState<[number, number] | null>(null);

    // Cache for repeated API calls
    const [cachedMatrixData, setCachedMatrixData] = useState<CachedMatrixData | null>(null);

    const [isProcessing, setIsProcessing] = useState<boolean>(false);


    // ======== UTILITY FUNCTIONS ========

    /**
     * Creates a cache key from calibration params and azimuth range
     * Used to determine if we need to fetch new data
     */
    const createCacheKey = useCallback((params: CalibrationParams, azimuthRange: [number, number]): string => {
        return JSON.stringify({ calibration: params, azimuth: azimuthRange });
    }, []);

    /**
     * Filters q-arrays by the specified q-range
     * Sets values outside the range to NaN for visualization
     */
    const filterByQRange = useCallback((
        qArray: number[][],
        qRange: [number, number] | null
    ): number[][] => {
        if (!qRange) return qArray;
        return qArray.map(row =>
            row.map(value =>
                (value >= qRange[0] && value <= qRange[1]) ? value : NaN
            )
        );
    }, []);

    /**
     * Updates azimuthal integration data for both images
     * Handles adding or replacing data by ID
     */
    const updateIntegrationData = useCallback((
        id: number,
        data: {
            q1: number[],
            q2: number[],
            intensity1: number[],
            intensity2: number[],
            qArray1: number[][],
            qArray2: number[][]
        }
    ) => {
        const { q1, q2, intensity1, intensity2, qArray1, qArray2 } = data;

        // Update data for image 1
        setAzimuthalData1(prev => {
            const filtered = prev.filter(d => d.id !== id);
            return [...filtered, {
                id,
                q: q1,
                intensity: intensity1,
                qArray: qArray1
            }];
        });

        // Update data for image 2
        setAzimuthalData2(prev => {
            const filtered = prev.filter(d => d.id !== id);
            return [...filtered, {
                id,
                q: q2,
                intensity: intensity2,
                qArray: qArray2
            }];
        });
    }, []);

    /**
     * Main data fetching function
     * Fetches azimuthal integration data
     */
    const fetchAzimuthalData = useCallback(async (
        id: number,
        qRange: [number, number] | null,
        azimuthRange: [number, number]
    ) => {

        // Set loading state
        setIsProcessing(true);

        // Generate a unique key for caching based on current parameters
        const currentCacheKey = createCacheKey(calibrationParams, azimuthRange);

        try {
            // Determine if we need new data by checking cache validity
            const needsNewData = !cachedMatrixData ||
                               currentCacheKey !== cachedMatrixData.calibrationHash ||
                               azimuthRange !== cachedMatrixData.azimuthRange;

            console.log('Need to fetch new data:', needsNewData);

            if (needsNewData) {
                // Create a URL for the azimuthal integrator endpoint
                const url = new URL('/api/azimuthal-integrator', window.location.origin);

                // Add all calibration parameters to the URL
                Object.entries(calibrationParams).forEach(([key, value]) => {
                    url.searchParams.set(key, value.toString());
                });

                // Add azimuth range to the parameters
                url.searchParams.set('azimuth_range_deg', `${azimuthRange[0]},${azimuthRange[1]}`);

                // Fetch azimuthal integration data
                const response = await fetch(url.toString());

                // Check for HTTP errors
                if (!response.ok) {
                    throw new Error(`Failed to fetch azimuthal integration data: ${await response.text()}`);
                }

                // Decode the binary msgpack response
                const decodedData = decode(new Uint8Array(await response.arrayBuffer()));

                // Validate the response format
                if (!isAzimuthalIntegratorResponse(decodedData)) {
                    throw new Error('Invalid azimuthal integrator response format from server');
                }

                // Store fetched data in cache
                setCachedMatrixData({
                    qArray1: decodedData.q_array_filtered_1,
                    qArray2: decodedData.q_array_filtered_2,
                    calibrationHash: currentCacheKey,
                    azimuthRange,
                    intensityData1: decodedData.intensity_1,
                    intensityData2: decodedData.intensity_2,
                    qValues1: decodedData.q_1,
                    qValues2: decodedData.q_2
                });

                // Update max Q value if needed (first fetch only)
                if (maxQValue === 2) {
                    setMaxQValue(decodedData.q_max);
                    setGlobalQRange([0, decodedData.q_max]);
                }

                // Update integration data with filtered values
                updateIntegrationData(id, {
                    q1: decodedData.q_1,
                    q2: decodedData.q_2,
                    intensity1: decodedData.intensity_1,
                    intensity2: decodedData.intensity_2,
                    qArray1: filterByQRange(decodedData.q_array_filtered_1, qRange),
                    qArray2: filterByQRange(decodedData.q_array_filtered_2, qRange)
                });
            } else {
                // Use cached data if available
                updateIntegrationData(id, {
                    q1: cachedMatrixData.qValues1,
                    q2: cachedMatrixData.qValues2,
                    intensity1: cachedMatrixData.intensityData1,
                    intensity2: cachedMatrixData.intensityData2,
                    qArray1: filterByQRange(cachedMatrixData.qArray1, qRange),
                    qArray2: filterByQRange(cachedMatrixData.qArray2, qRange)
                });
            }
        } catch (error) {
            console.error('Error in azimuthal integration:', error);
            throw error;
        } finally {
            // Reset loading state
            setIsProcessing(false);
        }
    }, [
        calibrationParams,
        cachedMatrixData,
        createCacheKey,
        filterByQRange,
        maxQValue,
        updateIntegrationData
    ]);

    // ======== DEBOUNCED FUNCTIONS ========

    /**
     * Debounced version of Q-range update
     * Prevents excessive API calls during slider movement
     */
    const debouncedQRangeUpdate = useRef(
        debounce((params: {
            id: number,
            qRange: [number, number],
            azimuthRange: [number, number],
            setGlobalQRange: typeof setGlobalQRange,
            setAzimuthalIntegrations: typeof setAzimuthalIntegrations,
            fetchAzimuthalData: typeof fetchAzimuthalData
        }) => {
            const { id, qRange, azimuthRange, setGlobalQRange, setAzimuthalIntegrations, fetchAzimuthalData } = params;
            setGlobalQRange(qRange);
            setAzimuthalIntegrations(prev =>
                prev.map(integration =>
                    integration.id === id ? { ...integration, qRange } : integration
                )
            );
            fetchAzimuthalData(id, qRange, azimuthRange);
        }, 100) // 100ms debounce time
    ).current;

    /**
     * Debounced version of azimuth range update
     * Prevents excessive API calls during slider movement
     */
    const debouncedAzimuthRangeUpdate = useRef(
        debounce((params: {
            id: number,
            qRange: [number, number] | null,
            azimuthRange: [number, number],
            // setGlobalAzimuthRange: typeof setGlobalAzimuthRange,
            setAzimuthalIntegrations: typeof setAzimuthalIntegrations,
            fetchAzimuthalData: typeof fetchAzimuthalData
        }) => {
            const { id, qRange, azimuthRange, setAzimuthalIntegrations, fetchAzimuthalData } = params;


            // setGlobalAzimuthRange(azimuthRange);
            setAzimuthalIntegrations(prev =>
                prev.map(integration =>
                    integration.id === id ? { ...integration, azimuthRange } : integration
                )
            );
            fetchAzimuthalData(id, qRange, azimuthRange);
        }, 500) // 500ms debounce time (longer for azimuth since it triggers API calls)
    ).current;

    // Cleanup debounced functions on unmount
    useEffect(() => {
        return () => {
            debouncedQRangeUpdate.cancel();
            debouncedAzimuthRangeUpdate.cancel();
        };
    }, [debouncedQRangeUpdate, debouncedAzimuthRangeUpdate]);

    // ======== INTEGRATION MANAGEMENT FUNCTIONS ========

    /**
     * Creates a new azimuthal integration with default parameters
     */
    const addAzimuthalIntegration = useCallback(() => {
        const DEFAULT_AZIMUTH_RANGE: [number, number] = [-180, 180];

        // Get next available ID
        const existingIds = azimuthalIntegrations.map(integration => integration.id);
        const newId = Math.max(0, ...existingIds) + 1;

        // Create new integration object
        const newIntegration: AzimuthalIntegration = {
            id: newId,
            qRange: null,
            azimuthRange: DEFAULT_AZIMUTH_RANGE,
            leftColor: leftImageColorPalette[(newId - 1) % leftImageColorPalette.length],
            rightColor: rightImageColorPalette[(newId - 1) % rightImageColorPalette.length],
            hidden: false
        };

        // Add to state and trigger data fetch
        setAzimuthalIntegrations(prev => [...prev, newIntegration]);
        fetchAzimuthalData(newId, globalQRange, DEFAULT_AZIMUTH_RANGE);
    }, [fetchAzimuthalData, azimuthalIntegrations, globalQRange]);

    /**
     * Updates the Q-range for a specific integration
     */
    const updateAzimuthalQRange = useCallback((id: number, qRange: [number, number]) => {
        const currentIntegration = azimuthalIntegrations.find(i => i.id === id);
        if (currentIntegration) {
            debouncedQRangeUpdate({
                id,
                qRange,
                azimuthRange: currentIntegration.azimuthRange || [-180, 180],
                setGlobalQRange,
                setAzimuthalIntegrations,
                fetchAzimuthalData
            });
        }
    }, [azimuthalIntegrations, fetchAzimuthalData, debouncedQRangeUpdate]);

    /**
     * Updates the azimuth range for a specific integration
     */
    const updateAzimuthalRange = useCallback((id: number, azimuthRange: [number, number]) => {
        const currentIntegration = azimuthalIntegrations.find(i => i.id === id);
        if (currentIntegration) {
            debouncedAzimuthRangeUpdate({
                id,
                qRange: currentIntegration.qRange,
                azimuthRange,
                // setGlobalAzimuthRange,
                setAzimuthalIntegrations,
                fetchAzimuthalData
            });
        }
    }, [azimuthalIntegrations, fetchAzimuthalData, debouncedAzimuthRangeUpdate]);

    /**
     * Updates the color of an integration line
     */
    const updateAzimuthalColor = useCallback((id: number, side: 'left' | 'right', color: string) => {
        setAzimuthalIntegrations(prev =>
            prev.map(integration =>
                integration.id === id
                    ? { ...integration, [`${side}Color`]: color }
                    : integration
            )
        );
    }, []);

    /**
     * Deletes an integration and its associated data
     */
    const deleteAzimuthalIntegration = useCallback((id: number) => {
        // Clear the cached matrix data to ensure fresh fetch for next integration
        setCachedMatrixData(null);

        // Remove the integration's data from image 1
        setAzimuthalData1(prev =>
            prev.filter(data => data.id !== id).map((data, index) => ({
                ...data,
                id: index + 1, // Reindex remaining integrations
            }))
        );

        // Remove the integration's data from image 2
        setAzimuthalData2(prev =>
            prev.filter(data => data.id !== id).map((data, index) => ({
                ...data,
                id: index + 1, // Reindex remaining integrations
            }))
        );

        // Update the integrations list
        setAzimuthalIntegrations(prev => {
            const updatedIntegrations = prev.filter(integration => integration.id !== id);
            return updatedIntegrations.map((integration, index) => ({
                ...integration,
                id: index + 1, // Reindex remaining integrations
            }));
        });
    }, []);

    /**
     * Toggles visibility of an integration
     */
    const toggleAzimuthalVisibility = useCallback((id: number) => {
        setAzimuthalIntegrations(prev =>
            prev.map(integration =>
                integration.id === id ? { ...integration, hidden: !integration.hidden } : integration
            )
        );
    }, []);


    return {
        // State
        azimuthalIntegrations,
        azimuthalData1,
        azimuthalData2,
        maxQValue,
        globalQRange,
        isProcessing,

        // Functions
        addAzimuthalIntegration,
        updateAzimuthalQRange,
        updateAzimuthalRange,
        updateAzimuthalColor,
        deleteAzimuthalIntegration,
        toggleAzimuthalVisibility,
    };
}
