/**
 * BatchProcessingWidget - Centralized batch processing interface.
 *
 * This overlay provides a unified interface for:
 * - Selecting scans for batch processing
 * - Running batch processing on ALL linecuts across ALL types
 * - Viewing results organized by linecut type and ID
 * - Detecting stale results when parameters change
 */

import { useMemo, useCallback } from "react";
import {
  XIcon,
  StackIcon,
  PlayIcon,
  FolderOpenIcon,
  WarningIcon
} from "@phosphor-icons/react";
import { Button, ButtonWithIcon } from "@blueskyproject/finch";
import { IconButton, notifications } from "@/components/ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { BatchResultsView } from "./BatchResultsView";
import { BatchScanSelector } from "./BatchScanSelector";
import ProgressBar from "./SummaryProgressBar";
import type {
  BatchOperationType,
  BatchJobResult
} from "./hooks/useBatchProcessing";
import type {
  Linecut,
  InclinedLinecut,
  AzimuthalIntegration,
  CalibrationParams,
  SavedToTiledItem
} from "./types";
import {
  saveBatchToTiled,
  buildLinecutParams,
  buildInclinedLinecutParams,
  buildAzimuthalParams
} from "./services/saveResultsApi";

const OPERATION_LABELS: Record<BatchOperationType, string> = {
  horizontal: "Horizontal",
  vertical: "Vertical",
  inclined: "Inclined",
  azimuthal: "Azimuthal"
};

interface BatchProcessingWidgetProps {
  isOpen: boolean;
  onClose: () => void;

  // Linecut data
  horizontalLinecuts: Linecut[];
  verticalLinecuts: Linecut[];
  inclinedLinecuts: InclinedLinecut[];
  azimuthalIntegrations: AzimuthalIntegration[];

  // Available scans
  scanUris: string[];
  scanNames: string[];

  // Selected scans state
  selectedScanUris: string[];
  setSelectedScanUris: (uris: string[]) => void;

  // Tab navigation state
  activeTab: BatchOperationType;
  setActiveTab: (tab: BatchOperationType) => void;
  activeLinecutId: number | null;
  setActiveLinecutId: (id: number | null) => void;

  // Results
  results: {
    horizontal: Record<number, BatchJobResult>;
    vertical: Record<number, BatchJobResult>;
    inclined: Record<number, BatchJobResult>;
    azimuthal: Record<number, BatchJobResult>;
  };
  resultCounts: Record<BatchOperationType, number>;
  currentResult: BatchJobResult | null;

  // Stale detection
  isStale: (type: BatchOperationType, linecutId: number) => boolean;
  hasStaleResults: boolean;

  // Processing state
  isProcessing: boolean;
  progress: number;
  progressMessage: string;

  // Selector state
  isSelectorOpen: boolean;
  setIsSelectorOpen: (open: boolean) => void;

  // Actions
  runBatchAll: () => Promise<unknown>;
  onCancel: () => void;

  // Experiment type (for filtering azimuthal)
  experimentType: string;

  // Save to Tiled (optional feature)
  saveResultsEnabled?: boolean;
  calibrationParams: CalibrationParams | null;
  onSavedToTiledItem?: (item: SavedToTiledItem) => void;
}

