import { useState, useEffect, useRef } from 'react';
import { Select, Menu, Popover, IconButton, notifications } from '@/components/ui';
import { CircleHalfTiltIcon, GearIcon, GitDiffIcon, InfoIcon, ListIcon, TreeStructureIcon, WrenchIcon, XIcon } from '@phosphor-icons/react';
import { CalibrationParams } from './types';

import { Button } from '@blueskyproject/finch';
import { Tiled } from '@blueskyproject/tiled';
import '@blueskyproject/tiled/style.css';

// Import hooks
import useScattering from './hooks/useScattering';
import useAzimuthalIntegration from './hooks/useAzimuthalIntegration';
import useHorizontalLinecut from './hooks/useHorizontalLinecut';
import useVerticalLinecut from './hooks/useVerticalLinecut';
import useInclinedLinecut from './hooks/useInclinedLinecut';
import useDataTransformation from './hooks/useDataTransformation';
import useRawDataOverview from './hooks/useRawDataOverview';
import useSessionPersistence, { PersistableState } from './hooks/useSessionPersistence';

// Import components
import ScatterSubplot, { OperationType } from './ScatterSubplot';
import HorizontalLinecutWidget from './HorizontalLinecutWidget';
import VerticalLinecutWidget from './VerticalLinecutWidget';
import InclinedLinecutWidget from './InclinedLinecutWidget';
import AzimuthalIntegrationWidget from './AzimuthalIntegrationWidget';
import DataTransformationAccordion from './DataTransformationAccordion';
import CalibrationAccordion from './CalibrationAccordion';
import HorizontalLinecutFig from './HorizontalLinecutFig';
import VerticalLinecutFig from './VerticalLinecutFig';
import InclinedLinecutFig from './InclinedLinecutFig';
import AzimuthalIntegrationFig from './AzimuthalIntegrationFig';
import RawDataOverviewFig from './RawDataOverviewFig';

// Import utilities
import { handleExperimentTypeChange, addLinecut } from './utils/linecutHandlers';
import { leftImageColorPalette, rightImageColorPalette } from './utils/constants';

