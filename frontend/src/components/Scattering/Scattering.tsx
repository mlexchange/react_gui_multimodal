import { useState, useEffect, useRef } from 'react';
import { Select, Menu, Popover, IconButton, notifications } from '@/components/ui';
import { PrevNextSelect, ContentCard, LoadingOverlay, Modal } from '@/components/shared';
import { CircleHalfTiltIcon, GearIcon, GitDiffIcon, InfoIcon, ListIcon, StackIcon, TreeStructureIcon, WarningIcon, WrenchIcon } from '@phosphor-icons/react';
import { CalibrationParams } from './types';

import { Button, ButtonWithIcon } from '@blueskyproject/finch';
import { Tiled } from '@blueskyproject/tiled';
import '@blueskyproject/tiled/style.css';
import './styles.css';

// Import hooks
import useScattering from './hooks/useScattering';
import useAzimuthalIntegration from './hooks/useAzimuthalIntegration';
import useHorizontalLinecut from './hooks/useHorizontalLinecut';
import useVerticalLinecut from './hooks/useVerticalLinecut';
import useInclinedLinecut from './hooks/useInclinedLinecut';
import useDataTransformation from './hooks/useDataTransformation';
import useSummary from './hooks/useSummary';
import useSessionPersistence, { PersistableState } from './hooks/useSessionPersistence';
import useBatchProcessing from './hooks/useBatchProcessing';

// Import components
import ScatterSubplot, { OperationType } from './ScatterSubplot';
import H5WebScatterSubplot from './H5WebScatterSubplot';

// Toggle between Plotly and H5Web implementations
const USE_H5WEB = true;
import LinecutWidget from './LinecutWidget';
import InclinedLinecutWidget from './InclinedLinecutWidget';
import AzimuthalIntegrationWidget from './AzimuthalIntegrationWidget';
import DataTransformationAccordion from './DataTransformationAccordion';
import CalibrationAccordion from './CalibrationAccordion';
import LinecutFig from './LinecutFig';
import InclinedLinecutFig from './InclinedLinecutFig';
import AzimuthalIntegrationFig from './AzimuthalIntegrationFig';
import SummaryFig from './SummaryFig';
import { BatchProcessingOverlay } from './BatchProcessingOverlay';

// Import utilities
import { handleExperimentTypeChange, addLinecut } from './utils/linecutHandlers';
import { leftImageColorPalette, rightImageColorPalette } from './utils/constants';
import { fetchQVectors } from './services/linecutApi';

// Import assets
import alsLogo from '@/assets/als-logo.png';
import { scatteringIcons } from './icons';

const tiledUrl = import.meta.env.SCATTERING_TILED_URL;
const tiledApiKey = import.meta.env.SCATTERING_TILED_API_KEY;

interface ScatteringProps {
  standalone?: boolean;
}

