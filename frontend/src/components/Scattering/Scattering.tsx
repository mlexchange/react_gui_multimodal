import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Select, IconButton, Tooltip, notifications } from "@/components/ui";
import { ContentCard, Modal } from "@/components/shared";
import {
  CameraIcon,
  CircleHalfTiltIcon,
  DownloadSimpleIcon,
  FloppyDiskIcon,
  InfoIcon,
  ListIcon,
  TreeStructureIcon,
  WarningIcon,
  WrenchIcon
} from "@phosphor-icons/react";
import type {
  CalibrationParams,
  OperationType,
  Linecut,
  InclinedLinecut,
  AzimuthalIntegration,
  LinecutData,
  InclinedLinecutData,
  AzimuthalData,
  LinecutDataEntry,
  SavedToTiledItem
} from "./types";

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
import SavedToTiledItemPopup from "./SavedToTiledItemPopup";

// Import utilities
import {
  handleExperimentTypeChange,
  addLinecut
} from "./utils/linecutHandlers";
import { captureSnapshot } from "./utils/snapshot";
import { useInfrastructure } from "./services/infrastructureApi";
import { addSavedToTiledItem } from "./services/savedToTiledItemsStore";
import {
  saveLinecutsToTiled,
  buildLinecutParams,
  buildInclinedLinecutParams,
  buildAzimuthalParams
} from "./services/saveResultsApi";
import {
  exportLinecutsToCSV,
  exportInclinedLinecutsToCSV,
  exportAzimuthalToCSV
} from "./utils/csvExport";

// Import assets
import alsLogo from "@/assets/als-logo.png";
import { scatteringIcons } from "./icons";

const tiledUrl = import.meta.env.SCATTERING_TILED_URL;
const tiledApiKey = import.meta.env.SCATTERING_TILED_API_KEY;

const LINECUT_ORDER = [
  "Horizontal",
  "Vertical",
  "Inclined",
  "Azimuthal"
] as const;

interface ScatteringProps {
  standalone?: boolean;
  /** When false, hides Tiled calibration loading and forces manual-only input. */
  enableTiledCalibration?: boolean;
}

