/**
 * BatchScanSelector - Modal for selecting scans to process in batch.
 *
 * Features:
 * - "Select All" toggle for quick full-dataset selection
 * - Individual scan checkboxes with scan names
 * - Shift+click for range selection
 * - Summary of selected scans count
 * - Start processing button
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Modal } from '@/components/shared';
import { PlayIcon, StackIcon } from '@phosphor-icons/react';
import { BatchOperationType } from './hooks/useBatchProcessing';
import { OPERATION_LABELS_FULL } from './utils/constants';

interface BatchScanSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  scanUris: string[];
  scanNames: string[];
  operationType: BatchOperationType;
  onStartBatch: (selectedUris: string[]) => void;
  isProcessing: boolean;
  /** Optional: URIs of scans that should be pre-selected when modal opens */
  initialSelectedUris?: string[];
}

export function BatchScanSelector({
  isOpen,
  onClose,
  scanUris,
  scanNames,
  operationType,
  onStartBatch,
  isProcessing,
  initialSelectedUris,
}: BatchScanSelectorProps) {
  // Set of selected indices
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // Track last clicked index for shift+click range selection
  const lastClickedIndex = useRef<number | null>(null);

  // Build a URI to index map for efficient lookup
  const uriToIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    scanUris.forEach((uri, index) => map.set(uri, index));
    return map;
  }, [scanUris]);

  // Initialize selection when modal opens with initialSelectedUris
  useEffect(() => {
    if (isOpen) {
      // Reset the last clicked index when modal opens
      lastClickedIndex.current = null;

      if (initialSelectedUris && initialSelectedUris.length > 0) {
        const indices = new Set<number>();
        initialSelectedUris.forEach(uri => {
          const index = uriToIndexMap.get(uri);
          if (index !== undefined) {
            indices.add(index);
          }
        });
        setSelectedIndices(indices);
      }
    }
  }, [isOpen, initialSelectedUris, uriToIndexMap]);

  // Check if all scans are selected
  const allSelected = selectedIndices.size === scanUris.length && scanUris.length > 0;

  /**
   * Handle "Select All" toggle
   */
  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      // Deselect all
      setSelectedIndices(new Set());
    } else {
      // Select all
      setSelectedIndices(new Set(scanUris.map((_, i) => i)));
    }
  }, [allSelected, scanUris]);

  /**
   * Handle individual scan checkbox click
   * Supports Shift+click for range selection
   */
  const handleToggle = useCallback((index: number, event: React.MouseEvent) => {
    // Prevent default browser behavior (text selection, etc.)
    event.preventDefault();

    setSelectedIndices(prev => {
      const next = new Set(prev);

      // Shift+click: select range from last clicked to current
      if (event.shiftKey && lastClickedIndex.current !== null && lastClickedIndex.current !== index) {
        const start = Math.min(lastClickedIndex.current, index);
        const end = Math.max(lastClickedIndex.current, index);
        for (let i = start; i <= end; i++) {
          next.add(i);
        }
      } else {
        // Regular click: toggle single item
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        // Update anchor point for future shift+clicks
        lastClickedIndex.current = index;
      }

      return next;
    });
  }, []);

  /**
   * Start batch processing with selected scans
   */
  const handleStart = useCallback(() => {
    const selectedUris = Array.from(selectedIndices)
      .sort((a, b) => a - b)  // Keep original order
      .map(i => scanUris[i]);
    onStartBatch(selectedUris);
  }, [selectedIndices, scanUris, onStartBatch]);

  const operationLabel = OPERATION_LABELS_FULL[operationType];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Batch ${operationLabel}`}
      titleIcon={<StackIcon size={20} />}
    >
      <div className="space-y-4">
        {/* Description */}
        <p className="text-sm text-gray-600">
          Select scans to process with the current {operationLabel.toLowerCase()} settings.
        </p>

        {/* Select All checkbox */}
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
          <input
            type="checkbox"
            id="select-all"
            checked={allSelected}
            onChange={handleSelectAll}
            className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
          />
          <label htmlFor="select-all" className="font-medium text-sm cursor-pointer">
            Select All ({scanUris.length} scans)
          </label>
        </div>

        {/* Scan List */}
        {scanUris.length === 0 ? (
          <p className="text-sm text-gray-500 italic py-4 text-center">
            No scans available. Load data first using the Tiled browser.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded">
            {scanNames.map((name, index) => (
              <div
                key={index}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 select-none ${
                  selectedIndices.has(index)
                    ? 'bg-sky-50'
                    : 'hover:bg-gray-50'
                }`}
                onClick={(e) => handleToggle(index, e)}
              >
                <input
                  type="checkbox"
                  checked={selectedIndices.has(index)}
                  readOnly
                  className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500 pointer-events-none"
                />
                <span className="text-sm text-gray-700 truncate flex-1">{name}</span>
                <span className="text-xs text-gray-400 tabular-nums">#{index + 1}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer: Summary & Action Button */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <span className="text-sm text-gray-600">
            {selectedIndices.size} of {scanUris.length} scans selected
          </span>
          <button
            onClick={handleStart}
            disabled={selectedIndices.size === 0 || isProcessing}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedIndices.size === 0 || isProcessing
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-sky-600 text-white hover:bg-sky-700'
            }`}
          >
            <PlayIcon size={16} />
            {isProcessing ? 'Processing...' : 'Start Processing'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
