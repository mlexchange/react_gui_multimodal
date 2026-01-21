import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Select, IconButton, notifications } from "@/components/ui";
import { ContentCard, Modal } from "@/components/shared";
import {
  CircleHalfTiltIcon,
  ListIcon,
  TreeStructureIcon,
  WarningIcon,
  WrenchIcon
} from "@phosphor-icons/react";
import { CalibrationParams, OperationType } from "./types";

import { Button, ButtonWithIcon } from "@blueskyproject/finch";
import { Tiled } from "@blueskyproject/tiled";
import "@blueskyproject/tiled/style.css";
import "./styles.css";

// Import hooks
import useScattering from "./hooks/useScattering";
import useAzimuthalIntegration from "./hooks/useAzimuthalIntegration";
import useHorizontalLinecut from "./hooks/useHorizontalLinecut";
import useVerticalLinecut from "./hooks/useVerticalLinecut";
import useInclinedLinecut from "./hooks/useInclinedLinecut";
import useSummary from "./hooks/useSummary";
import useSessionPersistence, {
  PersistableState
} from "./hooks/useSessionPersistence";
import useBatchProcessing from "./hooks/useBatchProcessing";

// Import components
import H5WebScatterSubplot from "./H5WebScatterSubplot";
import LinecutWidget from "./LinecutWidget";
import InclinedLinecutWidget from "./InclinedLinecutWidget";
import AzimuthalIntegrationWidget from "./AzimuthalIntegrationWidget";
import CalibrationWidget from "./CalibrationWidget";
import LinecutFig from "./LinecutFig";
import InclinedLinecutFig from "./InclinedLinecutFig";
import AzimuthalIntegrationFig from "./AzimuthalIntegrationFig";
import SummaryFig from "./SummaryFig";
import { BatchProcessingWidget } from "./BatchProcessingWidget";

// Import utilities
import {
  handleExperimentTypeChange,
  addLinecut
} from "./utils/linecutHandlers";

// Import assets
import alsLogo from "@/assets/als-logo.png";
import { scatteringIcons } from "./icons";

const tiledUrl = import.meta.env.SCATTERING_TILED_URL;
const tiledApiKey = import.meta.env.SCATTERING_TILED_API_KEY;

interface ScatteringProps {
  standalone?: boolean;
}

