import { useState } from 'react';
import { Accordion, Select, Menu, Button, Popover, ActionIcon } from '@mantine/core';
import { CaretDownIcon, CircleHalfTiltIcon, GearIcon, GitDiffIcon, InfoIcon, ListIcon, TreeStructureIcon, WrenchIcon, XIcon } from '@phosphor-icons/react';
import { notifications } from '@mantine/notifications';
import { CalibrationParams } from './types';

import { Tiled } from '@blueskyproject/tiled';
import '@blueskyproject/tiled/style.css';

// Import hooks
import useMultimodal from './hooks/useMultimodal';
import useAzimuthalIntegration from './hooks/useAzimuthalIntegration';
import useHorizontalLinecut from './hooks/useHorizontalLinecut';
import useVerticalLinecut from './hooks/useVerticalLinecut';
import useInclinedLinecut from './hooks/useInclinedLinecut';
import useDataTransformation from './hooks/useDataTransformation';
import useRawDataOverview from './hooks/useRawDataOverview';

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

const tiledUrl = import.meta.env.SCATTERING_TILED_URL;
const tiledApiKey = import.meta.env.SCATTERING_TILED_API_KEY;

interface ScatteringProps {
  standalone?: boolean;
}

export default function Scattering({ standalone = false }: ScatteringProps) {
  const linecutOrder = ['Horizontal', 'Vertical', 'Inclined', 'Azimuthal'];
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRawDataCollapsed, setIsRawDataCollapsed] = useState(false);
  const [operationType, setOperationType] = useState<OperationType>('subtract');

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
  } = useMultimodal();

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
  } = useHorizontalLinecut(imageHeight, imageData1, imageData2, qYMatrix);


  const {
    verticalLinecuts,
    addVerticalLinecut,
    updateVerticalLinecutPosition,
    updateVerticalLinecutWidth,
    updateVerticalLinecutColor,
    deleteVerticalLinecut,
    toggleVerticalLinecutVisibility,
  } = useVerticalLinecut(imageWidth, imageData1, imageData2, qXMatrix);



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
  } = useDataTransformation();


  const {
    leftImageIndex,
    setLeftImageIndex,
    rightImageIndex,
    setRightImageIndex,
    selectedContainerPath,
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

    fetchSpectrumData,
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
  } = useAzimuthalIntegration(calibrationParams, leftScanUri, rightScanUri);


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
    <div className={`flex ${standalone ? 'h-screen' : 'h-full'} w-full overflow-hidden`}>
      {/* First Column - Sidebar */}
        <div className={`border border-gray-300 bg-slate-200 shadow-lg relative transition-all duration-300 flex-shrink-0 flex flex-col h-full ${isSidebarCollapsed ? 'w-[48px]' : 'w-[300px]'}`}>
        {/* Scrollable Content Section */}
        <div className="grid gap-2 overflow-y-auto overflow-x-hidden p-2">
          {/* Experimental data section (non-accordion) */}
          <div className="flex-1 flex-row">
            {/* Header styled like accordion */}
            <div className={`flex items-center pb-2 text-sky-900 border-b border-gray-200 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
              {!isSidebarCollapsed && (
              <div className="flex items-center gap-3">
                <TreeStructureIcon size={24} weight="bold" />
                <span className="text-lg font-bold">Experimental data</span>
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
                label="Type"
                value={experimentType}
                onChange={(value) => handleExperimentTypeChange(value, setExperimentType, setSelectedLinecuts)}
                data={[
                  { value: 'SAXS', label: 'SAXS' },
                  { value: 'GISAXS', label: 'GISAXS' },
                ]}
                classNames={{
                  label: 'text-md text-sky-700 font-bold',
                  // input: 'py-3 px-4',
                  option: 'py-2 px-4 hover:bg-gray-100 cursor-pointer rounded',
                }}
              />

              {/* Tiled Load Data */}
              <div className="">
                <Tiled
                  tiledBaseUrl={tiledUrl}
                  apiKey={tiledApiKey}
                  isButtonMode={true}
                  buttonModeText="Load data"
                  onSelectCallback={handleTiledSelection}
                />
                {/* Number of images */}
                {numOfFiles > 0 && (
                  <div className="text-sm font-medium">
                    Number of images: {numOfFiles}
                  </div>
                )}
              </div>



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
                classNames={{
                  label: 'text-md text-sky-700 font-bold',
                }}
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
                classNames={{
                  label: 'text-md text-sky-700 font-bold',
                }}
              />
            </div>
            )}
          </div>

          {/* Accordion Container */}
          {!isSidebarCollapsed && (
          <Accordion
            multiple
            // defaultValue={['calibration-accordion', 'linecuts-accordion']}
            chevronSize={24}
            chevron={<CaretDownIcon size={24} className="text-sky-900" />}
            chevronPosition="right"
            classNames={{ item: 'pt-4 border-b-0', label: 'text-lg py-2 text-sky-900 font-bold', control: 'px-0 text-sky-900', content: 'pl-3 pr-0' }}
          >
            {/* Calibration accordion */}
            <Accordion.Item value="calibration-accordion">
              <Accordion.Control icon={<WrenchIcon size={24} weight="bold" />}>
                Calibration
              </Accordion.Control>
              <Accordion.Panel>
                <CalibrationAccordion
                  onCalibrationUpdate={handleCalibrationUpdate}
                  calibrationParams={calibrationParams}
                />
              </Accordion.Panel>
            </Accordion.Item>

            {/* Linecuts accordion */}
            <Accordion.Item value="linecuts-accordion">
              <Accordion.Control icon={<CircleHalfTiltIcon size={24} weight="bold" />}>
                Linecuts
              </Accordion.Control>
              <Accordion.Panel>
                {/* Add Linecut Menu */}
                <div className="px-2">
                  <Menu>
                    {/* Menu Button */}
                    <Menu.Target>
                      <Button
                        size="md"
                        radius="md"
                        className="w-full bg-sky-500 font-semibold shadow hover:bg-sky-600 disabled:bg-gray-300 transition mx-auto block"
                        disabled={isFetchingData || numOfFiles === 0 || !numOfFiles}
                      >
                        Add linecut
                      </Button>
                    </Menu.Target>

                    {/* Dropdown Items */}
                    <Menu.Dropdown>
                      <Menu.Item
                        onClick={() => {
                          addLinecut('Horizontal', selectedLinecuts, setSelectedLinecuts);
                          addHorizontalLinecut();
                        }}
                      >
                        <span className="font-medium">Horizontal Linecut</span>
                      </Menu.Item>

                      <Menu.Item
                        onClick={() => {
                          addLinecut('Vertical', selectedLinecuts, setSelectedLinecuts);
                          addVerticalLinecut();
                        }}
                      >
                        <span className="font-medium">Vertical Linecut</span>
                      </Menu.Item>

                      <Menu.Item
                        onClick={() => {
                          addLinecut('Inclined', selectedLinecuts, setSelectedLinecuts)
                          addInclinedLinecut();
                        }}
                      >
                        <span className="font-medium">Inclined Linecut</span>
                      </Menu.Item>
                      {/* Conditionally render Azimuthal Integration */}
                      {experimentType === 'SAXS' && (
                        <Menu.Item
                          onClick={() => {
                            addLinecut('Azimuthal', selectedLinecuts, setSelectedLinecuts)
                            addAzimuthalIntegration();
                          }}
                        >
                          <span className="font-medium">Azimuthal Integration</span>
                        </Menu.Item>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                </div>
                {/* Render all selected LinecutSections */}
                <div className="w-full">
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
              </Accordion.Panel>
            </Accordion.Item>

          </Accordion>
          )}
        </div>
      </div>

      {/* Second Column - Main Content Area */}
      <div className="h-full flex-grow flex overflow-hidden p-2 gap-2 bg-slate-500">
        {/* Left side - Scatter Images (top) + Linecuts (bottom) */}
        <div className="flex-grow flex flex-col h-full overflow-hidden gap-2">
          {/* Scatter Images Card */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 text-sky-700">
              <h2 className="text-lg font-bold">2D Scattering Data</h2>
              <div className="flex items-center gap-1">
                <Menu position="bottom-end" withArrow shadow="md">
                  <Menu.Target>
                    <ActionIcon variant="subtle" size="md">
                      <GitDiffIcon size={24} className='text-sky-700'/>
                    </ActionIcon>
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
                <ActionIcon variant="subtle" size="md" onClick={() => setIsSettingsOpen(true)}>
                  <GearIcon size={24} className='text-sky-700'/>
                </ActionIcon>
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

          {/* Linecuts Card */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm h-[300px] flex-shrink-0 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0 text-sky-700">
              <h2 className="text-lg font-bold">Linecuts</h2>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <Accordion
                multiple
                defaultValue={
                  experimentType === 'SAXS'
                    ? [
                        'horizontal-linecut-accordion',
                        'vertical-linecut-accordion',
                        'inclined-linecut-accordion',
                        'azimuthal-integration-accordion',
                      ]
                    : [
                        'horizontal-linecut-accordion',
                        'vertical-linecut-accordion',
                        'inclined-linecut-accordion',
                      ]
                }
                chevronPosition="right"
                classNames={{ chevron: 'text-lg font-bold', label: 'text-lg font-bold' }}
              >
                {selectedLinecuts.includes('Horizontal') && horizontalLinecuts.length > 0 && (
                <Accordion.Item value="horizontal-linecut-accordion">
                  <Accordion.Control>Horizontal Linecut</Accordion.Control>
                  <Accordion.Panel>
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
                  </Accordion.Panel>
                </Accordion.Item>
                )}
                {selectedLinecuts.includes('Vertical') && verticalLinecuts.length > 0 && (
                  <Accordion.Item value="vertical-linecut-accordion">
                    <Accordion.Control>Vertical Linecut</Accordion.Control>
                    <Accordion.Panel>
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
                    </Accordion.Panel>
                  </Accordion.Item>
                )}
              {selectedLinecuts.includes('Inclined') && inclinedLinecuts.length > 0 && (
                <Accordion.Item value="inclined-linecut-accordion">
                  <Accordion.Control>Inclined Linecut</Accordion.Control>
                  <Accordion.Panel>
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
                  </Accordion.Panel>
                </Accordion.Item>
                )}
                {experimentType === 'SAXS' &&
                selectedLinecuts.includes('Azimuthal') &&
                azimuthalIntegrations.length > 0
                && (
                  <Accordion.Item value="azimuthal-integration-accordion">
                    <Accordion.Control>Azimuthal Integration</Accordion.Control>
                    <Accordion.Panel>
                      <AzimuthalIntegrationFig
                        integrations={azimuthalIntegrations}
                        azimuthalData1={azimuthalData1}
                        azimuthalData2={azimuthalData2}
                        zoomedQRange={globalQRange}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>
                )}
              </Accordion>
            </div>
          </div>
        </div>

        {/* Right side - Raw Data Overview (vertical) */}
        <div className={`h-full flex-shrink-0 transition-all duration-300 ${isRawDataCollapsed ? 'w-[48px]' : 'w-[280px]'}`}>
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 flex-shrink-0 text-sky-700">
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
              <ActionIcon variant="subtle" size="md" onClick={() => setIsSettingsOpen(false)}>
                <XIcon size={20} />
              </ActionIcon>
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
    </div>
  );
}
