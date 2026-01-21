import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  VisCanvas,
  DataCurve,
  DefaultInteractions,
  ResetZoomButton,
  TooltipMesh,
  CurveType,
  GlyphType,
  Annotation,
  useVisCanvasContext
} from "@h5web/lib";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { DisplayOption } from "./types";
import ProgressBar from "./SummaryProgressBar";
import { ToggleGroup } from "@/components/ui";
import { H5WebLegend, LegendEntry } from "./H5WebLegend";
import { type Domain } from "./utils/linePlotUtils";

/**
 * Click handler component that goes inside VisCanvas.
 * Converts click coordinates to data space and finds the nearest point.
 */
interface ClickHandlerProps {
  dataLength: number;
  onPointClick: (pointIndex: number, screenX: number, screenY: number) => void;
}

function CanvasClickHandler({ dataLength, onPointClick }: ClickHandlerProps) {
  const { canvasArea, htmlToData } = useVisCanvasContext();
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Get click position relative to canvas
      const rect = canvasArea.getBoundingClientRect();
      const htmlX = e.clientX - rect.left;
      const htmlY = e.clientY - rect.top;

      // Convert to data coordinates
      const dataPt = htmlToData(camera, new Vector3(htmlX, htmlY, 0));

      // The Y coordinate in data space is the image index (1-based)
      // Round to nearest integer and convert to 0-based index
      const pointIndex = Math.round(dataPt.y) - 1;

      // Check if click is on a valid point
      if (pointIndex >= 0 && pointIndex < dataLength) {
        // Stop propagation to prevent the global click handler from closing the menu
        e.stopPropagation();
        onPointClick(pointIndex, e.clientX, e.clientY);
      }
    };

    canvasArea.addEventListener("click", handleClick);
    return () => canvasArea.removeEventListener("click", handleClick);
  }, [canvasArea, htmlToData, camera, dataLength, onPointClick]);

  return null;
}

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

interface ContextMenuPosition {
  isVisible: boolean;
  pointIndex: number;
  x: number;
  y: number;
}

// Colors
const MAX_COLOR = "rgb(31, 119, 180)"; // Blue
const AVG_COLOR = "rgb(255, 127, 14)"; // Orange
const LEFT_MARKER_COLOR = "red";
const RIGHT_MARKER_COLOR = "rgb(0, 200, 0)"; // Bright green

