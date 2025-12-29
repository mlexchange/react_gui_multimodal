import React, { useEffect, useRef, useState } from "react";
import Plot from "react-plotly.js";
import { DisplayOption } from "./types";
import { PlotMouseEvent } from "plotly.js";
import ProgressBar from "./SummaryProgressBar";
import { Toggle } from "@/components/ui";

interface SummaryFigProps {
  maxIntensities: number[];
  avgIntensities: number[];
  leftImageIndex: number | "";
  rightImageIndex: number | "";
  onSelectImages: (left: number | "", right: number | "") => void;
  isFetchingData?: boolean;
  displayOption: DisplayOption;
  setDisplayOption: (option: DisplayOption) => void;
  imageNames?: string[];
  progress?: number;
  progressMessage?: string;
}

interface Dimensions {
  width: number | undefined;
  height: number | undefined;
}

interface ContextMenuPosition {
  isVisible: boolean;
  pointIndex: number;
  x: number;
  y: number;
}

const SummaryFig: React.FC<SummaryFigProps> = ({
  maxIntensities,
  avgIntensities,
  leftImageIndex,
  rightImageIndex,
  onSelectImages,
  isFetchingData = false,
  displayOption = 'both',
  setDisplayOption,
  imageNames = [],
  progress = 0,
  progressMessage = 'Loading data...'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: undefined,
    height: undefined,
  });

  // State for context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition>({
    isVisible: false,
    pointIndex: -1,
    x: 0,
    y: 0
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

  // Add global click listener to close context menu
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu.isVisible) {
        setContextMenu(prev => ({ ...prev, isVisible: false }));
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [contextMenu.isVisible]);


  // Handle point click for image selection
  const handlePointClick = (data: Readonly<PlotMouseEvent>) => {
    data.event.stopPropagation();

    if (data.points && data.points.length > 0) {
      const pointIndex = data.points[0].pointIndex;

      setContextMenu({
        isVisible: true,
        pointIndex: pointIndex,
        x: data.event.clientX,
        y: data.event.clientY
      });
    }
  };

  // Handle menu option clicks
  const handleShowOnLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectImages(contextMenu.pointIndex, rightImageIndex);
    setContextMenu(prev => ({ ...prev, isVisible: false }));
  };

  const handleShowOnRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectImages(leftImageIndex, contextMenu.pointIndex);
    setContextMenu(prev => ({ ...prev, isVisible: false }));
  };

  // Create x-axis values (image indices)
  const indices = Array.from({ length: maxIntensities.length }, (_, i) => i + 1);

  // Create plot data based on display option
  const createPlotData = () => {
    const data = [];

    // Use bright green for better visibility
    const RIGHT_IMAGE_COLOR = 'rgb(0, 200, 0)'; // Bright green

    // Add annotations array for L/R labels
    const annotations = [];

    // Check if we have valid indices to annotate
    if (typeof leftImageIndex === 'number') {
      annotations.push({
        x: displayOption === 'max' ? maxIntensities[leftImageIndex] :
          displayOption === 'avg' ? avgIntensities[leftImageIndex] :
          maxIntensities[leftImageIndex],
        y: leftImageIndex + 1,
        text: 'L',
        showarrow: false,
        font: {
          color: 'black',
          size: 14,
          weight: 'bold'
        },
        xshift: 15
      });
    }

    if (typeof rightImageIndex === 'number') {
      annotations.push({
        x: displayOption === 'max' ? maxIntensities[rightImageIndex] :
          displayOption === 'avg' ? avgIntensities[rightImageIndex] :
          maxIntensities[rightImageIndex],
        y: rightImageIndex + 1,
        text: 'R',
        showarrow: false,
        font: {
          color: 'black',
          size: 14,
          weight: 'bold'
        },
        xshift: 15
      });
    }

    if (displayOption === 'both' || displayOption === 'max') {
      data.push({
        x: maxIntensities,
        y: indices,
        mode: 'lines+markers' as const,
        type: 'scatter' as const,
        name: 'Max',
        marker: {
          size: 6,
          color: 'rgb(31, 119, 180)',
          line: {
            width: indices.map(i => {
              const leftMatch = typeof leftImageIndex === 'number' && i === leftImageIndex + 1;
              const rightMatch = typeof rightImageIndex === 'number' && i === rightImageIndex + 1;
              return (leftMatch || rightMatch) ? 4 : 0;
            }),
            color: indices.map(i => {
              if (typeof leftImageIndex === 'number' && i === leftImageIndex + 1) return 'red';
              if (typeof rightImageIndex === 'number' && i === rightImageIndex + 1) {
                return RIGHT_IMAGE_COLOR;
              }
              return 'rgba(0,0,0,0)';
            })
          }
        },
        text: imageNames.length > 0 ? imageNames : undefined,
        hovertemplate: imageNames.length > 0
          ? 'Image %{y}<br>Name: %{text}<br>Max: %{x:.2f}<extra></extra>'
          : 'Image %{y}<br>Max: %{x:.2f}<extra></extra>',
      });
    }

    if (displayOption === 'both' || displayOption === 'avg') {
      data.push({
        x: avgIntensities,
        y: indices,
        mode: 'lines+markers' as const,
        type: 'scatter' as const,
        name: 'Avg',
        marker: {
          size: 6,
          color: 'rgb(255, 127, 14)',
          line: {
            width: indices.map(i => {
              const leftMatch = typeof leftImageIndex === 'number' && i === leftImageIndex + 1;
              const rightMatch = typeof rightImageIndex === 'number' && i === rightImageIndex + 1;
              return (leftMatch || rightMatch) ? 4 : 0;
            }),
            color: indices.map(i => {
              if (typeof leftImageIndex === 'number' && i === leftImageIndex + 1) return 'red';
              if (typeof rightImageIndex === 'number' && i === rightImageIndex + 1) return RIGHT_IMAGE_COLOR;
              return 'rgba(0,0,0,0)';
            })
          }
        },
        text: imageNames.length > 0 ? imageNames : undefined,
        hovertemplate: imageNames.length > 0
          ? 'Image #%{y}<br>%{text}<br>Avg: %{x:.2f}<extra></extra>'
          : 'Image #%{y}<br>Avg: %{x:.2f}<extra></extra>',
      });
    }

    // Add legend-only traces for L and R indicators
    if (typeof leftImageIndex === 'number') {
      data.push({
        x: [null],
        y: [null],
        type: 'scatter',
        mode: 'markers',
        name: 'L = Left Image',
        marker: {
          size: 10,
          color: 'white',
          line: {
            color: 'red',
            width: 4
          }
        },
        showlegend: true,
        hoverinfo: 'none',
        legendgroup: 'selected'
      });
    }

    if (typeof rightImageIndex === 'number') {
      data.push({
        x: [null],
        y: [null],
        type: 'scatter',
        mode: 'markers',
        name: 'R = Right Image',
        marker: {
          size: 10,
          color: 'white',
          line: {
            color: RIGHT_IMAGE_COLOR,
            width: 4
          }
        },
        showlegend: true,
        hoverinfo: 'none',
        legendgroup: 'selected'
      });
    }



    return { plotData: data, annotations };
  };

  const { plotData, annotations } = createPlotData();

  // Generate a consistent UI revision ID based only on the data dimensions
  const uiRevisionId = `${maxIntensities.length}-${avgIntensities.length}-${displayOption}`;

  // Generate a data revision ID that includes selected points
  const dataRevisionId = `${uiRevisionId}-${leftImageIndex}-${rightImageIndex}-color-update`;

  const layout = {
    width: dimensions.width,
    height: dimensions.height ? dimensions.height - 40 : undefined,
    xaxis: {
      title: {
        text: 'Intensity',
        font: { size: 12 }
      },
      tickfont: { size: 11 },
      autorange: true,
    },
    yaxis: {
      title: {
        text: 'Image Index',
        font: { size: 12 }
      },
      tickfont: { size: 11 },
      tickmode: 'linear' as const,
      dtick: Math.ceil(indices.length / 20),
      range: [Math.max(indices.length, 10) + 0.5, 0.5],
      autorange: false
    },
    legend: {
      x: 0.5,
      y: -0.10,
      orientation: 'h' as const,
      font: { size: 10 },
      xanchor: 'center' as const,
    },
    margin: { l: 40, r: 20, t: 30, b: 60 },
    hovermode: 'closest' as const,
    clickmode: 'event' as const,
    uirevision: uiRevisionId,
    datarevision: dataRevisionId,
    annotations: annotations, // Add annotations to the layout
  };

  // Determine if we should show the progress bar
  const showProgressBar = isFetchingData && progress < 100;

  const hasData = maxIntensities.length > 0 || avgIntensities.length > 0;

  return (
    <div ref={containerRef} className="w-full h-full relative flex flex-col">
      {/* Progress Bar */}
      <div className="w-full pt-3">
        <ProgressBar
          progress={progress}
          isVisible={showProgressBar}
          label={progressMessage}
        />
      </div>

      {/* Display Toggle Buttons */}
      {hasData && (
        <div className="flex items-center gap-2 px-2 shrink-0">
          <span className="text-sm text-gray-600">Display:</span>
          <Toggle
            pressed={displayOption === 'max' || displayOption === 'both'}
            onPressedChange={(pressed) => {
              const avgPressed = displayOption === 'avg' || displayOption === 'both';
              if (pressed && avgPressed) setDisplayOption('both');
              else if (pressed) setDisplayOption('max');
              else if (avgPressed) setDisplayOption('avg');
              else setDisplayOption('avg');
            }}
            size="sm"
          >
            Max
          </Toggle>
          <Toggle
            pressed={displayOption === 'avg' || displayOption === 'both'}
            onPressedChange={(pressed) => {
              const maxPressed = displayOption === 'max' || displayOption === 'both';
              if (pressed && maxPressed) setDisplayOption('both');
              else if (pressed) setDisplayOption('avg');
              else if (maxPressed) setDisplayOption('max');
              else setDisplayOption('max');
            }}
            size="sm"
          >
            Average
          </Toggle>
        </div>
      )}

      <div className="flex-grow relative">
        {isFetchingData && progress < 100 && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 z-10">
            <div className="text-lg font-semibold">
              {progress > 0 ? `Loading... ${Math.round(progress)}%` : 'Initializing...'}
            </div>
          </div>
        )}

        {hasData ? (
          <Plot
            data={plotData}
            layout={layout}
            config={{
              displayModeBar: "hover",
              responsive: true,
              displaylogo: false,
              scrollZoom: true,
              doubleClick: 'autosize',
              modeBarButtons: [
                ['pan2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'toImage'],
              ],
              showTips: true,
            }}
            onClick={handlePointClick}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        ) : (
          !isFetchingData && (
          <div className="flex items-center justify-center h-full">
            <p className="text-lg text-gray-500">No data available</p>
          </div>
          )
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.isVisible && (
        <div
          className="fixed z-[9999] bg-white shadow-lg rounded-md border border-gray-200"
          style={{
            left: `${contextMenu.x - 250}px`,
            top: `${contextMenu.y}px`,
            width: "250px"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 text-center text-base font-semibold border-b border-gray-200 bg-gray-50">
            {imageNames.length > contextMenu.pointIndex
              ? `Image #${contextMenu.pointIndex + 1} ${imageNames[contextMenu.pointIndex]}`
              : `Image #${contextMenu.pointIndex + 1}`}
          </div>

          <div
            className="p-3 text-base hover:bg-blue-50 cursor-pointer transition-colors"
            onClick={handleShowOnLeft}
          >
            Show on Left
          </div>

          <div
            className="p-3 text-base hover:bg-blue-50 cursor-pointer transition-colors"
            onClick={handleShowOnRight}
          >
            Show on Right
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryFig;
