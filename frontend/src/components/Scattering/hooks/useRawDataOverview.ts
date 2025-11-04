import { useState, useCallback, useEffect, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import { decode } from "@msgpack/msgpack";
import { DisplayOption } from '../RawDataOverviewAccordion';

interface RawDataOverview {
    max_intensities: number[];
    avg_intensities: number[];
    image_names: string[];
    scan_uris: string[];
}

interface ProgressUpdate {
    progress: number;
    message: string;
}

interface TiledItemLinks {
    self: string;
    full?: string;
    block?: string;
    buffers?: string;
    partition?: string;
    search?: string;
    default?: string;
}

export default function useRawDataOverview() {
    // State for the left image index with initial value of empty string
    const [leftImageIndex, setLeftImageIndex] = useState<number | "">("");

    // State for the right image index with initial value of empty string
    const [rightImageIndex, setRightImageIndex] = useState<number | "">("");

    // State for storing the selected Tiled folder URL
    const [selectedFolderUrl, setSelectedFolderUrl] = useState<string | null>(null);

    // // State for tracking loading status
    // const [isLoading, setIsLoading] = useState(false);

    // Separate state for tracking data fetching vs image selection
    const [isFetchingData, setIsFetchingData] = useState(false);
    const [isLoadingImages, setIsLoadingImages] = useState(false);

    // State for storing the total number of files
    const [numOfFiles, setNumOfFiles] = useState<number | null>(null);

    const [displayOption, setDisplayOption] = useState<DisplayOption>('both');

    // New state for spectrum data
    const [spectrumData, setSpectrumData] = useState<RawDataOverview>({
        max_intensities: [],
        avg_intensities: [],
        image_names: [],
        scan_uris: []
    });

    // Progress state for data fetching
    const [progress, setProgress] = useState<ProgressUpdate>({
        progress: 0,
        message: ''
    });

    // WebSocket connection
    const webSocketRef = useRef<WebSocket | null>(null);

    // Setup WebSocket connection
    useEffect(() => {
        // Create WebSocket connection
        // const websocket = new WebSocket('ws://127.0.0.1:8000/ws/progress');
        // Instead of hardcoding the WebSocket URL, use a relative URL or determine it dynamically
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = process.env.NODE_ENV === 'production'
            ? `${protocol}//${window.location.host}/ws/progress`  // For production
            : 'ws://127.0.0.1:8000/ws/progress';  // For development

        const websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
            console.log('WebSocket connection established');
        };

        websocket.onmessage = (event) => {
            try {
                // First check if this is a plain text pong message
                if (event.data === "pong") {
                    console.log("Received pong from server");
                    return;
                }

                // Try to parse as JSON for progress updates
                const data = JSON.parse(event.data);
                setProgress({
                    progress: data.progress,
                    message: data.message
                });
            } catch (error) {
                // If it's not valid JSON, just log the error and continue
                console.error('Error parsing WebSocket message:', error);
                console.log('Raw message received:', event.data);
            }
        };

        websocket.onclose = () => {
            console.log('WebSocket connection closed');
        };

        websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        webSocketRef.current = websocket;

        // Ping to keep connection alive
        const pingInterval = setInterval(() => {
            if (websocket.readyState === WebSocket.OPEN) {
                websocket.send('ping');
            }
        }, 30000); // 30 seconds

        // Cleanup on component unmount
        return () => {
            clearInterval(pingInterval);
            if (websocket.readyState === WebSocket.OPEN) {
                websocket.close();
            }
        };
    }, []);

    // Function to fetch spectrum data from the backend
    const fetchSpectrumData = useCallback(async (folderUrl?: string) => {
        try {
            setIsFetchingData(true);
            // setIsLoading(true);

            // Reset progress
            setProgress({
                progress: 0,
                message: 'Initializing...'
            });

            notifications.show({
                id: 'loading-spectrum',
                loading: true,
                title: 'Loading Spectrum Data',
                message: 'Please wait while we fetch the spectrum data...',
                autoClose: false,
            });

            // Build URL with folder_url parameter
            if (!folderUrl) {
                throw new Error('Folder URL is required');
            }

            const url = new URL('/api/raw-data-overview', window.location.origin);
            url.searchParams.append('folder_url', folderUrl);

            const response = await fetch(url.toString());

            if (!response.ok) {
                throw new Error(`Failed to fetch spectrum data: ${response.statusText}`);
            }

            // Assuming the response is in MessagePack format
            const buffer = await response.arrayBuffer();
            const decoded = decode(new Uint8Array(buffer)) as any;

            // Set number of scans
            const numScans = decoded.num_scans || 0;
            setNumOfFiles(numScans);

            // Update spectrum data
            setSpectrumData({
                max_intensities: decoded.max_intensities || [],
                avg_intensities: decoded.avg_intensities || [],
                image_names: decoded.scan_names || [],
                scan_uris: decoded.scan_uris || []
            });

            // Auto-select first two scans if we have at least 2
            if (numScans >= 2) {
                setLeftImageIndex(0);
                setRightImageIndex(1);
            } else if (numScans === 1) {
                // If only one scan, select it for both
                setLeftImageIndex(0);
                setRightImageIndex(0);
            }

            // Set progress to 100% when done
            setProgress({
                progress: 100,
                message: 'Data loading complete!'
            });

            notifications.update({
                id: 'loading-spectrum',
                color: 'green',
                title: 'Spectrum Data Loaded',
                message: 'Successfully loaded scatter spectrum data',
                autoClose: 3000,
            });
        } catch (error) {
            let errorMessage = 'Failed to fetch spectrum data';
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            console.error('Error fetching scatter spectrum:', error);

            // Reset progress on error
            setProgress({
                progress: 0,
                message: ''
            });

            notifications.update({
                id: 'loading-spectrum',
                color: 'red',
                title: 'Error Loading Spectrum Data',
                message: errorMessage,
                autoClose: 5000,
            });
        } finally {
            setIsFetchingData(false);
            // setIsLoading(false);
        }
    }, []);

    // Handler for image indices change
    const handleImageIndicesChange = useCallback((left: number | "", right: number | "") => {

        // Store the new indices
        setLeftImageIndex(left);
        setRightImageIndex(right);

        // Only show loading notification if both indices are valid numbers
        if (typeof left === 'number' && typeof right === 'number') {
            // Set loading state for images specifically
            setIsLoadingImages(true);
            // setIsLoading(true);

            // Only show notification for significant changes (not from context menu clicks)
            notifications.show({
                id: 'loading-images',
                loading: true,
                title: 'Loading Images',
                message: `Loading images ${left} and ${right}...`,
                autoClose: false,
            });
        }
    }, []);

    // Handler for Tiled folder selection
    const handleTiledSelection = useCallback((links: TiledItemLinks) => {
        console.log('Tiled folder selected:', links);

        // Store the folder URL
        setSelectedFolderUrl(links.self);

        // Trigger data fetch with the folder URL
        fetchSpectrumData(links.self);
    }, [fetchSpectrumData]);


    return {
        // State
        leftImageIndex,
        setLeftImageIndex,
        rightImageIndex,
        setRightImageIndex,
        selectedFolderUrl,
        isFetchingData,
        isLoadingImages,
        setIsLoadingImages,
        numOfFiles,

        // Progress data
        progress: progress.progress,
        progressMessage: progress.message,

        // Spectrum data
        maxIntensities: spectrumData.max_intensities,
        avgIntensities: spectrumData.avg_intensities,
        imageNames: spectrumData.image_names,
        scanUris: spectrumData.scan_uris,

        // Handlers
        fetchSpectrumData,
        handleImageIndicesChange,
        handleTiledSelection,

        displayOption,
        setDisplayOption,
    };
}