// Import assets
import alsLogo from '@/assets/als-logo.png';
import iconHorizontalLinecut from '@/assets/icon-horizontal-linecut.svg';
import iconVerticalLinecut from '@/assets/icon-vertical-linecut.svg';
import iconInclinedLinecut from '@/assets/icon-inclined-linecut.svg';
import iconAzimuthalIntegration from '@/assets/icon-azimuthal-integration.svg';

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
  const [isRawDataCollapsed, setIsRawDataCollapsed] = useState(false);
  const [operationType, setOperationType] = useState<OperationType>('subtract');

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
    imageHeight,
    setImageHeight,
    imageWidth,
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
    qXMatrix,
    qYMatrix,
    restoreState: restoreScatteringState,
  } = useScattering();

  // get the first row of qXMatrix as qXVector
  const qXVector = qXMatrix[0];
  // get the first column of qYMatrix as qYVector
  const qYVector = qYMatrix.map(row => row[0]);


  const {
    horizontalLinecuts,
    addHorizontalLinecut,
    updateHorizontalLinecutPosition,
    updateHorizontalLinecutWidth,
    updateHorizontalLinecutColor,
    deleteHorizontalLinecut,
    toggleHorizontalLinecutVisibility,
    restoreLinecuts: restoreHorizontalLinecuts,
  } = useHorizontalLinecut(qYMatrix);


  const {
    verticalLinecuts,
    addVerticalLinecut,
    updateVerticalLinecutPosition,
    updateVerticalLinecutWidth,
    updateVerticalLinecutColor,
    deleteVerticalLinecut,
    toggleVerticalLinecutVisibility,
    restoreLinecuts: restoreVerticalLinecuts,
  } = useVerticalLinecut(qXMatrix);



  const {
    inclinedLinecuts,
    inclinedLinecutData1,
    inclinedLinecutData2,
    addInclinedLinecut,
    updateInclinedLinecutAngle,
    updateInclinedLinecutWidth,
    updateInclinedLinecutColor,
    deleteInclinedLinecut,
    toggleInclinedLinecutVisibility,
    restoreLinecuts: restoreInclinedLinecuts,
    zoomedXQRange,
  } = useInclinedLinecut(
    imageData1,
    imageData2,
    qXVector,
    qYVector,
    zoomedXPixelRange,
    zoomedYPixelRange,
  );


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

  } = useRawDataOverview();

  // Get scan URIs for selected images
  // These will be used for azimuthal integration API calls
  const leftScanUri = (leftImageIndex !== "" && scanUris.length > 0) ? scanUris[leftImageIndex] : null;
  const rightScanUri = (rightImageIndex !== "" && scanUris.length > 0) ? scanUris[rightImageIndex] : null;

  const {
      azimuthalIntegrations,
      azimuthalData1,
      azimuthalData2,
      maxQValue,
      globalQRange,
      isProcessing,
      addAzimuthalIntegration,
      updateAzimuthalQRange,
      updateAzimuthalRange,
      updateAzimuthalColor,
      deleteAzimuthalIntegration,
      toggleAzimuthalVisibility,
      restoreIntegrations: restoreAzimuthalIntegrations,
  } = useAzimuthalIntegration(calibrationParams, leftScanUri, rightScanUri);

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
    setIsRawDataCollapsed(restoredSession.isRawDataCollapsed);
    setOperationType(restoredSession.operationType);

    // 6. If we have a container path, fetch the summary data
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
      isRawDataCollapsed,
      operationType,
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
    isRawDataCollapsed,
    operationType,
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
          updateCalibration(params);

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
              <ListIcon
                size={24}
                weight="bold"
                className="cursor-pointer hover:text-sky-600"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              />
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
              <div className="w-full [&_button]:w-full [&_button]:bg-sky-500 [&_button]:hover:bg-sky-600 [&_button]:ml-0 [&_button]:rounded-xl [&_button]:py-2">
                <Tiled
                  tiledBaseUrl={tiledUrl}
                  apiKey={tiledApiKey}
                  isButtonMode={true}
                  buttonModeText="Load data"
                  onSelectCallback={handleTiledSelection}
                />
              </div>

              {/* Calibration Button */}
              <Button
                size="medium"
                styles="w-full"
                cb={() => setIsCalibrationOpen(true)}
                text="Calibration"
              />



              {/* Left Image Dropdown */}
              <Select
                label="Left image"
                placeholder="Select left image"
                value={leftImageIndex === "" ? "" : String(leftImageIndex)}
                onChange={(value) => setLeftImageIndex(value === null ? "" : Number(value))}
                data={imageNames.map((name, index) => ({
                  value: String(index),
                  label: name,
                }))}
                searchable
                disabled={isFetchingData || numOfFiles === 0}
              />

              {/* Right Image Dropdown */}
              <Select
                label="Right image"
                placeholder="Select right image"
                value={rightImageIndex === "" ? "" : String(rightImageIndex)}
                onChange={(value) => setRightImageIndex(value === null ? "" : Number(value))}
                data={imageNames.map((name, index) => ({
                  value: String(index),
                  label: name,
                }))}
                searchable
                disabled={isFetchingData || numOfFiles === 0}
              />
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
              <button
                className="flex flex-col items-center gap-1 p-1 rounded hover:bg-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => {
                  addLinecut('Horizontal', selectedLinecuts, setSelectedLinecuts);
                  addHorizontalLinecut();
                }}
                disabled={isFetchingData || numOfFiles === 0}
              >
                <img src={iconHorizontalLinecut} alt="Horizontal" className="w-8 h-8" />
                <span className="text-xs text-slate-700">Horizontal</span>
              </button>

              <button
                className="flex flex-col items-center gap-1 p-1 rounded hover:bg-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => {
                  addLinecut('Vertical', selectedLinecuts, setSelectedLinecuts);
                  addVerticalLinecut();
                }}
                disabled={isFetchingData || numOfFiles === 0}
              >
                <img src={iconVerticalLinecut} alt="Vertical" className="w-8 h-8" />
                <span className="text-xs text-slate-700">Vertical</span>
              </button>

              <button
                className="flex flex-col items-center gap-1 p-1 rounded hover:bg-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => {
                  addLinecut('Inclined', selectedLinecuts, setSelectedLinecuts);
                  addInclinedLinecut();
                }}
                disabled={isFetchingData || numOfFiles === 0}
              >
                <img src={iconInclinedLinecut} alt="Inclined" className="w-8 h-8" />
                <span className="text-xs text-slate-700">Inclined</span>
              </button>

              {experimentType === 'SAXS' && (
                <button
                  className="flex flex-col items-center gap-1 p-1 rounded hover:bg-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => {
                    addLinecut('Azimuthal', selectedLinecuts, setSelectedLinecuts);
                    addAzimuthalIntegration();
                  }}
                  disabled={isFetchingData || numOfFiles === 0}
                >
                  <img src={iconAzimuthalIntegration} alt="Azimuthal" className="w-8 h-8" />
                  <span className="text-xs text-slate-700">Azimuthal</span>
                </button>
              )}
            </div>

            {/* Render all selected LinecutSections */}
            <div className="w-full pl-3 mt-3">
              {linecutOrder.filter((linecut) => selectedLinecuts.includes(linecut)).map((linecutType) => {
                if (linecutType === 'Horizontal' && horizontalLinecuts.length > 0) {
                  return (
                    <HorizontalLinecutWidget
                      key={`linecut-section-${linecutType}`}
                      linecutType={linecutType}
                      linecuts={horizontalLinecuts}
                      qYMatrix={qYMatrix}
                      updateHorizontalLinecutPosition={updateHorizontalLinecutPosition}
                      updateHorizontalLinecutWidth={updateHorizontalLinecutWidth}
                      updateHorizontalLinecutColor={updateHorizontalLinecutColor}
                      deleteHorizontalLinecut={deleteHorizontalLinecut}
                      toggleHorizontalLinecutVisibility={toggleHorizontalLinecutVisibility}
                    />
                  );
                }

                if (linecutType === 'Vertical' && verticalLinecuts.length > 0) {
                  return (
                    <VerticalLinecutWidget
                      key={`linecut-section-${linecutType}`}
                      linecutType={linecutType}
                      linecuts={verticalLinecuts}
                      qXMatrix={qXMatrix}
                      updateVerticalLinecutPosition={updateVerticalLinecutPosition}
                      updateVerticalLinecutWidth={updateVerticalLinecutWidth}
                      updateVerticalLinecutColor={updateVerticalLinecutColor}
                      deleteVerticalLinecut={deleteVerticalLinecut}
                      toggleVerticalLinecutVisibility={toggleVerticalLinecutVisibility}
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
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Second Column - Main Content Area */}
      <div className="h-full flex-grow flex flex-col overflow-hidden p-2 gap-2 bg-slate-500">
        {/* Top Row - Scatter Images + Raw Data Overview */}
        <div className="flex-1 flex overflow-hidden gap-2">
          {/* Scatter Images Card */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 text-sky-950">
              <h2 className="text-lg font-semibold">2D Scattering Data</h2>
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
            </div>
            <div className="p-4 flex-1 overflow-hidden">
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
                isAzimuthalProcessing={isProcessing}
              />

              {resolutionMessage && (
                <div className="flex items-center text-gray-500 text-left mt-4 mb-1 whitespace-nowrap overflow-x-auto">
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
            </div>
          </div>

          {/* Raw Data Overview Card */}
          <div className={`h-full flex-shrink-0 transition-all duration-300 ${isRawDataCollapsed ? 'w-[48px]' : 'w-[280px]'}`}>
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm h-full flex flex-col">
              <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 flex-shrink-0 text-sky-950">
                {!isRawDataCollapsed && <h2 className="text-lg font-bold">Raw Data Overview</h2>}
                <ListIcon
                  size={24}
                  weight="bold"
                  className="cursor-pointer hover:text-sky-600"
                  onClick={() => setIsRawDataCollapsed(!isRawDataCollapsed)}
                />
              </div>
              {!isRawDataCollapsed && (
              <div className="flex-1 overflow-hidden">
                <RawDataOverviewFig
                  maxIntensities={maxIntensities}
                  avgIntensities={avgIntensities}
                  leftImageIndex={leftImageIndex}
                  rightImageIndex={rightImageIndex}
                  onSelectImages={handleImageIndicesChange}
                  isFetchingData={isFetchingData}
                  displayOption={displayOption}
                  imageNames={imageNames}
                  progress={progress}
                  progressMessage={progressMessage}
                />
              </div>
              )}
            </div>
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
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 text-sky-950">
                  <h2 className="text-lg font-bold">Horizontal Linecut</h2>
                </div>
                <div className="p-2 flex-1 overflow-hidden">
                  <HorizontalLinecutFig
                    linecuts={horizontalLinecuts}
                    imageData1={imageData1}
                    imageData2={imageData2}
                    zoomedXPixelRange={zoomedXPixelRange}
                    zoomedYPixelRange={zoomedYPixelRange}
                    qXMatrix={qXMatrix}
                    qYMatrix={qYMatrix}
                    units="nm⁻¹"
                  />
                </div>
              </div>
            )}

            {/* Vertical Linecut Card */}
            {selectedLinecuts.includes('Vertical') && verticalLinecuts.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 text-sky-950">
                  <h2 className="text-lg font-bold">Vertical Linecut</h2>
                </div>
                <div className="p-2 flex-1 overflow-hidden">
                  <VerticalLinecutFig
                    linecuts={verticalLinecuts}
                    imageData1={imageData1}
                    imageData2={imageData2}
                    zoomedXPixelRange={zoomedXPixelRange}
                    zoomedYPixelRange={zoomedYPixelRange}
                    qXMatrix={qXMatrix}
                    qYMatrix={qYMatrix}
                    units="nm⁻¹"
                  />
                </div>
              </div>
            )}

            {/* Inclined Linecut Card */}
            {selectedLinecuts.includes('Inclined') && inclinedLinecuts.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 text-sky-950">
                  <h2 className="text-lg font-bold">Inclined Linecut</h2>
                </div>
                <div className="p-2 flex-1 overflow-hidden">
                  <InclinedLinecutFig
                    linecuts={inclinedLinecuts}
                    inclinedLinecutData1={inclinedLinecutData1 || []}
                    inclinedLinecutData2={inclinedLinecutData2 || []}
                    beamCenterX={calibrationParams.beam_center_x}
                    beamCenterY={calibrationParams.beam_center_y}
                    zoomedXQRange={zoomedXQRange}
                    qXVector={qXVector}
                    qYVector={qYVector}
                    units="nm⁻¹"
                  />
                </div>
              </div>
            )}

            {/* Azimuthal Integration Card */}
            {experimentType === 'SAXS' &&
              selectedLinecuts.includes('Azimuthal') &&
              azimuthalIntegrations.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 text-sky-950">
                  <h2 className="text-lg font-bold">Azimuthal Integration</h2>
                </div>
                <div className="p-2 flex-1 overflow-hidden">
                  <AzimuthalIntegrationFig
                    integrations={azimuthalIntegrations}
                    azimuthalData1={azimuthalData1}
                    azimuthalData2={azimuthalData2}
                    zoomedQRange={globalQRange}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Settings Overlay */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-bold text-sky-900">Data Transformation</h3>
              <IconButton variant="subtle" size="md" onClick={() => setIsSettingsOpen(false)}>
                <XIcon size={20} />
              </IconButton>
            </div>
            <div className="p-4">
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
            </div>
          </div>
        </div>
      )}

      {/* Calibration Overlay */}
      {isCalibrationOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setIsCalibrationOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 text-sky-950">
              <div className="flex items-center gap-2">
                <WrenchIcon size={24} weight="bold" />
                <h3 className="text-lg font-semibold">Calibration parameters</h3>
              </div>
            </div>
            <div className="p-4">
              <CalibrationAccordion
                onCalibrationUpdate={handleCalibrationUpdate}
                calibrationParams={calibrationParams}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