export default function Scattering({ standalone = false }: ScatteringProps) {
  const linecutOrder = ["Horizontal", "Vertical", "Inclined", "Azimuthal"];
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
  const [operationType, setOperationType] = useState<OperationType>("subtract");
  const [isBatchOverlayOpen, setIsBatchOverlayOpen] = useState(false);

  // Session persistence hook
  const { isRestoring, hasRestoredSession, restoredSession, triggerAutoSave } =
    useSessionPersistence();

  // Track if session has been applied
  const hasAppliedSession = useRef(false);

  const {
    experimentType,
    setExperimentType,
    selectedLinecuts,
    setSelectedLinecuts,
    setImageHeight,
    setImageWidth,
    imageData1,
    setImageData1,
    imageData2,
    setImageData2,
    zoomedXPixelRange,
    setZoomedXPixelRange,
    zoomedYPixelRange,
    setZoomedYPixelRange,
    calibrationParams,
    updateCalibration,
    isCalibrationSet,
    qXMatrix,
    qYMatrix,
    setGisaxsQMatrices,
    maskUri,
    setMaskUri,
    maskData,
    maskShape,
    updateMaskData,
    showMaskOverlay,
    setShowMaskOverlay,
    showQSpaceAxes,
    setShowQSpaceAxes,
    restoreState: restoreScatteringState
  } = useScattering();

  const qXVector = useMemo(() => qXMatrix[0] ?? [], [qXMatrix]);
  const qYVector = useMemo(() => qYMatrix.map((row) => row[0]), [qYMatrix]);

  const {
    leftImageIndex,
    setLeftImageIndex,
    rightImageIndex,
    setRightImageIndex,
    selectedContainerPath,
    setSelectedContainerPath,
    isFetchingData,
    isLoadingImages,
    setIsLoadingImages,
    numOfFiles,

    progress,
    progressMessage,

    maxIntensities,
    avgIntensities,
    imageNames,
    scanUris,

    fetchSummaryData,
    handleImageIndicesChange,
    handleTiledSelection,

    displayOption,
    setDisplayOption
  } = useSummary();

  // Get scan URIs for selected images
  // These will be used for azimuthal integration API calls
  const leftScanUri =
    leftImageIndex !== "" && scanUris.length > 0
      ? scanUris[leftImageIndex]
      : null;
  const rightScanUri =
    rightImageIndex !== "" && scanUris.length > 0
      ? scanUris[rightImageIndex]
      : null;

  // Linecut hooks - fetch data from backend API with debouncing
  const {
    horizontalLinecuts,
    leftLinecutData: horizontalLeftData,
    rightLinecutData: horizontalRightData,
    loadingHorizontalLinecuts,
    addHorizontalLinecut,
    updateHorizontalLinecutPosition,
    updateHorizontalLinecutWidth,
    updateHorizontalLinecutColor,
    deleteHorizontalLinecut,
    toggleHorizontalLinecutVisibility,
    restoreLinecuts: restoreHorizontalLinecuts
  } = useHorizontalLinecut({
    qYMatrix,
    leftScanUri,
    rightScanUri,
    calibrationParams,
    experimentType,
    maskUri
  });

  const {
    verticalLinecuts,
    leftLinecutData: verticalLeftData,
    rightLinecutData: verticalRightData,
    loadingVerticalLinecuts,
    addVerticalLinecut,
    updateVerticalLinecutPosition,
    updateVerticalLinecutWidth,
    updateVerticalLinecutColor,
    deleteVerticalLinecut,
    toggleVerticalLinecutVisibility,
    restoreLinecuts: restoreVerticalLinecuts
  } = useVerticalLinecut({
    qXMatrix,
    leftScanUri,
    rightScanUri,
    calibrationParams,
    experimentType,
    maskUri
  });

  const {
    inclinedLinecuts,
    leftLinecutData: inclinedLeftLinecutData,
    rightLinecutData: inclinedRightLinecutData,
    loadingInclinedLinecuts,
    addInclinedLinecut,
    updateInclinedLinecutAngle,
    updateInclinedLinecutWidth,
    updateInclinedLinecutColor,
    deleteInclinedLinecut,
    toggleInclinedLinecutVisibility,
    restoreLinecuts: restoreInclinedLinecuts
  } = useInclinedLinecut({
    leftScanUri,
    rightScanUri,
    calibrationParams,
    experimentType,
    maskUri
  });

  const {
    azimuthalIntegrations,
    azimuthalData1,
    azimuthalData2,
    loadingAzimuthalIntegrations,
    addAzimuthalIntegration,
    updateAzimuthalQRange,
    updateAzimuthalRange,
    updateAzimuthalColor,
    deleteAzimuthalIntegration,
    toggleAzimuthalVisibility,
    restoreIntegrations: restoreAzimuthalIntegrations
  } = useAzimuthalIntegration(
    calibrationParams,
    leftScanUri,
    rightScanUri,
    maskUri
  );

  // Get image dimensions from imageData1 (assumes both images have same dimensions)
  const imageHeight = imageData1.length;
  const imageWidth = imageData1[0]?.length || 0;

  // Compute Q-magnitude matrix from qXMatrix and qYMatrix (already fetched by useScattering)
  const qMagnitudeMatrix = useMemo(() => {
    if (!qXMatrix?.length || !qYMatrix?.length) {
      return null;
    }
    // Compute Q magnitude: sqrt(qX² + qY²)
    return qXMatrix.map((row, y) =>
      row.map((qx, x) => Math.sqrt(qx * qx + qYMatrix[y][x] * qYMatrix[y][x]))
    );
  }, [qXMatrix, qYMatrix]);

  // Compute maxQValue from qMagnitudeMatrix
  const maxQValue = useMemo(() => {
    if (!qMagnitudeMatrix || qMagnitudeMatrix.length === 0) {
      return 2; // Default fallback before calibration is set
    }
    let max = 0;
    for (const row of qMagnitudeMatrix) {
      for (const val of row) {
        if (Number.isFinite(val) && val > max) {
          max = val;
        }
      }
    }
    return max > 0 ? max : 2;
  }, [qMagnitudeMatrix]);

  // Handle zoom changes from the heatmap (left panel is source of truth)
  const handleHeatmapZoomChange = useCallback(
    (
      xVisibleDomain: [number, number] | null,
      yVisibleDomain: [number, number] | null
    ) => {
      setZoomedXPixelRange(xVisibleDomain);
      setZoomedYPixelRange(yVisibleDomain);
    },
    [setZoomedXPixelRange, setZoomedYPixelRange]
  );

  // Batch processing hook
  const batchProcessing = useBatchProcessing({
    calibrationParams,
    experimentType,
    horizontalLinecuts,
    verticalLinecuts,
    inclinedLinecuts,
    azimuthalIntegrations
  });

  // ========== SESSION RESTORATION ==========
  // Restore session state when the component mounts and session data is available
  useEffect(() => {
    // Skip if still restoring or already applied
    if (isRestoring || hasAppliedSession.current) return;

    // Skip if no session to restore
    if (!hasRestoredSession || !restoredSession) {
      hasAppliedSession.current = true;
      return;
    }

    // Apply restored session state
    console.log("Restoring session state...");

    // 1. Restore scattering state (experiment type, calibration, selectedLinecuts, maskUri, showQSpaceAxes)
    restoreScatteringState({
      experimentType: restoredSession.experimentType,
      selectedLinecuts: restoredSession.selectedLinecuts,
      calibrationParams: restoredSession.calibrationParams,
      maskUri: restoredSession.maskUri,
      showQSpaceAxes: restoredSession.showQSpaceAxes
    });

    // 3. Restore linecut definitions
    restoreHorizontalLinecuts(restoredSession.horizontalLinecuts);
    restoreVerticalLinecuts(restoredSession.verticalLinecuts);
    restoreInclinedLinecuts(restoredSession.inclinedLinecuts);

    // 4. Restore azimuthal integration definitions
    restoreAzimuthalIntegrations(restoredSession.azimuthalIntegrations);

    // 5. Restore UI state
    setIsSidebarCollapsed(restoredSession.isSidebarCollapsed);
    setIsSummaryCollapsed(restoredSession.isSummaryCollapsed);
    setOperationType(restoredSession.operationType);

    // 6. Restore batch processing state if available
    if (restoredSession.batchResults && restoredSession.batchParameterHashes) {
      batchProcessing.restoreState(
        restoredSession.batchResults,
        restoredSession.batchParameterHashes,
        restoredSession.batchSelectedScanUris || []
      );
    }

    // 7. If we have a container path, fetch the summary data
    //    Then set the image indices after summary data is loaded
    if (restoredSession.containerPath) {
      setSelectedContainerPath(restoredSession.containerPath);
      fetchSummaryData(restoredSession.containerPath).then(() => {
        // Restore image indices after summary data is available
        if (restoredSession.leftImageIndex !== "") {
          setLeftImageIndex(restoredSession.leftImageIndex);
        }
        if (restoredSession.rightImageIndex !== "") {
          setRightImageIndex(restoredSession.rightImageIndex);
        }
      });
    }

    hasAppliedSession.current = true;
    console.log("Session restored successfully");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isRestoring,
    hasRestoredSession,
    restoredSession,
    restoreScatteringState,
    restoreHorizontalLinecuts,
    restoreVerticalLinecuts,
    restoreInclinedLinecuts,
    restoreAzimuthalIntegrations,
    batchProcessing.restoreState,
    setSelectedContainerPath,
    fetchSummaryData,
    setLeftImageIndex,
    setRightImageIndex
  ]);

  // ========== AUTO-SAVE SESSION ==========
  // Trigger auto-save whenever persistable state changes
  useEffect(() => {
    // Don't save while restoring or before session has been applied
    if (isRestoring || !hasAppliedSession.current) return;

    const persistableState: PersistableState = {
      containerPath: selectedContainerPath,
      leftImageIndex,
      rightImageIndex,
      experimentType: experimentType as "SAXS" | "GISAXS",
      calibrationParams,
      showQSpaceAxes,
      horizontalLinecuts,
      verticalLinecuts,
      inclinedLinecuts,
      selectedLinecuts,
      azimuthalIntegrations,
      isSidebarCollapsed,
      isSummaryCollapsed,
      operationType,
      maskUri,
      // Batch processing state
      batchResults: batchProcessing.results,
      batchParameterHashes: batchProcessing.parameterHashes,
      batchSelectedScanUris: batchProcessing.selectedScanUris
    };

    triggerAutoSave(persistableState);
  }, [
    isRestoring,
    selectedContainerPath,
    leftImageIndex,
    rightImageIndex,
    experimentType,
    calibrationParams,
    showQSpaceAxes,
    horizontalLinecuts,
    verticalLinecuts,
    inclinedLinecuts,
    selectedLinecuts,
    azimuthalIntegrations,
    isSidebarCollapsed,
    isSummaryCollapsed,
    operationType,
    maskUri,
    batchProcessing.results,
    batchProcessing.parameterHashes,
    batchProcessing.selectedScanUris,
    triggerAutoSave
  ]);

  const handleCalibrationUpdate = async (params: CalibrationParams) => {
    try {
      notifications.show({
        id: "calibration-update",
        loading: true,
        title: "Updating Calibration",
        message: "Please wait while calibration parameters are updated...",
        autoClose: false
      });

      // Update the calibration parameters in the hook
      // This will trigger q-vectors fetch via the useEffect in useScattering
      updateCalibration(params);

      // Close the calibration overlay
      setIsCalibrationOpen(false);

      notifications.update({
        id: "calibration-update",
        color: "green",
        title: "Calibration Updated",
        message: "Calibration parameters have been updated successfully",
        autoClose: 2000
      });
    } catch (error) {
      let errorMessage: string;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else {
        errorMessage = "An unexpected error occurred during calibration update";
      }

      console.error("Error updating calibration:", error);

      notifications.update({
        id: "calibration-update",
        color: "red",
        title: "Calibration Update Failed",
        message: errorMessage,
        autoClose: 4000
      });
    }
  };

  const linecutButtonsConfig = [
    {
      type: "Horizontal" as const,
      icon: scatteringIcons.horizontalLinecut,
      addFn: addHorizontalLinecut
    },
    {
      type: "Vertical" as const,
      icon: scatteringIcons.verticalLinecut,
      addFn: addVerticalLinecut
    },
    {
      type: "Inclined" as const,
      icon: scatteringIcons.inclinedLinecut,
      addFn: addInclinedLinecut
    },
    {
      type: "Azimuthal" as const,
      icon: scatteringIcons.azimuthalIntegration,
      addFn: addAzimuthalIntegration,
      saxsOnly: true
    }
  ];

  return (
    <div
      className={`flex flex-col ${standalone ? "h-screen" : "h-full"} w-full`}
    >
      {standalone && (
        <header className="flex items-center justify-center gap-3 p-1 bg-white border-b border-gray-200 shrink-0">
          <img src={alsLogo} alt="ALS Logo" className="h-10" />
          <h1 className="text-2xl font-bold text-sky-950">
            X-ray Scattering Analysis
          </h1>
        </header>
      )}
      <div className="flex flex-1 w-full overflow-hidden">
        {/* First Column - Sidebar */}
        <div
          className={`border border-gray-300 bg-slate-200 shadow-lg relative transition-all duration-300 flex-shrink-0 flex flex-col h-full ${isSidebarCollapsed ? "w-[48px]" : "w-[280px]"}`}
        >
          {/* Scrollable Content Section */}
          <div className="grid gap-2 overflow-y-auto overflow-x-hidden p-2">
            {/* Experimental data section (non-accordion) */}
            <div className="flex-1 flex-row">
              {/* Header styled like accordion */}
              <div
                className={`flex items-center pb-2 text-sky-950 border-b border-gray-200 ${isSidebarCollapsed ? "justify-center" : "justify-between"}`}
              >
                {!isSidebarCollapsed && (
                  <div className="flex items-center gap-3">
                    <TreeStructureIcon size={24} weight="bold" />
                    <span className="text-lg font-semibold">
                      Experimental data
                    </span>
                  </div>
                )}
                <IconButton
                  variant="subtle"
                  size="md"
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                >
                  <ListIcon size={24} weight="bold" />
                </IconButton>
              </div>

              {/* Content */}
              {!isSidebarCollapsed && (
                <div className="grid pl-3 gap-2">
                  {/* Experiment Type */}
                  <Select
                    label="Experiment type"
                    value={experimentType}
                    onChange={(value) =>
                      handleExperimentTypeChange(
                        value,
                        setExperimentType,
                        setSelectedLinecuts
                      )
                    }
                    data={[
                      { value: "SAXS", label: "SAXS" },
                      { value: "GISAXS", label: "GISAXS" }
                    ]}
                  />

                  {/* Tiled Load Data */}
                  <div className="w-full [&_button]:w-full [&_button]:font-medium [&_button]:bg-sky-500 [&_button]:hover:bg-sky-600 [&_button]:ml-0 [&_button]:text-md [&_button]:rounded-xl [&_button]:py-2 [&_button]:px-3">
                    <Tiled
                      tiledBaseUrl={tiledUrl}
                      apiKey={tiledApiKey}
                      isButtonMode={true}
                      buttonModeText="Select data"
                      onSelectCallback={handleTiledSelection}
                    />
                  </div>

                  {/* Calibration Button */}
                  {numOfFiles &&
                  (!isCalibrationSet ||
                    (experimentType === "GISAXS" &&
                      !calibrationParams.incident_angle)) ? (
                    <ButtonWithIcon
                      icon={<WarningIcon weight="fill" size={24} />}
                      text={
                        !isCalibrationSet
                          ? "Calibration required"
                          : "Incident angle required"
                      }
                      bgColor="bg-amber-500"
                      hoverBgColor="hover:bg-amber-600"
                      cb={() => setIsCalibrationOpen(true)}
                      size="medium"
                      styles="w-full"
                    />
                  ) : (
                    <Button
                      size="medium"
                      styles="w-full disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                      cb={() => setIsCalibrationOpen(true)}
                      text="Calibration"
                      disabled={isFetchingData || !numOfFiles}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Linecuts Section */}
            {!isSidebarCollapsed && (
              <div className="pt-4">
                {/* Section Header */}
                <div className="flex items-center gap-3 pb-2 text-sky-950">
                  <CircleHalfTiltIcon size={24} weight="bold" />
                  <span className="text-lg font-semibold">Linecuts</span>
                </div>

                {/* Linecut Type Icons */}
                <div className="flex justify-around">
                  {linecutButtonsConfig
                    .filter(
                      ({ saxsOnly }) => !saxsOnly || experimentType === "SAXS"
                    )
                    .map(({ type, icon, addFn }) => (
                      <button
                        key={type}
                        className="flex flex-col items-center gap-1 p-1 rounded hover:bg-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={() => {
                          addLinecut(
                            type,
                            selectedLinecuts,
                            setSelectedLinecuts
                          );
                          addFn();
                        }}
                        disabled={
                          isFetchingData || !numOfFiles || !isCalibrationSet
                        }
                        title={
                          !isCalibrationSet
                            ? "Set calibration parameters first"
                            : undefined
                        }
                      >
                        <div className="w-8 h-8">{icon}</div>
                        <span className="text-xs text-slate-700">{type}</span>
                      </button>
                    ))}
                </div>

                {/* Render all selected LinecutSections */}
                <div className="w-full pl-3 mt-3">
                  {/* Batch Processing Button */}
                  <div className="my-3">
                    <Button
                      text="Batch Processing"
                      cb={() => setIsBatchOverlayOpen(true)}
                      size="small"
                      disabled={
                        !numOfFiles ||
                        !isCalibrationSet ||
                        (horizontalLinecuts.length === 0 &&
                          verticalLinecuts.length === 0 &&
                          inclinedLinecuts.length === 0 &&
                          azimuthalIntegrations.length === 0)
                      }
                      styles="w-full disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>

                  {linecutOrder
                    .filter((linecut) => selectedLinecuts.includes(linecut))
                    .map((linecutType) => {
                      if (
                        linecutType === "Horizontal" &&
                        horizontalLinecuts.length > 0
                      ) {
                        return (
                          <LinecutWidget
                            key={`linecut-section-${linecutType}`}
                            direction="horizontal"
                            linecutType={linecutType}
                            linecuts={horizontalLinecuts}
                            qMatrix={qYMatrix}
                            updatePosition={updateHorizontalLinecutPosition}
                            updateWidth={updateHorizontalLinecutWidth}
                            updateColor={updateHorizontalLinecutColor}
                            deleteLinecut={deleteHorizontalLinecut}
                            toggleVisibility={toggleHorizontalLinecutVisibility}
                          />
                        );
                      }

                      if (
                        linecutType === "Vertical" &&
                        verticalLinecuts.length > 0
                      ) {
                        return (
                          <LinecutWidget
                            key={`linecut-section-${linecutType}`}
                            direction="vertical"
                            linecutType={linecutType}
                            linecuts={verticalLinecuts}
                            qMatrix={qXMatrix}
                            updatePosition={updateVerticalLinecutPosition}
                            updateWidth={updateVerticalLinecutWidth}
                            updateColor={updateVerticalLinecutColor}
                            deleteLinecut={deleteVerticalLinecut}
                            toggleVisibility={toggleVerticalLinecutVisibility}
                          />
                        );
                      }

                      if (
                        linecutType === "Inclined" &&
                        inclinedLinecuts.length > 0
                      ) {
                        return (
                          <InclinedLinecutWidget
                            key={`linecut-section-${linecutType}`}
                            linecutType={linecutType}
                            linecuts={inclinedLinecuts}
                            units="nm⁻¹"
                            maxQWidth={maxQValue}
                            updateInclinedLinecutAngle={
                              updateInclinedLinecutAngle
                            }
                            updateInclinedLinecutWidth={
                              updateInclinedLinecutWidth
                            }
                            updateInclinedLinecutColor={
                              updateInclinedLinecutColor
                            }
                            deleteInclinedLinecut={deleteInclinedLinecut}
                            toggleInclinedLinecutVisibility={
                              toggleInclinedLinecutVisibility
                            }
                          />
                        );
                      }

                      // Azimuthal integration
                      if (
                        linecutType === "Azimuthal" &&
                        azimuthalIntegrations.length > 0
                      ) {
                        return (
                          <AzimuthalIntegrationWidget
                            key={`linecut-section-${linecutType}`}
                            integrations={azimuthalIntegrations}
                            maxQValue={maxQValue}
                            updateAzimuthalQRange={updateAzimuthalQRange}
                            updateAzimuthalRange={updateAzimuthalRange}
                            updateAzimuthalColor={updateAzimuthalColor}
                            deleteAzimuthalIntegration={
                              deleteAzimuthalIntegration
                            }
                            toggleAzimuthalVisibility={
                              toggleAzimuthalVisibility
                            }
                          />
                        );
                      }

                      return null;
                    })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Second Column - Main Content Area */}
        <div className="h-full flex-grow flex flex-col overflow-hidden p-2 gap-2 bg-slate-500">
          {/* Top Row - Scatter Images + Summary */}
          <div className="flex-1 flex overflow-hidden gap-2">
            {/* Scatter Images Card */}
            <ContentCard
              title="2D Scattering Data"
              className="flex-1"
              contentClassName="flex flex-col"
            >
              {/* Plots container */}
              <div className="flex-1 flex flex-col min-h-0">
                <H5WebScatterSubplot
                  // Image selection
                  leftImageIndex={leftImageIndex}
                  rightImageIndex={rightImageIndex}
                  onLeftIndexChange={setLeftImageIndex}
                  onRightIndexChange={setRightImageIndex}
                  scanUris={scanUris}
                  imageNames={imageNames}
                  isFetchingData={isFetchingData}
                  isLoadingImages={isLoadingImages}
                  setIsLoadingImages={setIsLoadingImages}
                  // Operation type
                  operationType={operationType}
                  onOperationTypeChange={setOperationType}
                  // Image data callbacks
                  setImageHeight={setImageHeight}
                  setImageWidth={setImageWidth}
                  setImageData1={setImageData1}
                  setImageData2={setImageData2}
                  // Linecuts and overlays
                  horizontalLinecuts={horizontalLinecuts}
                  verticalLinecuts={verticalLinecuts}
                  inclinedLinecuts={inclinedLinecuts}
                  azimuthalIntegrations={azimuthalIntegrations}
                  // Q-space data
                  qMagnitudeMatrix={qMagnitudeMatrix}
                  maxQValue={maxQValue}
                  calibrationParams={calibrationParams}
                  qYMatrix={qYMatrix}
                  qXMatrix={qXMatrix}
                  // Mask
                  maskUri={maskUri}
                  maskData={maskData}
                  maskShape={maskShape}
                  // Display options
                  experimentType={experimentType}
                  showQSpaceAxes={showQSpaceAxes}
                  setShowQSpaceAxes={setShowQSpaceAxes}
                  showMaskOverlay={showMaskOverlay}
                  setShowMaskOverlay={setShowMaskOverlay}
                  onGisaxsPixelQUpdate={setGisaxsQMatrices}
                  onZoomChange={handleHeatmapZoomChange}
                />
              </div>
            </ContentCard>

            {/* Summary Card */}
            <div
              className={`h-full flex-shrink-0 transition-all duration-300 ${isSummaryCollapsed ? "w-[48px]" : "w-[280px]"}`}
            >
              <ContentCard
                title={isSummaryCollapsed ? undefined : "Summary"}
                centerHeader={isSummaryCollapsed}
                headerChildren={
                  <IconButton
                    variant="subtle"
                    size="sm"
                    onClick={() => setIsSummaryCollapsed(!isSummaryCollapsed)}
                  >
                    <ListIcon size={24} className="text-sky-950" />
                  </IconButton>
                }
                className="h-full"
                contentClassName={
                  isSummaryCollapsed ? "hidden" : "flex flex-col px-4"
                }
              >
                <SummaryFig
                  maxIntensities={maxIntensities}
                  avgIntensities={avgIntensities}
                  leftImageIndex={leftImageIndex}
                  rightImageIndex={rightImageIndex}
                  onSelectImages={handleImageIndicesChange}
                  isFetchingData={isFetchingData}
                  displayOption={displayOption}
                  setDisplayOption={setDisplayOption}
                  imageNames={imageNames}
                  progress={progress}
                  progressMessage={progressMessage}
                />
              </ContentCard>
            </div>
          </div>

          {/* Bottom Row - Linecuts (each in separate cards) */}
          {/* Only show linecuts when image data is loaded */}
          {imageData1.length > 0 &&
            imageData2.length > 0 &&
            ((selectedLinecuts.includes("Horizontal") &&
              horizontalLinecuts.length > 0) ||
              (selectedLinecuts.includes("Vertical") &&
                verticalLinecuts.length > 0) ||
              (selectedLinecuts.includes("Inclined") &&
                inclinedLinecuts.length > 0) ||
              (experimentType === "SAXS" &&
                selectedLinecuts.includes("Azimuthal") &&
                azimuthalIntegrations.length > 0)) && (
              <div className="flex gap-2 h-[320px] flex-shrink-0 overflow-x-auto">
                {/* Horizontal Linecut Card */}
                {selectedLinecuts.includes("Horizontal") &&
                  horizontalLinecuts.length > 0 && (
                    <ContentCard
                      title="Horizontal Linecuts"
                      className="flex-1"
                      contentClassName="p-2 relative"
                      isLoading={loadingHorizontalLinecuts.size > 0}
                    >
                      <LinecutFig
                        direction="horizontal"
                        linecuts={horizontalLinecuts}
                        zoomedXPixelRange={zoomedXPixelRange}
                        zoomedYPixelRange={zoomedYPixelRange}
                        qXMatrix={qXMatrix}
                        qYMatrix={qYMatrix}
                        units="nm⁻¹"
                        leftLinecutData={horizontalLeftData}
                        rightLinecutData={horizontalRightData}
                      />
                    </ContentCard>
                  )}

                {/* Vertical Linecut Card */}
                {selectedLinecuts.includes("Vertical") &&
                  verticalLinecuts.length > 0 && (
                    <ContentCard
                      title="Vertical Linecuts"
                      className="flex-1"
                      contentClassName="p-2 relative"
                      isLoading={loadingVerticalLinecuts.size > 0}
                    >
                      <LinecutFig
                        direction="vertical"
                        linecuts={verticalLinecuts}
                        zoomedXPixelRange={zoomedXPixelRange}
                        zoomedYPixelRange={zoomedYPixelRange}
                        qXMatrix={qXMatrix}
                        qYMatrix={qYMatrix}
                        units="nm⁻¹"
                        leftLinecutData={verticalLeftData}
                        rightLinecutData={verticalRightData}
                      />
                    </ContentCard>
                  )}

                {/* Inclined Linecut Card */}
                {selectedLinecuts.includes("Inclined") &&
                  inclinedLinecuts.length > 0 && (
                    <ContentCard
                      title="Inclined Linecuts"
                      className="flex-1"
                      contentClassName="p-2 relative"
                      isLoading={loadingInclinedLinecuts.size > 0}
                    >
                      <InclinedLinecutFig
                        linecuts={inclinedLinecuts}
                        leftLinecutData={inclinedLeftLinecutData}
                        rightLinecutData={inclinedRightLinecutData}
                        beamCenterX={calibrationParams?.beam_center_x}
                        beamCenterY={calibrationParams?.beam_center_y}
                        zoomedXPixelRange={zoomedXPixelRange}
                        zoomedYPixelRange={zoomedYPixelRange}
                        qXVector={qXVector}
                        qYVector={qYVector}
                        units="nm⁻¹"
                      />
                    </ContentCard>
                  )}

                {/* Azimuthal Integration Card */}
                {experimentType === "SAXS" &&
                  selectedLinecuts.includes("Azimuthal") &&
                  azimuthalIntegrations.length > 0 && (
                    <ContentCard
                      title="Azimuthal Integrations"
                      className="flex-1"
                      contentClassName="p-2 relative"
                      isLoading={loadingAzimuthalIntegrations.size > 0}
                    >
                      <AzimuthalIntegrationFig
                        integrations={azimuthalIntegrations}
                        azimuthalData1={azimuthalData1}
                        azimuthalData2={azimuthalData2}
                        zoomedXPixelRange={zoomedXPixelRange}
                        zoomedYPixelRange={zoomedYPixelRange}
                        qMagnitudeMatrix={qMagnitudeMatrix}
                      />
                    </ContentCard>
                  )}
              </div>
            )}
        </div>
      </div>

      {/* Calibration Overlay */}
      <Modal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        title="Calibration parameters"
        titleIcon={<WrenchIcon size={24} weight="bold" />}
        showCloseButton={false}
      >
        <CalibrationWidget
          onCalibrationUpdate={handleCalibrationUpdate}
          calibrationParams={calibrationParams}
          experimentType={experimentType}
          maskUri={maskUri}
          onMaskUpdate={setMaskUri}
          onMaskDataUpdate={updateMaskData}
          expectedImageWidth={imageWidth}
          expectedImageHeight={imageHeight}
        />
      </Modal>

      {/* Batch Processing Overlay */}
      <BatchProcessingWidget
        isOpen={isBatchOverlayOpen}
        onClose={() => setIsBatchOverlayOpen(false)}
        horizontalLinecuts={horizontalLinecuts}
        verticalLinecuts={verticalLinecuts}
        inclinedLinecuts={inclinedLinecuts}
        azimuthalIntegrations={azimuthalIntegrations}
        scanUris={scanUris}
        scanNames={imageNames}
        selectedScanUris={batchProcessing.selectedScanUris}
        setSelectedScanUris={batchProcessing.setSelectedScanUris}
        activeTab={batchProcessing.activeTab}
        setActiveTab={batchProcessing.setActiveTab}
        activeLinecutId={batchProcessing.activeLinecutId}
        setActiveLinecutId={batchProcessing.setActiveLinecutId}
        results={batchProcessing.results}
        resultCounts={batchProcessing.resultCounts}
        currentResult={batchProcessing.currentResult}
        isStale={batchProcessing.isStale}
        hasStaleResults={batchProcessing.hasStaleResults}
        isProcessing={batchProcessing.isProcessing}
        progress={batchProcessing.progress}
        progressMessage={batchProcessing.progressMessage}
        isSelectorOpen={batchProcessing.isSelectorOpen}
        setIsSelectorOpen={batchProcessing.setIsSelectorOpen}
        runBatchAll={batchProcessing.runBatchAll}
        onCancel={batchProcessing.cancelBatch}
        experimentType={experimentType}
      />
    </div>
  );
}
