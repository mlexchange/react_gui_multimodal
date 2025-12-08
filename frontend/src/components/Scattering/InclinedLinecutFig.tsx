import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Plot from 'react-plotly.js';
import { InclinedLinecut } from './types';
import { calculateInclinedLineEndpoints } from './utils/calculateInclinedLinecutEndpoints';

interface InclinedLinecutFigProps {
    linecuts: InclinedLinecut[];
    inclinedLinecutData1: { id: number; data: number[] }[];
    inclinedLinecutData2: { id: number; data: number[] }[];
    beamCenterX: number;
    beamCenterY: number;
    zoomedXQRange: [number, number] | null;
    qXVector: number[];
    qYVector: number[];
    units: string;
}

interface Dimensions {
    width: number | undefined;
    height: number | undefined;
}

const InclinedLinecutFig: React.FC<InclinedLinecutFigProps> = ({
    linecuts,
    inclinedLinecutData1,
    inclinedLinecutData2,
    beamCenterX,
    beamCenterY,
    zoomedXQRange,
    qXVector,
    qYVector,
    units,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState<Dimensions>({
        width: undefined,
        height: undefined,
    });

    // Update dimensions when container size changes
    useEffect(() => {
        const resizeObserver = new ResizeObserver((entries) => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                setDimensions({
                    width: Math.floor(width),
                    height: Math.floor(height),
                });
            }
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    /**
     * Compute q radial values along the linecut path with consistent vertical handling
     *
     * @param linecut - The linecut object with angle and position information
     * @param dataLength - Number of data points in the intensity array
     * @returns Array of q-radial values to be used as x-coordinates in the plot
     */
    const computeQRadialDistance = useCallback(
        (linecut: InclinedLinecut, dataLength: number): number[] => {
        // If we don't have q vectors or data, return empty array
        if (!qXVector.length || !qYVector.length || dataLength === 0) {
            return [];
        }

        // For the given linecut with angle, calculate the endpoints
        const imageWidth = qXVector.length;
        const imageHeight = qYVector.length;

        const endpoints = calculateInclinedLineEndpoints({
            linecut,
            imageWidth,
            imageHeight,
            beam_center_x: beamCenterX,
            beam_center_y: beamCenterY,
            factor: 1
        });

        if (!endpoints) return Array(dataLength).fill(0);

        const { x0, y0, x1, y1 } = endpoints;

        // Check if linecut is vertical or nearly vertical (±90° ±1°)
        const isVertical = Math.abs(Math.abs(linecut.angle) - 90) < 1;

        // Determine the order of points
        let startX, startY, endX, endY;

        if (isVertical) {
            // For vertical linecuts, always order from top to bottom
            // Top point has smaller y value (y-axis points downward in image coordinates)
            if (y0 < y1) {
            startX = x0;
            startY = y0;
            endX = x1;
            endY = y1;
            } else {
            startX = x1;
            startY = y1;
            endX = x0;
            endY = y0;
            }
        } else {
            // For non-vertical linecuts, sort from left to right
            const needsReordering = x0 > x1;
            startX = needsReordering ? x1 : x0;
            startY = needsReordering ? y1 : y0;
            endX = needsReordering ? x0 : x1;
            endY = needsReordering ? y0 : y1;
        }

        const adjustedDx = endX - startX;
        const adjustedDy = endY - startY;

        const qRadialValues = new Array(dataLength);

        for (let i = 0; i < dataLength; i++) {
            // Interpolate position along the line
            const t = i / (dataLength - 1); // Normalized position [0,1]

            // Calculate pixel coordinates at this position
            const pixelX = Math.round(startX + t * adjustedDx);
            const pixelY = Math.round(startY + t * adjustedDy);

            // Bounds checking to avoid accessing out of range indices
            const boundedX = Math.min(Math.max(0, pixelX), imageWidth - 1);
            const boundedY = Math.min(Math.max(0, pixelY), imageHeight - 1);

            // Get q values at this position
            const qX = qXVector[boundedX];
            const qY = qYVector[boundedY];

            let signedQRadial: number;

            if (isVertical) {
            // For vertical linecuts (±90°):
            // Use qY directly instead of calculating q-radial for consistency with vertical linecuts
            // Follow vertical linecut convention: top (lower y) = negative, bottom (higher y) = positive
            const qYCenter = qYVector[Math.min(Math.max(0, Math.round(beamCenterY)), qYVector.length - 1)];
            signedQRadial = qY - qYCenter;
            } else {
            // For non-vertical linecuts:
            // Calculate q radial (q_r = sqrt(qx^2 + qy^2))
            const qRadial = Math.sqrt(qX * qX + qY * qY);

            // Left of beam center = negative, right = positive
            const isLeftOfBeamCenter = pixelX < beamCenterX;
            signedQRadial = isLeftOfBeamCenter ? -qRadial : qRadial;
            }

            qRadialValues[i] = signedQRadial;
        }

        return qRadialValues;
        },
        [qXVector, qYVector, beamCenterX, beamCenterY]
    );




    // Memoize plot data
    const plotData = useMemo(() => {
        return linecuts
            .filter((linecut) => !linecut.hidden)
            .flatMap((linecut) => {
                // Find corresponding data
                const data1Item = inclinedLinecutData1?.find(d => d.id === linecut.id);
                const data2Item = inclinedLinecutData2?.find(d => d.id === linecut.id);

                // If no data is available, skip this linecut
                if (!data1Item || !data2Item) return [];

                const data1 = data1Item.data;
                const data2 = data2Item.data;

                // Calculate q radial values
                const qRadialValues = computeQRadialDistance(linecut, data1.length);

                // Check if we have valid data to plot
                if (qRadialValues.length === 0 || data1.length === 0 || data2.length === 0) {
                    return [];
                }

                return [
                    {
                        x: qRadialValues,
                        y: data1,
                        type: 'scatter' as const,
                        mode: 'lines' as const,
                        name: `Left Linecut ${linecut.id}`,
                        line: {
                            color: linecut.leftColor,
                            width: 2,
                        },
                        hovertemplate: `q<sub>r</sub>: %{x:.3f} ${units}<br>Intensity: %{y:.1f}<extra></extra>`
                    },
                    {
                        x: qRadialValues,
                        y: data2,
                        type: 'scatter' as const,
                        mode: 'lines' as const,
                        name: `Right Linecut ${linecut.id}`,
                        line: {
                            color: linecut.rightColor,
                            width: 2,
                        },
                        hovertemplate: `q<sub>r</sub>: %{x:.3f} ${units}<br>Intensity: %{y:.1f}<extra></extra>`
                    },
                ];
            });
    }, [linecuts, inclinedLinecutData1, inclinedLinecutData2, units, computeQRadialDistance]);

    // Determine y-axis range based on data
    const getYAxisRange = useMemo(() => {
        let min = Infinity;
        let max = -Infinity;

        // Check all visible linecuts
        linecuts
            .filter(linecut => !linecut.hidden)
            .forEach(linecut => {
                // Find corresponding data
                const data1 = inclinedLinecutData1?.find(d => d.id === linecut.id)?.data || [];
                const data2 = inclinedLinecutData2?.find(d => d.id === linecut.id)?.data || [];

                // Update min and max values
                data1.forEach(val => {
                    if (!isNaN(val)) {
                        min = Math.min(min, val);
                        max = Math.max(max, val);
                    }
                });

                data2.forEach(val => {
                    if (!isNaN(val)) {
                        min = Math.min(min, val);
                        max = Math.max(max, val);
                    }
                });
            });

        // Add 5% padding to top and bottom
        const padding = (max - min) * 0.05;

        // Return default range if no valid data
        if (min === Infinity || max === -Infinity) {
            return [0, 1];
        }

        return [min - padding, max + padding];
    }, [linecuts, inclinedLinecutData1, inclinedLinecutData2]);

    // Update the layout
    const layout = useMemo(() => {
        const yRange = getYAxisRange;

        return {
            width: dimensions.width,
            height: dimensions.height,
            xaxis: {
                title: {
                    text: `Signed q<sub>r</sub> (${units})`,
                    font: { size: 12 }
                },
                tickfont: { size: 11 },
                autorange: zoomedXQRange ? false : true,
                range: zoomedXQRange || undefined,
            },
            yaxis: {
                title: { text: "Intensity", font: { size: 12 }, standoff: 40 },
                tickfont: { size: 11 },
                autorange: true,
                range: yRange,
            },
            margin: { l: 60, r: 10, t: 10, b: 40 },
            legend: { font: { size: 10 }, orientation: 'h' as const, y: -0.25 },
            font: { size: 11 },
            showlegend: true,
            hovermode: 'closest' as const,
        };
    }, [dimensions, zoomedXQRange, getYAxisRange, units]);

    // Show a message if no data is available
    if (linecuts.filter(l => !l.hidden).length === 0) {
        return (
            <div ref={containerRef} className="w-full h-full flex items-center justify-center">
                <p className="text-lg text-gray-500">No visible linecuts available</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full h-full">
            <Plot
                data={plotData}
                layout={layout}
                config={{
                    scrollZoom: true,
                    responsive: true,
                    displayModeBar: true,
                    displaylogo: false,
                    modeBarButtons: [
                        ['pan2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
                    ],
                    showTips: true,
                    toImageButtonOptions: {
                        format: 'svg',
                        filename: 'inclined_linecut_plot',
                        height: 1080,
                        width: 1920,
                        scale: 1
                    }
                }}
                useResizeHandler
                style={{ width: '100%', height: '100%' }}
            />
        </div>
    );
};

export default InclinedLinecutFig;