export default function Scattering({
  standalone = false,
  enableTiledCalibration
}: ScatteringProps) {
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
  const [operationType, setOperationType] = useState<OperationType>("subtract");
  const [isBatchOverlayOpen, setIsBatchOverlayOpen] = useState(false);
  const [savedToTiledItemPopup, setSavedToTiledItemPopup] =
    useState<SavedToTiledItem | null>(null);

  // Check which infrastructure features are available
  const {
    tiledCalibrationEnabled: backendTiledCalibrationEnabled,
    tiledResultsEnabled: saveResultsEnabled
  } = useInfrastructure();

  // Session persistence hook
  const { isRestoring, hasRestoredSession, restoredSession, triggerAutoSave } =
    useSessionPersistence();

  // Track if session has been applied
  const hasAppliedSession = useRef(false);

  // Track if Q-space was auto-toggled (to avoid re-toggling after user manually turns it off)
  const hasAutoToggledQSpace = useRef(false);

  // Track previous experiment type to detect changes
  const prevExperimentTypeRef = useRef<string | null>(null);

  // Track if experiment type change should be ignored (e.g., during session restoration)
  const skipNextExperimentTypeChange = useRef(false);

  // Refs for linecut figure snapshots
  const horizontalLinecutRef = useRef<HTMLDivElement>(null);
  const verticalLinecutRef = useRef<HTMLDivElement>(null);
  const inclinedLinecutRef = useRef<HTMLDivElement>(null);
  const azimuthalIntegrationRef = useRef<HTMLDivElement>(null);

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

  // Calculate Q step size from actual spacing (use minimum of X and Y for inclined linecuts)
  const qStep = useMemo(() => {
    const qXStep =
      qXVector.length >= 2 ? Math.abs(qXVector[1] - qXVector[0]) : 0.1;
    const qYStep =
      qYVector.length >= 2 ? Math.abs(qYVector[1] - qYVector[0]) : 0.1;
    return Math.min(qXStep, qYStep) || 0.1;
  }, [qXVector, qYVector]);

  // Snapshot handler for linecut figures
  const handleLinecutSnapshot = useCallback(
    async (ref: React.RefObject<HTMLDivElement>, name: string) => {
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:-]/g, "");
      await captureSnapshot(ref.current, {
        filename: `${name}-${timestamp}`,
        yAxisLabelOffset: 27
      });
    },
    []
  );

  // Reusable header buttons for ContentCard (snapshot + download + optional save)
  const renderHeaderButtons = useCallback(
    (
      ref: React.RefObject<HTMLDivElement>,
      name: string,
      onDownload: () => void,
      onSave?: () => void
    ) => (
      <div className="flex items-center gap-1">
        {saveResultsEnabled && onSave && (
          <button
            onClick={onSave}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Save to Tiled"
            aria-label="Save to Tiled"
          >
            <FloppyDiskIcon size={20} className="text-sky-950" />
          </button>
        )}
        <button
          onClick={onDownload}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Download CSV"
          aria-label="Download CSV"
        >
          <DownloadSimpleIcon size={20} className="text-sky-950" />
        </button>
        <button
          onClick={() => handleLinecutSnapshot(ref, name)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Snapshot"
          aria-label="Snapshot"
        >
          <CameraIcon size={20} className="text-sky-950" />
        </button>
      </div>
    ),
    [handleLinecutSnapshot, saveResultsEnabled]
  );

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
  const leftScanUri = useMemo(
    () =>
      leftImageIndex !== "" && scanUris.length > 0
        ? scanUris[leftImageIndex]
        : null,
    [leftImageIndex, scanUris]
  );
  const rightScanUri = useMemo(
    () =>
      rightImageIndex !== "" && scanUris.length > 0
        ? scanUris[rightImageIndex]
        : null,
    [rightImageIndex, scanUris]
  );

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

  // Scan names for left/right images (used for saving to Tiled)
  const leftScanName = useMemo(
    () =>
      leftImageIndex !== "" && imageNames.length > 0
        ? imageNames[leftImageIndex]
        : null,
    [leftImageIndex, imageNames]
  );
  const rightScanName = useMemo(
    () =>
      rightImageIndex !== "" && imageNames.length > 0
        ? imageNames[rightImageIndex]
        : null,
    [rightImageIndex, imageNames]
  );

  // Save horizontal/vertical linecuts to Tiled handler
  const handleSaveLinecuts = useCallback(
    async (
      linecuts: Linecut[],
      direction: "horizontal" | "vertical",
      leftData: Map<number, LinecutData>,
      rightData: Map<number, LinecutData>
    ) => {
      if (!calibrationParams) return;
      const visible = linecuts.filter((l) => !l.hidden);
      if (visible.length === 0) return;

      const firstData =
        leftData.get(visible[0].id) ?? rightData.get(visible[0].id);
      if (!firstData) return;

      const notificationId = `save-tiled-${direction}`;
      notifications.show({
        id: notificationId,
        loading: true,
        title: "Saving to Tiled",
        message: `Saving ${direction.charAt(0).toUpperCase() + direction.slice(1)} linecuts...`,
        autoClose: false
      });

      try {
        const entries: LinecutDataEntry[] = visible.map((lc, idx) => ({
          index: idx + 1,
          linecut_params: buildLinecutParams(lc, direction),
          left_intensities: leftData.get(lc.id)?.intensities,
          right_intensities: rightData.get(lc.id)?.intensities
        }));

        const result = await saveLinecutsToTiled({
          scanUris: [leftScanUri, rightScanUri].filter((u): u is string => !!u),
          scanNames: [leftScanName, rightScanName].filter(
            (n): n is string => !!n
          ),
          calibration: calibrationParams,
          experimentType,
          qValues: firstData.qValues,
          linecuts: entries
        });

        notifications.update({
          id: notificationId,
          color: "green",
          title: "Saved to Tiled",
          message: `${direction.charAt(0).toUpperCase() + direction.slice(1)} linecuts saved successfully`,
          autoClose: 3000
        });

        if (result.tiled_id && result.tiled_uri) {
          const item: SavedToTiledItem = {
            id: result.tiled_id,
            uri: result.tiled_uri,
            type: direction,
            label: result.message,
            timestamp: Date.now()
          };
          addSavedToTiledItem(item);
          setSavedToTiledItemPopup(item);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        notifications.update({
          id: notificationId,
          color: "red",
          title: "Save Failed",
          message: msg,
          autoClose: 5000
        });
      }
    },
    [
      calibrationParams,
      experimentType,
      leftScanUri,
      rightScanUri,
      leftScanName,
      rightScanName
    ]
  );

  // Save inclined linecuts to Tiled handler
  const handleSaveInclinedLinecuts = useCallback(
    async (
      linecuts: InclinedLinecut[],
      leftData: Map<number, InclinedLinecutData>,
      rightData: Map<number, InclinedLinecutData>
    ) => {
      if (!calibrationParams) return;
      const visible = linecuts.filter((l) => !l.hidden);
      if (visible.length === 0) return;

      const firstData =
        leftData.get(visible[0].id) ?? rightData.get(visible[0].id);
      if (!firstData) return;

      const notificationId = "save-tiled-inclined";
      notifications.show({
        id: notificationId,
        loading: true,
        title: "Saving to Tiled",
        message: "Saving inclined linecuts...",
        autoClose: false
      });

      try {
        const entries: LinecutDataEntry[] = visible.map((lc, idx) => ({
          index: idx + 1,
          linecut_params: buildInclinedLinecutParams(lc),
          left_intensities: leftData.get(lc.id)?.intensities,
          right_intensities: rightData.get(lc.id)?.intensities
        }));

        const result = await saveLinecutsToTiled({
          scanUris: [leftScanUri, rightScanUri].filter((u): u is string => !!u),
          scanNames: [leftScanName, rightScanName].filter(
            (n): n is string => !!n
          ),
          calibration: calibrationParams,
          experimentType,
          qValues: firstData.pathDistances,
          linecuts: entries
        });

        notifications.update({
          id: notificationId,
          color: "green",
          title: "Saved to Tiled",
          message: "Inclined linecuts saved successfully",
          autoClose: 3000
        });

        if (result.tiled_id && result.tiled_uri) {
          const item: SavedToTiledItem = {
            id: result.tiled_id,
            uri: result.tiled_uri,
            type: "inclined",
            label: result.message,
            timestamp: Date.now()
          };
          addSavedToTiledItem(item);
          setSavedToTiledItemPopup(item);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        notifications.update({
          id: notificationId,
          color: "red",
          title: "Save Failed",
          message: msg,
          autoClose: 5000
        });
      }
    },
    [
      calibrationParams,
      experimentType,
      leftScanUri,
      rightScanUri,
      leftScanName,
      rightScanName
    ]
  );

  // Save azimuthal integrations to Tiled handler
  const handleSaveAzimuthalIntegrations = useCallback(
    async (
      integrations: AzimuthalIntegration[],
      data1: AzimuthalData[],
      data2: AzimuthalData[]
    ) => {
      if (!calibrationParams) return;
      const visible = integrations.filter((i) => !i.hidden);
      if (visible.length === 0) return;

      const firstData =
        data1.find((d) => d.id === visible[0].id) ??
        data2.find((d) => d.id === visible[0].id);
      if (!firstData) return;

      const notificationId = "save-tiled-azimuthal";
      notifications.show({
        id: notificationId,
        loading: true,
        title: "Saving to Tiled",
        message: "Saving azimuthal integrations...",
        autoClose: false
      });

      try {
        const entries: LinecutDataEntry[] = visible.map((integ, idx) => ({
          index: idx + 1,
          linecut_params: buildAzimuthalParams(integ),
          left_intensities: data1.find((d) => d.id === integ.id)?.intensity,
          right_intensities: data2.find((d) => d.id === integ.id)?.intensity
        }));

        const result = await saveLinecutsToTiled({
          scanUris: [leftScanUri, rightScanUri].filter((u): u is string => !!u),
          scanNames: [leftScanName, rightScanName].filter(
            (n): n is string => !!n
          ),
          calibration: calibrationParams,
          experimentType,
          qValues: firstData.q,
          linecuts: entries
        });

        notifications.update({
          id: notificationId,
          color: "green",
          title: "Saved to Tiled",
          message: "Azimuthal integrations saved successfully",
          autoClose: 3000
        });

        if (result.tiled_id && result.tiled_uri) {
          const item: SavedToTiledItem = {
            id: result.tiled_id,
            uri: result.tiled_uri,
            type: "azimuthal",
            label: result.message,
            timestamp: Date.now()
          };
          addSavedToTiledItem(item);
          setSavedToTiledItemPopup(item);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        notifications.update({
          id: notificationId,
          color: "red",
          title: "Save Failed",
          message: msg,
          autoClose: 5000
        });
      }
    },
    [
      calibrationParams,
      experimentType,
      leftScanUri,
      rightScanUri,
      leftScanName,
      rightScanName
    ]
  );

  // Get image dimensions from imageData1 (assumes both images have same dimensions)
  const imageHeight = useMemo(() => imageData1.length, [imageData1]);
  const imageWidth = useMemo(() => imageData1[0]?.length || 0, [imageData1]);

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

  // ========== EXPERIMENT TYPE CHANGE HANDLER ==========
  // Reset linecuts and Q-space toggle when experiment type changes (user-initiated only)
  useEffect(() => {
    // Skip if flagged to ignore (e.g., during session restoration)
    if (skipNextExperimentTypeChange.current) {
      skipNextExperimentTypeChange.current = false;
      prevExperimentTypeRef.current = experimentType;
      return;
    }

    // Initialize ref on first render
    if (prevExperimentTypeRef.current === null) {
      prevExperimentTypeRef.current = experimentType;
      return;
    }

    // Skip if experiment type hasn't changed
    if (prevExperimentTypeRef.current === experimentType) {
      return;
    }

    console.log(
      `Experiment type changed from ${prevExperimentTypeRef.current} to ${experimentType}, clearing linecuts`
    );

    // Clear all linecuts
    restoreHorizontalLinecuts([]);
    restoreVerticalLinecuts([]);
    restoreInclinedLinecuts([]);
    restoreAzimuthalIntegrations([]);

    // Reset Q-space auto-toggle flag so it can trigger again with new calibration
    hasAutoToggledQSpace.current = false;

    // Update ref
    prevExperimentTypeRef.current = experimentType;
  }, [
    experimentType,
    restoreHorizontalLinecuts,
    restoreVerticalLinecuts,
    restoreInclinedLinecuts,
    restoreAzimuthalIntegrations
  ]);

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

    // Mark that the next experiment type change should be ignored (it's from session restoration)
    skipNextExperimentTypeChange.current = true;

    // 1. Restore scattering state (experiment type, calibration, selectedLinecuts, maskUri, showQSpaceAxes)
    restoreScatteringState({
      experimentType: restoredSession.experimentType,
      selectedLinecuts: restoredSession.selectedLinecuts,
      calibrationParams: restoredSession.calibrationParams ?? undefined,
      maskUri: restoredSession.maskUri,
      showQSpaceAxes: restoredSession.showQSpaceAxes
    });

    // 2. Mark Q-space as already toggled to respect user's saved preference
    hasAutoToggledQSpace.current = true;

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

  // ========== AUTO-TOGGLE Q-SPACE ==========
  // Automatically enable Q-space view when Q matrices become available
  useEffect(() => {
    // Skip if already auto-toggled, still restoring, or Q data not ready
    if (hasAutoToggledQSpace.current || isRestoring) return;

    // Check if Q matrices have data
    const hasQData = qXMatrix.length > 0 && qXMatrix[0]?.length > 0;
    if (!hasQData) return;

    // Auto-toggle Q-space on
    setShowQSpaceAxes(true);
    hasAutoToggledQSpace.current = true;
  }, [qXMatrix, isRestoring, setShowQSpaceAxes]);

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

  const handleCalibrationUpdate = useCallback(
    async (params: CalibrationParams) => {
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
          errorMessage =
            "An unexpected error occurred during calibration update";
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
    },
    [updateCalibration]
  );

  const linecutButtonsConfig = useMemo(
    () => [
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
    ],
    [
      addHorizontalLinecut,
      addVerticalLinecut,
      addInclinedLinecut,
      addAzimuthalIntegration
    ]
  );

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
                  tooltip={
                    isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                  }
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
                      buttonModeText="Select Data"
                      onSelectCallback={handleTiledSelection}
                    />
                  </div>

                  {/* Calibration Button */}
                  {numOfFiles &&
                  (!isCalibrationSet ||
                    (experimentType === "GISAXS" &&
                      !calibrationParams?.incident_angle)) ? (
                    <ButtonWithIcon
                      icon={
                        <span className="flex items-center justify-center h-full">
                          <WarningIcon weight="fill" size={20} />
                        </span>
                      }
                      text="Calibration required"
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
                  <Tooltip
                    content={
                      <div className="max-w-xs space-y-2 text-sm">
                        <p>
                          <strong>Linecut widths:</strong> The selected width{" "}
                          <i>w</i> covers <i>&minus;w/2</i> to <i>+w/2</i>{" "}
                          relative to the central <i>q</i> point.
                        </p>
                        <p>
                          <strong>Inclined linecut:</strong> This is an
                          experimental feature.
                        </p>
                      </div>
                    }
                    side="right"
                  >
                    <InfoIcon
                      size={24}
                      className="ml-auto cursor-help transition-colors"
                    />
                  </Tooltip>
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

                  {LINECUT_ORDER.filter((linecut) =>
                    selectedLinecuts.includes(linecut)
                  ).map((linecutType) => {
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
                          qStep={qStep}
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
                          qStep={qStep}
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
                          qStep={qStep}
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
                          qStep={qStep}
                          updateAzimuthalQRange={updateAzimuthalQRange}
                          updateAzimuthalRange={updateAzimuthalRange}
                          updateAzimuthalColor={updateAzimuthalColor}
                          deleteAzimuthalIntegration={
                            deleteAzimuthalIntegration
                          }
                          toggleAzimuthalVisibility={toggleAzimuthalVisibility}
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
                    tooltip={
                      isSummaryCollapsed ? "Expand summary" : "Collapse summary"
                    }
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
                      headerChildren={renderHeaderButtons(
                        horizontalLinecutRef,
                        "horizontal-linecut",
                        () =>
                          exportLinecutsToCSV(
                            horizontalLinecuts,
                            horizontalLeftData,
                            horizontalRightData,
                            "horizontal"
                          ),
                        () =>
                          handleSaveLinecuts(
                            horizontalLinecuts,
                            "horizontal",
                            horizontalLeftData,
                            horizontalRightData
                          )
                      )}
                    >
                      <LinecutFig
                        ref={horizontalLinecutRef}
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
                      headerChildren={renderHeaderButtons(
                        verticalLinecutRef,
                        "vertical-linecut",
                        () =>
                          exportLinecutsToCSV(
                            verticalLinecuts,
                            verticalLeftData,
                            verticalRightData,
                            "vertical"
                          ),
                        () =>
                          handleSaveLinecuts(
                            verticalLinecuts,
                            "vertical",
                            verticalLeftData,
                            verticalRightData
                          )
                      )}
                    >
                      <LinecutFig
                        ref={verticalLinecutRef}
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
                      headerChildren={renderHeaderButtons(
                        inclinedLinecutRef,
                        "inclined-linecut",
                        () =>
                          exportInclinedLinecutsToCSV(
                            inclinedLinecuts,
                            inclinedLeftLinecutData,
                            inclinedRightLinecutData
                          ),
                        () =>
                          handleSaveInclinedLinecuts(
                            inclinedLinecuts,
                            inclinedLeftLinecutData,
                            inclinedRightLinecutData
                          )
                      )}
                    >
                      <InclinedLinecutFig
                        ref={inclinedLinecutRef}
                        linecuts={inclinedLinecuts}
                        leftLinecutData={inclinedLeftLinecutData}
                        rightLinecutData={inclinedRightLinecutData}
                        beamCenterX={calibrationParams?.beam_center_x ?? 0}
                        beamCenterY={calibrationParams?.beam_center_y ?? 0}
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
                      headerChildren={renderHeaderButtons(
                        azimuthalIntegrationRef,
                        "azimuthal-integration",
                        () =>
                          exportAzimuthalToCSV(
                            azimuthalIntegrations,
                            azimuthalData1,
                            azimuthalData2
                          ),
                        () =>
                          handleSaveAzimuthalIntegrations(
                            azimuthalIntegrations,
                            azimuthalData1,
                            azimuthalData2
                          )
                      )}
                    >
                      <AzimuthalIntegrationFig
                        ref={azimuthalIntegrationRef}
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
          tiledCalibrationEnabled={
            enableTiledCalibration !== false && backendTiledCalibrationEnabled
          }
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
        saveResultsEnabled={saveResultsEnabled}
        calibrationParams={calibrationParams}
        onSavedToTiledItem={(item: SavedToTiledItem) => {
          addSavedToTiledItem(item);
          setSavedToTiledItemPopup(item);
        }}
      />

      {/* Saved to Tiled Item Popup */}
      {savedToTiledItemPopup && (
        <SavedToTiledItemPopup
          item={savedToTiledItemPopup}
          onClose={() => setSavedToTiledItemPopup(null)}
        />
      )}
    </div>
  );
}