const SummaryFig: React.FC<SummaryFigProps> = ({
  maxIntensities,
  avgIntensities,
  leftImageIndex,
  rightImageIndex,
  onSelectImages,
  isFetchingData = false,
  displayOption = "both",
  setDisplayOption,
  imageNames = [],
  progress = 0,
  progressMessage = "Loading data..."
}) => {
  // State for context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition>({
    isVisible: false,
    pointIndex: -1,
    x: 0,
    y: 0
  });

  // Add global click listener to close context menu
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu.isVisible) {
        setContextMenu((prev) => ({ ...prev, isVisible: false }));
      }
    };

    document.addEventListener("click", handleGlobalClick);
    return () => {
      document.removeEventListener("click", handleGlobalClick);
    };
  }, [contextMenu.isVisible]);

  // Handle menu option clicks
  const handleShowOnLeft = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelectImages(contextMenu.pointIndex, rightImageIndex);
      setContextMenu((prev) => ({ ...prev, isVisible: false }));
    },
    [contextMenu.pointIndex, rightImageIndex, onSelectImages]
  );

  const handleShowOnRight = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelectImages(leftImageIndex, contextMenu.pointIndex);
      setContextMenu((prev) => ({ ...prev, isVisible: false }));
    },
    [contextMenu.pointIndex, leftImageIndex, onSelectImages]
  );

  // Create x-axis values (image indices, 1-based for display but 0-based internally)
  const indices = useMemo(
    () => Array.from({ length: maxIntensities.length }, (_, i) => i + 1),
    [maxIntensities.length]
  );

  // Prepare curve data for H5Web
  const {
    curves,
    curveEntries,
    markerEntries,
    xDomain,
    yDomain,
    leftMarkerData,
    rightMarkerData
  } = useMemo(() => {
    const curveData: Array<{
      id: string;
      abscissas: number[];
      ordinates: number[];
      color: string;
      label: string;
      curveType: CurveType;
      glyphType: GlyphType;
      glyphSize: number;
    }> = [];
    const curveLegend: LegendEntry[] = [];
    const markerLegend: LegendEntry[] = [];

    // Prepare data - note: H5Web uses horizontal X axis for intensity, Y for index
    // But we want vertical plot (Y = image index, X = intensity)
    // So we swap: abscissas = intensities, ordinates = indices
    if (displayOption === "both" || displayOption === "max") {
      curveData.push({
        id: "max",
        abscissas: maxIntensities,
        ordinates: indices,
        color: MAX_COLOR,
        label: "Max",
        curveType: CurveType.LineAndGlyphs,
        glyphType: GlyphType.Circle,
        glyphSize: 6
      });
      curveLegend.push({
        id: "max",
        label: "Max",
        color: MAX_COLOR
      });
    }

    if (displayOption === "both" || displayOption === "avg") {
      curveData.push({
        id: "avg",
        abscissas: avgIntensities,
        ordinates: indices,
        color: AVG_COLOR,
        label: "Avg",
        curveType: CurveType.LineAndGlyphs,
        glyphType: GlyphType.Circle,
        glyphSize: 6
      });
      curveLegend.push({
        id: "avg",
        label: "Avg",
        color: AVG_COLOR
      });
    }

    // Prepare marker data for selected images
    let leftMarker: { x: number; y: number } | null = null;
    let rightMarker: { x: number; y: number } | null = null;

    if (typeof leftImageIndex === "number") {
      const intensity =
        displayOption === "avg"
          ? avgIntensities[leftImageIndex]
          : maxIntensities[leftImageIndex];
      leftMarker = { x: intensity, y: leftImageIndex + 1 };
      markerLegend.push({
        id: "left-indicator",
        label: "L = Left",
        color: "white",
        isMarker: true,
        outlineColor: LEFT_MARKER_COLOR
      });
    }

    if (typeof rightImageIndex === "number") {
      const intensity =
        displayOption === "avg"
          ? avgIntensities[rightImageIndex]
          : maxIntensities[rightImageIndex];
      rightMarker = { x: intensity, y: rightImageIndex + 1 };
      markerLegend.push({
        id: "right-indicator",
        label: "R = Right",
        color: "white",
        isMarker: true,
        outlineColor: RIGHT_MARKER_COLOR
      });
    }

    // Calculate domains
    let xMin = Infinity,
      xMax = -Infinity;

    const allIntensities =
      displayOption === "both"
        ? [...maxIntensities, ...avgIntensities]
        : displayOption === "max"
          ? maxIntensities
          : avgIntensities;

    allIntensities.forEach((v) => {
      if (isFinite(v) && !isNaN(v)) {
        xMin = Math.min(xMin, v);
        xMax = Math.max(xMax, v);
      }
    });

    if (!isFinite(xMin)) xMin = 0;
    if (!isFinite(xMax)) xMax = 1;

    const xPadding = (xMax - xMin) * 0.05 || 0.1;

    // Y domain: image indices (reversed so index 1 is at top)
    const yMax = Math.max(indices.length, 10) + 0.5;
    const yMin = 0.5;

    return {
      curves: curveData,
      curveEntries: curveLegend,
      markerEntries: markerLegend,
      xDomain: [xMin - xPadding, xMax + xPadding] as Domain,
      yDomain: [yMax, yMin] as Domain, // Reversed for top-to-bottom
      leftMarkerData: leftMarker,
      rightMarkerData: rightMarker
    };
  }, [
    maxIntensities,
    avgIntensities,
    indices,
    displayOption,
    leftImageIndex,
    rightImageIndex
  ]);

  // Handle canvas click - show context menu
  const handleCanvasClick = useCallback(
    (pointIndex: number, screenX: number, screenY: number) => {
      setContextMenu({
        isVisible: true,
        pointIndex,
        x: screenX,
        y: screenY
      });
    },
    []
  );

  // Determine if we should show the progress bar
  const showProgressBar = isFetchingData && progress < 100;
  const hasData = maxIntensities.length > 0 || avgIntensities.length > 0;

  return (
    <div
      className="w-full h-full relative flex flex-col"
      data-summary-fig="true"
    >
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
          <ToggleGroup
            value={displayOption}
            onValueChange={setDisplayOption}
            options={[
              { value: "max", label: "Max" },
              { value: "avg", label: "Average" },
              { value: "both", label: "Both" }
            ]}
            size="sm"
          />
        </div>
      )}

      <div className="flex-grow relative flex flex-col min-h-0">
        {isFetchingData && progress < 100 && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 z-10">
            <div className="text-lg font-semibold">
              {progress > 0
                ? `Loading... ${Math.round(progress)}%`
                : "Initializing..."}
            </div>
          </div>
        )}

        {hasData ? (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Plot area */}
            <div className="w-full flex-1 h-0 flex flex-col">
              <VisCanvas
                abscissaConfig={{
                  visDomain: xDomain,
                  showGrid: true,
                  label: "Intensity"
                }}
                ordinateConfig={{
                  visDomain: yDomain,
                  showGrid: true,
                  label: "Image index"
                }}
                aspect="auto"
              >
                <DefaultInteractions />
                <ResetZoomButton />

                {/* Click handler for context menu */}
                <CanvasClickHandler
                  dataLength={maxIntensities.length}
                  onPointClick={handleCanvasClick}
                />

                {/* Main data curves */}
                {curves.map((curve) => (
                  <DataCurve
                    key={curve.id}
                    abscissas={curve.abscissas}
                    ordinates={curve.ordinates}
                    color={curve.color}
                    curveType={curve.curveType}
                    glyphType={curve.glyphType}
                    glyphSize={curve.glyphSize}
                  />
                ))}

                {/* Left image marker (larger circle with red outline) */}
                {leftMarkerData && (
                  <DataCurve
                    abscissas={[leftMarkerData.x]}
                    ordinates={[leftMarkerData.y]}
                    color={LEFT_MARKER_COLOR}
                    curveType={CurveType.GlyphsOnly}
                    glyphType={GlyphType.Circle}
                    glyphSize={14}
                  />
                )}

                {/* Right image marker (larger circle with green outline) */}
                {rightMarkerData && (
                  <DataCurve
                    abscissas={[rightMarkerData.x]}
                    ordinates={[rightMarkerData.y]}
                    color={RIGHT_MARKER_COLOR}
                    curveType={CurveType.GlyphsOnly}
                    glyphType={GlyphType.Circle}
                    glyphSize={14}
                  />
                )}

                {/* L annotation */}
                {leftMarkerData && (
                  <Annotation
                    x={leftMarkerData.x}
                    y={leftMarkerData.y}
                    overflowCanvas
                    style={{
                      transform: "translate(12px, -50%)",
                      fontWeight: "bold",
                      fontSize: 14
                    }}
                  >
                    L
                  </Annotation>
                )}

                {/* R annotation */}
                {rightMarkerData && (
                  <Annotation
                    x={rightMarkerData.x}
                    y={rightMarkerData.y}
                    overflowCanvas
                    style={{
                      transform: "translate(12px, -50%)",
                      fontWeight: "bold",
                      fontSize: 14
                    }}
                  >
                    R
                  </Annotation>
                )}

                <TooltipMesh
                  guides="both"
                  renderTooltip={(_x, y) => {
                    // Find closest point
                    const imageIdx = Math.round(y) - 1; // Convert to 0-based
                    if (imageIdx < 0 || imageIdx >= maxIntensities.length)
                      return null;

                    const maxVal = maxIntensities[imageIdx];
                    const avgVal = avgIntensities[imageIdx];
                    const name = imageNames[imageIdx];

                    return (
                      <div className="text-xs bg-white/90 p-1 rounded shadow">
                        <div className="font-medium">Image #{imageIdx + 1}</div>
                        {name && <div className="text-gray-600">{name}</div>}
                        {(displayOption === "both" ||
                          displayOption === "max") && (
                          <div>Max: {maxVal?.toFixed(2)}</div>
                        )}
                        {(displayOption === "both" ||
                          displayOption === "avg") && (
                          <div>Avg: {avgVal?.toFixed(2)}</div>
                        )}
                      </div>
                    );
                  }}
                />
              </VisCanvas>
            </div>
            {/* Legend - two rows */}
            <div className="shrink-0 border-t border-gray-100 flex flex-col">
              <H5WebLegend entries={curveEntries} />
              {markerEntries.length > 0 && (
                <H5WebLegend entries={markerEntries} />
              )}
            </div>
          </div>
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
          className="fixed z-[9999] bg-white shadow-md rounded border border-gray-200"
          style={{
            left: `${contextMenu.x - 180}px`,
            top: `${contextMenu.y}px`,
            width: "180px"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1.5 text-center text-xs font-medium border-b border-gray-200 bg-gray-50 text-gray-700">
            {imageNames.length > contextMenu.pointIndex
              ? `#${contextMenu.pointIndex + 1} ${imageNames[contextMenu.pointIndex]}`
              : `Image #${contextMenu.pointIndex + 1}`}
          </div>

          <div
            className="px-2 py-1.5 text-sm hover:bg-blue-50 cursor-pointer transition-colors text-gray-700"
            onClick={handleShowOnLeft}
          >
            Show on Left
          </div>

          <div
            className="px-2 py-1.5 text-sm hover:bg-blue-50 cursor-pointer transition-colors text-gray-700"
            onClick={handleShowOnRight}
          >
            Show on Right
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SummaryFig);