export function BatchProcessingWidget({
  isOpen,
  onClose,
  horizontalLinecuts,
  verticalLinecuts,
  inclinedLinecuts,
  azimuthalIntegrations,
  scanUris,
  scanNames,
  selectedScanUris,
  setSelectedScanUris,
  activeTab,
  setActiveTab,
  activeLinecutId,
  setActiveLinecutId,
  results,
  resultCounts,
  currentResult,
  isStale,
  // hasStaleResults
  isProcessing,
  progress,
  progressMessage,
  isSelectorOpen,
  setIsSelectorOpen,
  runBatchAll,
  onCancel,
  experimentType,
  saveResultsEnabled = false,
  calibrationParams,
  onSavedToTiledItem
}: BatchProcessingWidgetProps) {
  // Get linecuts for the active tab
  const activeLinecuts = useMemo(() => {
    switch (activeTab) {
      case "horizontal":
        return horizontalLinecuts;
      case "vertical":
        return verticalLinecuts;
      case "inclined":
        return inclinedLinecuts;
      case "azimuthal":
        return azimuthalIntegrations;
    }
  }, [
    activeTab,
    horizontalLinecuts,
    verticalLinecuts,
    inclinedLinecuts,
    azimuthalIntegrations
  ]);

  // Available tabs (only show tabs that have linecuts defined)
  const availableTabs = useMemo(() => {
    const tabs: BatchOperationType[] = [];
    if (horizontalLinecuts.length > 0) tabs.push("horizontal");
    if (verticalLinecuts.length > 0) tabs.push("vertical");
    if (inclinedLinecuts.length > 0) tabs.push("inclined");
    if (experimentType === "SAXS" && azimuthalIntegrations.length > 0) {
      tabs.push("azimuthal");
    }
    return tabs;
  }, [
    horizontalLinecuts,
    verticalLinecuts,
    inclinedLinecuts,
    azimuthalIntegrations,
    experimentType
  ]);

  // Count total linecuts
  const totalLinecuts = useMemo(() => {
    return (
      horizontalLinecuts.length +
      verticalLinecuts.length +
      inclinedLinecuts.length +
      (experimentType === "SAXS" ? azimuthalIntegrations.length : 0)
    );
  }, [
    horizontalLinecuts,
    verticalLinecuts,
    inclinedLinecuts,
    azimuthalIntegrations,
    experimentType
  ]);

  // Handle tab change
  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value as BatchOperationType);
    },
    [setActiveTab]
  );

  // Handle secondary tab change (linecut selection within type)
  const handleLinecutSelect = useCallback(
    (id: number) => {
      setActiveLinecutId(id);
    },
    [setActiveLinecutId]
  );

  // Handle scan selection complete
  const handleScanSelectionComplete = useCallback(
    (uris: string[]) => {
      setSelectedScanUris(uris);
      setIsSelectorOpen(false);
    },
    [setSelectedScanUris, setIsSelectorOpen]
  );

  // Handle run batch
  const handleRunBatch = useCallback(async () => {
    try {
      await runBatchAll();
    } catch (error) {
      // Error is already handled in the hook with notifications
      console.error("Batch processing error:", error);
    }
  }, [runBatchAll]);

  // Check if current linecut result is stale
  const currentIsStale = useMemo(() => {
    if (activeLinecutId === null) return false;
    return isStale(activeTab, activeLinecutId);
  }, [isStale, activeTab, activeLinecutId]);

  // Get current linecut info and index for title display
  const { currentLinecut, currentLinecutIndex } = useMemo(() => {
    if (activeLinecutId === null || activeLinecuts.length === 0) {
      return { currentLinecut: null, currentLinecutIndex: 0 };
    }
    const index = activeLinecuts.findIndex((lc) => lc.id === activeLinecutId);
    return {
      currentLinecut: index >= 0 ? activeLinecuts[index] : null,
      currentLinecutIndex: Math.max(0, index)
    };
  }, [activeLinecutId, activeLinecuts]);

  // Save batch results to Tiled handler
  const handleSaveBatchToTiled = useCallback(async () => {
    if (!currentResult || !calibrationParams || !currentLinecut) return;

    const notificationId = "save-batch-tiled";
    notifications.show({
      id: notificationId,
      loading: true,
      title: "Saving to Tiled",
      message: "Saving batch results...",
      autoClose: false
    });

    try {
      let linecutParams;
      switch (activeTab) {
        case "horizontal":
        case "vertical":
          linecutParams = buildLinecutParams(
            currentLinecut as Linecut,
            activeTab
          );
          break;
        case "inclined":
          linecutParams = buildInclinedLinecutParams(
            currentLinecut as InclinedLinecut
          );
          break;
        case "azimuthal":
          linecutParams = buildAzimuthalParams(
            currentLinecut as AzimuthalIntegration
          );
          break;
      }

      const result = await saveBatchToTiled({
        calibration: calibrationParams,
        experimentType,
        linecutParameters: linecutParams,
        results: currentResult.results
      });

      if (result.tiled_id && result.tiled_uri && onSavedToTiledItem) {
        onSavedToTiledItem({
          id: result.tiled_id,
          uri: result.tiled_uri,
          type: `batch_${activeTab}`,
          label: result.message,
          timestamp: Date.now()
        });
      }

      notifications.update({
        id: notificationId,
        color: "green",
        title: "Saved to Tiled",
        message: result.message,
        autoClose: 3000
      });
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
  }, [
    currentResult,
    calibrationParams,
    experimentType,
    currentLinecut,
    activeTab,
    onSavedToTiledItem
  ]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 text-sky-950 shrink-0">
          <div className="flex items-center gap-2">
            <StackIcon size={24} weight="bold" />
            <h3 className="text-lg font-semibold">Batch Processing</h3>
          </div>
          <IconButton variant="subtle" size="md" onClick={onClose}>
            <XIcon size={20} />
          </IconButton>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center gap-4">
            {/* Select Data Button */}
            <ButtonWithIcon
              icon={
                <span className="flex items-center justify-center h-full">
                  <FolderOpenIcon size={24} />
                </span>
              }
              text="Select Data"
              cb={() => setIsSelectorOpen(true)}
              size="medium"
            />

            {/* Selected scans indicator */}
            <span className="text-sm text-gray-600">
              {selectedScanUris.length > 0 ? (
                <span className="font-medium text-sky-700">
                  {selectedScanUris.length} scans selected
                </span>
              ) : (
                <span className="text-gray-400">No scans selected</span>
              )}
            </span>
          </div>

          {/* Stale warning + Run Batch Button */}
          <div className="flex items-center gap-3">
            {currentIsStale && (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <WarningIcon size={14} />
                Results outdated
              </span>
            )}
            <ButtonWithIcon
              icon={
                <span className="flex items-center justify-center h-full">
                  <PlayIcon size={24} />
                </span>
              }
              text={isProcessing ? "Processing..." : "Run Batch"}
              cb={handleRunBatch}
              size="medium"
              disabled={
                isProcessing ||
                selectedScanUris.length === 0 ||
                totalLinecuts === 0
              }
              styles="disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* No linecuts message */}
        {totalLinecuts === 0 && (
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 shrink-0">
            <div className="flex items-center gap-2 text-amber-700">
              <WarningIcon size={24} />
              <span className="text-sm">
                No linecuts defined. Add linecuts in the sidebar before batch
                processing.
              </span>
            </div>
          </div>
        )}

        {/* Primary Tabs */}
        {availableTabs.length > 0 && (
          <div className="px-4 pt-3 shrink-0">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList variant="primary">
                {availableTabs.map((tab) => {
                  const hasResults = resultCounts[tab] > 0;
                  return (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      variant="primary"
                      hasData={hasResults}
                    >
                      {OPERATION_LABELS[tab]}
                      {hasResults && (
                        <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-sky-100 text-sky-700 rounded">
                          {resultCounts[tab]}
                        </span>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Secondary Tabs (for multiple linecuts of same type) */}
        {activeLinecuts.length > 1 && (
          <div className="px-4 pt-2 shrink-0">
            <Tabs
              value={activeLinecutId?.toString() ?? ""}
              onValueChange={(v) => handleLinecutSelect(parseInt(v, 10))}
            >
              <TabsList variant="secondary">
                {activeLinecuts.map((linecut, index) => {
                  const linecutId = linecut.id;
                  const hasResult = results[activeTab][linecutId] !== undefined;
                  const isLinecutStale = isStale(activeTab, linecutId);

                  return (
                    <TabsTrigger
                      key={linecutId}
                      value={linecutId.toString()}
                      variant="secondary"
                      hasData={hasResult}
                    >
                      <span className="flex items-center gap-1">
                        Linecut {index + 1}
                        {hasResult && !isLinecutStale && (
                          <span className="w-2 h-2 bg-green-500 rounded-full" />
                        )}
                        {hasResult && isLinecutStale && (
                          <span className="w-2 h-2 bg-amber-500 rounded-full" />
                        )}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 min-h-0 flex flex-col">
          {currentResult ? (
            <BatchResultsView
              results={currentResult.results}
              operationType={activeTab}
              totalScans={currentResult.totalScans}
              successful={currentResult.successful}
              failed={currentResult.failed}
              linecutInfo={currentLinecut}
              linecutIndex={currentLinecutIndex}
              saveResultsEnabled={saveResultsEnabled}
              onSaveToTiled={handleSaveBatchToTiled}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <StackIcon size={48} className="mx-auto mb-2 opacity-50" />
                <p>Select scans and run batch processing to see results</p>
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar (shown during processing) */}
        {isProcessing && (
          <div className="px-4 py-3 border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <ProgressBar
                  progress={progress}
                  isVisible={true}
                  label={progressMessage}
                />
              </div>
              <Button
                text="Cancel"
                cb={onCancel}
                size="small"
                isSecondary
                styles="text-red-700 bg-red-50 border-red-200 hover:bg-red-100 shrink-0"
              />
            </div>
          </div>
        )}
      </div>

      {/* Scan Selector Modal */}
      <BatchScanSelector
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        scanUris={scanUris}
        scanNames={scanNames}
        onConfirm={handleScanSelectionComplete}
        initialSelectedUris={selectedScanUris}
      />
    </div>
  );
}