export default function Scattering({ standalone = false }: ScatteringProps) {
  const linecutOrder = ['Horizontal', 'Vertical', 'Inclined', 'Azimuthal'];
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
  const [operationType, setOperationType] = useState<OperationType>('subtract');
  const [isBatchOverlayOpen, setIsBatchOverlayOpen] = useState(false);

  // Session persistence hook
  const {
    isRestoring,
    hasRestoredSession,
    restoredSession,
    triggerAutoSave,
  } = useSessionPersistence();

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
    resolutionMessage,
    setResolutionMessage,
    calibrationParams,
    updateCalibration,
    isCalibrationSet,
    qXMatrix,
    qYMatrix,
    maskUri,
    setMaskUri,
    restoreState: restoreScatteringState,
  } = useScattering();

  // get the first row of qXMatrix as qXVector
  const qXVector = qXMatrix[0];
  // get the first column of qYMatrix as qYVector
  const qYVector = qYMatrix.map(row => row[0]);


  const {
    isLogScale,
    setIsLogScale,
    lowerPercentile,
    setLowerPercentile,
    upperPercentile,
    setUpperPercentile,
    normalization,
    setNormalization,
    imageColormap,
    setImageColormap,
    differenceColormap,
    setDifferenceColormap,
    normalizationMode,
    setNormalizationMode,
    mainTransformDataFunction,
    restoreSettings: restoreDisplaySettings,
  } = useDataTransformation();


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
    setDisplayOption,

  } = useSummary();

  // Get scan URIs for selected images
  // These will be used for azimuthal integration API calls
  const leftScanUri = (leftImageIndex !== "" && scanUris.length > 0) ? scanUris[leftImageIndex] : null;
  const rightScanUri = (rightImageIndex !== "" && scanUris.length > 0) ? scanUris[rightImageIndex] : null;

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
    restoreLinecuts: restoreHorizontalLinecuts,
  } = useHorizontalLinecut({
    qYMatrix,
    leftScanUri,
    rightScanUri,
    calibrationParams,
    experimentType,
    maskUri,
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
    restoreLinecuts: restoreVerticalLinecuts,
  } = useVerticalLinecut({
    qXMatrix,
    leftScanUri,
    rightScanUri,
    calibrationParams,
    experimentType,
    maskUri,
  });

  const {
    inclinedLinecuts,
    inclinedLinecutData1,
    inclinedLinecutData2,
    loadingInclinedLinecuts,
    addInclinedLinecut,
    updateInclinedLinecutAngle,
    updateInclinedLinecutWidth,
    updateInclinedLinecutColor,
    deleteInclinedLinecut,
    toggleInclinedLinecutVisibility,
    restoreLinecuts: restoreInclinedLinecuts,
    zoomedXQRange,
  } = useInclinedLinecut({
    qXVector,
    qYVector,
    zoomedXPixelRange,
    zoomedYPixelRange,
    leftScanUri,
    rightScanUri,
    calibrationParams,
    experimentType,
    maskUri,
  });

  const {
      azimuthalIntegrations,
      azimuthalData1,
      azimuthalData2,
      maxQValue,
      loadingAzimuthalIntegrations,
      addAzimuthalIntegration,
      updateAzimuthalQRange,
      updateAzimuthalRange,
      updateAzimuthalColor,
      deleteAzimuthalIntegration,
      toggleAzimuthalVisibility,
      restoreIntegrations: restoreAzimuthalIntegrations,
  } = useAzimuthalIntegration(calibrationParams, leftScanUri, rightScanUri, maskUri);

  // Q-magnitude matrix for azimuthal overlay rendering
  // This is cached and only refetched when calibration or image dimensions change
  const [qMagnitudeMatrix, setQMagnitudeMatrix] = useState<number[][] | null>(null);
  const [qMagnitudeCacheKey, setQMagnitudeCacheKey] = useState<string>('');

  // Get image dimensions from imageData1 (assumes both images have same dimensions)
  const imageHeight = imageData1.length;
  const imageWidth = imageData1[0]?.length || 0;

  // Fetch Q-magnitude matrix when calibration or dimensions change
  useEffect(() => {
    if (!calibrationParams || imageWidth === 0 || imageHeight === 0) {
      return;
    }

    // Generate cache key from calibration and dimensions
    const cacheKey = JSON.stringify({
      calibration: calibrationParams,
      width: imageWidth,
      height: imageHeight,
    });

    // Skip if we already have this cached
    if (cacheKey === qMagnitudeCacheKey) {
      return;
    }

    // Fetch Q-vectors and compute Q-magnitude
    fetchQVectors({
      calibration: calibrationParams,
      experimentType,
      imageWidth,
      imageHeight,
    })
      .then(({ q_x, q_y }) => {
        // Compute Q magnitude: sqrt(qX² + qY²)
        const qMag = q_x.map((row, y) =>
          row.map((qx, x) => Math.sqrt(qx * qx + q_y[y][x] * q_y[y][x]))
        );
        setQMagnitudeMatrix(qMag);
        setQMagnitudeCacheKey(cacheKey);
      })
      .catch((error) => {
        console.error('Failed to fetch Q-vectors for overlay:', error);
      });
  }, [calibrationParams, experimentType, imageWidth, imageHeight, qMagnitudeCacheKey]);

  // Batch processing hook
  const batchProcessing = useBatchProcessing({
    calibrationParams,
    experimentType,
    horizontalLinecuts,
    verticalLinecuts,
    inclinedLinecuts,
    azimuthalIntegrations,
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
    console.log('Restoring session state...');

    // 1. Restore display settings first (doesn't depend on data)
    restoreDisplaySettings(restoredSession.displaySettings);

    // 2. Restore multimodal state (experiment type, calibration, selectedLinecuts)
    restoreScatteringState({
      experimentType: restoredSession.experimentType,
      selectedLinecuts: restoredSession.selectedLinecuts,
      calibrationParams: restoredSession.calibrationParams,
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
    console.log('Session restored successfully');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isRestoring,
    hasRestoredSession,
    restoredSession,
    restoreDisplaySettings,
    restoreScatteringState,
    restoreHorizontalLinecuts,
    restoreVerticalLinecuts,
    restoreInclinedLinecuts,
    restoreAzimuthalIntegrations,
    batchProcessing.restoreState,
    setSelectedContainerPath,
    fetchSummaryData,
    setLeftImageIndex,
    setRightImageIndex,
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
      experimentType: experimentType as 'SAXS' | 'GISAXS',
      calibrationParams,
      displaySettings: {
        isLogScale,
        lowerPercentile,
        upperPercentile,
        normalization,
        imageColormap,
        differenceColormap,
        normalizationMode,
      },
      horizontalLinecuts,
      verticalLinecuts,
      inclinedLinecuts,
      selectedLinecuts,
      azimuthalIntegrations,
      isSidebarCollapsed,
      isSummaryCollapsed,
      operationType,
      // Batch processing state
      batchResults: batchProcessing.results,
      batchParameterHashes: batchProcessing.parameterHashes,
      batchSelectedScanUris: batchProcessing.selectedScanUris,
    };

    triggerAutoSave(persistableState);
  }, [
    isRestoring,
    selectedContainerPath,
    leftImageIndex,
    rightImageIndex,
    experimentType,
    calibrationParams,
    isLogScale,
    lowerPercentile,
    upperPercentile,
    normalization,
    imageColormap,
    differenceColormap,
    normalizationMode,
    horizontalLinecuts,
    verticalLinecuts,
    inclinedLinecuts,
    selectedLinecuts,
    azimuthalIntegrations,
    isSidebarCollapsed,
    isSummaryCollapsed,
    operationType,
    batchProcessing.results,
    batchProcessing.parameterHashes,
    batchProcessing.selectedScanUris,
    triggerAutoSave,
  ]);


    const handleCalibrationUpdate = async (params: CalibrationParams) => {
      try {
          notifications.show({
              id: 'calibration-update',
              loading: true,
              title: 'Updating Calibration',
              message: 'Please wait while calibration parameters are updated...',
              autoClose: false,
          });

          // Update the calibration parameters in the hook
          // This will trigger q-vectors fetch via the useEffect in useScattering
          updateCalibration(params);

          // Close the calibration overlay
          setIsCalibrationOpen(false);

          notifications.update({
              id: 'calibration-update',
              color: 'green',
              title: 'Calibration Updated',
              message: 'Calibration parameters have been updated successfully',
              autoClose: 2000,
          });

      } catch (error) {
          let errorMessage: string;
          if (error instanceof Error) {
              errorMessage = error.message;
          } else if (typeof error === 'string') {
              errorMessage = error;
          } else {
              errorMessage = 'An unexpected error occurred during calibration update';
          }

          console.error('Error updating calibration:', error);

          notifications.update({
              id: 'calibration-update',
              color: 'red',
              title: 'Calibration Update Failed',
              message: errorMessage,
              autoClose: 4000,
          });
      }
  };

  const linecutButtonsConfig = [
    { type: 'Horizontal' as const, icon: scatteringIcons.horizontalLinecut, addFn: addHorizontalLinecut },
    { type: 'Vertical' as const, icon: scatteringIcons.verticalLinecut, addFn: addVerticalLinecut },
    { type: 'Inclined' as const, icon: scatteringIcons.inclinedLinecut, addFn: addInclinedLinecut },
    { type: 'Azimuthal' as const, icon: scatteringIcons.azimuthalIntegration, addFn: addAzimuthalIntegration, saxsOnly: true },
  ];

  return (
    <div className={`flex flex-col ${standalone ? 'h-screen' : 'h-full'} w-full`}>
      {standalone && (
        <header className="flex items-center justify-center gap-3 p-1 bg-white border-b border-gray-200 shrink-0">
          <img src={alsLogo} alt="ALS Logo" className="h-10" />
          <h1 className="text-2xl font-bold text-sky-950">X-ray Scattering Analysis</h1>
        </header>
      )}
      <div className="flex flex-1 w-full overflow-hidden">
      {/* First Column - Sidebar */}
        <div className={`border border-gray-300 bg-slate-200 shadow-lg relative transition-all duration-300 flex-shrink-0 flex flex-col h-full ${isSidebarCollapsed ? 'w-[48px]' : 'w-[280px]'}`}>
        {/* Scrollable Content Section */}
        <div className="grid gap-2 overflow-y-auto overflow-x-hidden p-2">
          {/* Experimental data section (non-accordion) */}
          <div className="flex-1 flex-row">
            {/* Header styled like accordion */}
            <div className={`flex items-center pb-2 text-sky-950 border-b border-gray-200 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
              {!isSidebarCollapsed && (
              <div className="flex items-center gap-3">
                <TreeStructureIcon size={24} weight="bold" />
                <span className="text-lg font-semibold">Experimental data</span>
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
                onChange={(value) => handleExperimentTypeChange(value, setExperimentType, setSelectedLinecuts)}
                data={[
                  { value: 'SAXS', label: 'SAXS' },
                  { value: 'GISAXS', label: 'GISAXS' },
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
              {numOfFiles && !isCalibrationSet ? (
                <ButtonWithIcon
                  icon={<WarningIcon weight="fill" size={24} />}
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
            </div>

            {/* Linecut Type Icons */}
            <div className="flex justify-around">
              {linecutButtonsConfig
                .filter(({ saxsOnly }) => !saxsOnly || experimentType === 'SAXS')
                .map(({ type, icon, addFn }) => (
                  <button
                    key={type}
                    className="flex flex-col items-center gap-1 p-1 rounded hover:bg-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => {
                      addLinecut(type, selectedLinecuts, setSelectedLinecuts);
                      addFn();
                    }}
                    disabled={isFetchingData || !numOfFiles || !isCalibrationSet}
                    title={!isCalibrationSet ? 'Set calibration parameters first' : undefined}
                  >
                    <div className="w-8 h-8">{icon}</div>
                    <span className="text-xs text-slate-700">{type}</span>
                  </button>
                ))}
            </div>

            {/* Render all selected LinecutSections */}
            <div className="w-full pl-3 mt-3">
              {linecutOrder.filter((linecut) => selectedLinecuts.includes(linecut)).map((linecutType) => {
                if (linecutType === 'Horizontal' && horizontalLinecuts.length > 0) {
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

                if (linecutType === 'Vertical' && verticalLinecuts.length > 0) {
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

                if (linecutType === 'Inclined' && inclinedLinecuts.length > 0) {
                  return (
                    <InclinedLinecutWidget
                      key={`linecut-section-${linecutType}`}
                      linecutType={linecutType}
                      linecuts={inclinedLinecuts}
                      units="nm⁻¹"
                      updateInclinedLinecutAngle={updateInclinedLinecutAngle}
                      updateInclinedLinecutWidth={updateInclinedLinecutWidth}
                      updateInclinedLinecutColor={updateInclinedLinecutColor}
                      deleteInclinedLinecut={deleteInclinedLinecut}
                      toggleInclinedLinecutVisibility={toggleInclinedLinecutVisibility}
                    />
                  );
                }

                // Azimuthal integration
                if (linecutType === 'Azimuthal' && azimuthalIntegrations.length > 0) {
                  return (
                    <AzimuthalIntegrationWidget
                      key={`linecut-section-${linecutType}`}
                      integrations={azimuthalIntegrations}
                      maxQValue={maxQValue}
                      updateAzimuthalQRange={updateAzimuthalQRange}
                      updateAzimuthalRange={updateAzimuthalRange}
                      updateAzimuthalColor={updateAzimuthalColor}
                      deleteAzimuthalIntegration={deleteAzimuthalIntegration}
                      toggleAzimuthalVisibility={toggleAzimuthalVisibility}
                    />
                  );
                }

                return null;
              })}

              {/* Batch Processing Button */}
              <div className="my-3">
                <ButtonWithIcon
                  icon={<StackIcon size={18} />}
                  text="Batch Processing"
                  cb={() => setIsBatchOverlayOpen(true)}
                  size="small"
                  disabled={!isCalibrationSet || !numOfFiles}
                  styles="w-full"
                />
              </div>

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
            headerChildren={!USE_H5WEB && (
              /* Legacy mode: show menu and settings button */
              <div className="flex items-center gap-1">
                <Menu position="bottom-end">
                  <Menu.Target>
                    <IconButton variant="subtle" size="md">
                      <GitDiffIcon size={24} className='text-sky-950'/>
                    </IconButton>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      onClick={() => setOperationType('subtract')}
                      className={operationType === 'subtract' ? 'bg-sky-100' : ''}
                    >
                      Subtract (−)
                    </Menu.Item>
                    <Menu.Item
                      onClick={() => setOperationType('divide')}
                      className={operationType === 'divide' ? 'bg-sky-100' : ''}
                    >
                      Divide (÷)
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
                <IconButton variant="subtle" size="md" onClick={() => setIsSettingsOpen(true)}>
                  <GearIcon size={24} className='text-sky-950'/>
                </IconButton>
              </div>
            )}
            className="flex-1"
            contentClassName="flex flex-col">
              {/* Plots container */}
              <div className="flex-1 flex flex-col min-h-0">
                {USE_H5WEB ? (
                  <H5WebScatterSubplot
                    operationType={operationType}
                    setOperationType={setOperationType}
                    setImageHeight={setImageHeight}
                    setImageWidth={setImageWidth}
                    setImageData1={setImageData1}
                    setImageData2={setImageData2}
                    horizontalLinecuts={horizontalLinecuts}
                    verticalLinecuts={verticalLinecuts}
                    inclinedLinecuts={inclinedLinecuts}
                    leftImageColorPalette={leftImageColorPalette}
                    rightImageColorPalette={rightImageColorPalette}
                    setZoomedXPixelRange={setZoomedXPixelRange}
                    setZoomedYPixelRange={setZoomedYPixelRange}
                    setResolutionMessage={setResolutionMessage}
                    isLogScale={isLogScale}
                    lowerPercentile={lowerPercentile}
                    upperPercentile={upperPercentile}
                    normalization={normalization}
                    imageColormap={imageColormap}
                    differenceColormap={differenceColormap}
                    normalizationMode={normalizationMode}
                    azimuthalIntegrations={azimuthalIntegrations}
                    azimuthalData1={azimuthalData1}
                    azimuthalData2={azimuthalData2}
                    qMagnitudeMatrix={qMagnitudeMatrix}
                    maxQValue={maxQValue}
                    calibrationParams={calibrationParams}
                    qYMatrix={qYMatrix}
                    qXMatrix={qXMatrix}
                    units="nm⁻¹"
                    mainTransformDataFunction={mainTransformDataFunction}
                    leftImageIndex={leftImageIndex}
                    rightImageIndex={rightImageIndex}
                    scanUris={scanUris}
                    isLoadingImages={isLoadingImages}
                    setIsLoadingImages={setIsLoadingImages}
                    leftHeader={
                      <PrevNextSelect
                        value={leftImageIndex}
                        onChange={setLeftImageIndex}
                        options={imageNames.map((name, index) => ({ value: String(index), label: name }))}
                        disabled={isFetchingData || isLoadingImages || numOfFiles === 0}
                        numItems={numOfFiles}
                      />
                    }
                    rightHeader={
                      <PrevNextSelect
                        value={rightImageIndex}
                        onChange={setRightImageIndex}
                        options={imageNames.map((name, index) => ({ value: String(index), label: name }))}
                        disabled={isFetchingData || isLoadingImages || numOfFiles === 0}
                        numItems={numOfFiles}
                      />
                    }
                    comparisonHeader={
                      <div className="flex items-center gap-1">
                        <span className="font-medium">
                          {operationType === 'subtract' ? 'Difference' : 'Ratio'}
                        </span>
                        <IconButton
                          variant="subtle"
                          size="sm"
                          onClick={() => setOperationType(operationType === 'subtract' ? 'divide' : 'subtract')}
                        >
                          <GitDiffIcon size={16} className='text-sky-950'/>
                        </IconButton>
                      </div>
                    }
                    maskUri={maskUri}
                  />
                ) : (
                  <ScatterSubplot
                    operationType={operationType}
                    setOperationType={setOperationType}
                    setImageHeight={setImageHeight}
                    setImageWidth={setImageWidth}
                    setImageData1={setImageData1}
                    setImageData2={setImageData2}
                    horizontalLinecuts={horizontalLinecuts}
                    verticalLinecuts={verticalLinecuts}
                    inclinedLinecuts={inclinedLinecuts}
                    leftImageColorPalette={leftImageColorPalette}
                    rightImageColorPalette={rightImageColorPalette}
                    setZoomedXPixelRange={setZoomedXPixelRange}
                    setZoomedYPixelRange={setZoomedYPixelRange}
                    setResolutionMessage={setResolutionMessage}
                    isLogScale={isLogScale}
                    lowerPercentile={lowerPercentile}
                    upperPercentile={upperPercentile}
                    normalization={normalization}
                    imageColormap={imageColormap}
                    differenceColormap={differenceColormap}
                    normalizationMode={normalizationMode}
                    azimuthalIntegrations={azimuthalIntegrations}
                    azimuthalData1={azimuthalData1}
                    azimuthalData2={azimuthalData2}
                    maxQValue={maxQValue}
                    calibrationParams={calibrationParams}
                    qYMatrix={qYMatrix}
                    qXMatrix={qXMatrix}
                    units="nm⁻¹"
                    mainTransformDataFunction={mainTransformDataFunction}
                    leftImageIndex={leftImageIndex}
                    rightImageIndex={rightImageIndex}
                    scanUris={scanUris}
                    isLoadingImages={isLoadingImages}
                    setIsLoadingImages={setIsLoadingImages}
                    isAzimuthalProcessing={loadingAzimuthalIntegrations.size > 0}
                    maskUri={maskUri}
                  />
                )}
              </div>

              {resolutionMessage && (
                <div className="flex items-center text-gray-500 text-left pt-2 whitespace-nowrap overflow-x-auto shrink-0">
                  <span>{resolutionMessage}</span>
                  <Popover width={900} position="top">
                    <Popover.Target>
                      <div className="cursor-pointer">
                        <InfoIcon className="ml-2 w-5 h-5" />
                      </div>
                    </Popover.Target>
                    <Popover.Dropdown>
                      <div className="space-y-4 whitespace-normal">
                        <p className="font-medium mb-2">
                          The resolution of the displayed image changes based on the zoom level:
                        </p>
                        <ul className="space-y-3">
                          <li className="flex">
                            <span className="font-medium">• Low Resolution</span>
                            <span className="ml-1">(Downsampling factor = 4): When viewing &gt;50% of the scattering image.</span>
                          </li>
                          <li className="flex">
                            <span className="font-medium">• Medium Resolution</span>
                            <span className="ml-1">(Downsampling factor = 2): When viewing 20-50% of the scattering image.</span>
                          </li>
                          <li className="flex">
                            <span className="font-medium">• Full Resolution</span>
                            <span className="ml-1">(Downsampling factor = 1): When viewing &lt;20% of the scattering image.</span>
                          </li>
                        </ul>
                        <p className="mt-3 text-black-600">
                          <span className="text-red-600">Note:</span> When the image width or height is &gt;2000 pixels, the downsampling factor is doubled.
                        </p>
                      </div>
                    </Popover.Dropdown>
                  </Popover>
                </div>
              )}
          </ContentCard>

          {/* Summary Card */}
          <div className={`h-full flex-shrink-0 transition-all duration-300 ${isSummaryCollapsed ? 'w-[48px]' : 'w-[280px]'}`}>
            <ContentCard
              title={isSummaryCollapsed ? undefined : "Summary"}
              centerHeader={isSummaryCollapsed}
              headerChildren={
                <IconButton variant="subtle" size="sm" onClick={() => setIsSummaryCollapsed(!isSummaryCollapsed)}>
                  <ListIcon size={24} className="text-sky-950" />
                </IconButton>
              }
              className="h-full"
              contentClassName={isSummaryCollapsed ? "hidden" : "flex flex-col px-4"}
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
        {imageData1.length > 0 && imageData2.length > 0 && (
          (selectedLinecuts.includes('Horizontal') && horizontalLinecuts.length > 0) ||
          (selectedLinecuts.includes('Vertical') && verticalLinecuts.length > 0) ||
          (selectedLinecuts.includes('Inclined') && inclinedLinecuts.length > 0) ||
          (experimentType === 'SAXS' && selectedLinecuts.includes('Azimuthal') && azimuthalIntegrations.length > 0)
        ) && (
          <div className="flex gap-2 h-[320px] flex-shrink-0 overflow-x-auto">
            {/* Horizontal Linecut Card */}
            {selectedLinecuts.includes('Horizontal') && horizontalLinecuts.length > 0 && (
              <ContentCard
                title="Horizontal Linecuts"
                className="flex-1"
                contentClassName="p-2 relative"
                isLoading={loadingHorizontalLinecuts.size > 0}
              >
                {isLoadingImages && <LoadingOverlay />}
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
            {selectedLinecuts.includes('Vertical') && verticalLinecuts.length > 0 && (
              <ContentCard
                title="Vertical Linecuts"
                className="flex-1"
                contentClassName="p-2 relative"
                isLoading={loadingVerticalLinecuts.size > 0}
              >
                {isLoadingImages && <LoadingOverlay />}
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
            {selectedLinecuts.includes('Inclined') && inclinedLinecuts.length > 0 && (
              <ContentCard
                title="Inclined Linecuts"
                className="flex-1"
                contentClassName="p-2 relative"
                isLoading={loadingInclinedLinecuts.size > 0}
              >
                {isLoadingImages && <LoadingOverlay />}
                <InclinedLinecutFig
                  linecuts={inclinedLinecuts}
                  inclinedLinecutData1={inclinedLinecutData1 || []}
                  inclinedLinecutData2={inclinedLinecutData2 || []}
                  beamCenterX={calibrationParams?.beam_center_x}
                  beamCenterY={calibrationParams?.beam_center_y}
                  zoomedXQRange={zoomedXQRange}
                  qXVector={qXVector}
                  qYVector={qYVector}
                  units="nm⁻¹"
                />
              </ContentCard>
            )}

            {/* Azimuthal Integration Card */}
            {experimentType === 'SAXS' &&
              selectedLinecuts.includes('Azimuthal') &&
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
                  zoomedQRange={null}
                />
              </ContentCard>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Settings Overlay */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Data Transformation"
      >
        <DataTransformationAccordion
          isLogScale={isLogScale}
          setIsLogScale={setIsLogScale}
          lowerPercentile={lowerPercentile}
          setLowerPercentile={setLowerPercentile}
          upperPercentile={upperPercentile}
          setUpperPercentile={setUpperPercentile}
          normalization={normalization}
          setNormalization={setNormalization}
          imageColormap={imageColormap}
          setImageColormap={setImageColormap}
          differenceColormap={differenceColormap}
          setDifferenceColormap={setDifferenceColormap}
          normalizationMode={normalizationMode}
          setNormalizationMode={setNormalizationMode}
        />
      </Modal>

      {/* Calibration Overlay */}
      <Modal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        title="Calibration parameters"
        titleIcon={<WrenchIcon size={24} weight="bold" />}
        showCloseButton={false}
      >
        <CalibrationAccordion
          onCalibrationUpdate={handleCalibrationUpdate}
          calibrationParams={calibrationParams}
          experimentType={experimentType}
          maskUri={maskUri}
          onMaskUpdate={setMaskUri}
        />
      </Modal>

      {/* Batch Processing Overlay */}
      <BatchProcessingOverlay
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
