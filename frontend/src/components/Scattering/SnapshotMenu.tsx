/**
 * SnapshotMenu - Dropdown menu for capturing visualization snapshots.
 * Provides options to capture individual panels or all panels combined.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { CameraIcon } from "@phosphor-icons/react";
import { Btn } from "@h5web/lib";
import { captureSnapshot } from "./utils/snapshot";
import type { ToolbarIcon } from "./types";

interface SnapshotMenuProps {
  leftPanelRef: React.RefObject<HTMLDivElement>;
  rightPanelRef: React.RefObject<HTMLDivElement>;
  comparisonPanelRef: React.RefObject<HTMLDivElement>;
  allPanelsRef: React.RefObject<HTMLDivElement>;
  disabled?: boolean;
}

export function SnapshotMenu({
  leftPanelRef,
  rightPanelRef,
  comparisonPanelRef,
  allPanelsRef,
  disabled = false
}: SnapshotMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSnapshot = useCallback(
    async (
      ref: React.RefObject<HTMLDivElement>,
      filename: string,
      yAxisLabelOffset?: number
    ) => {
      setIsOpen(false);
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:-]/g, "");
      await captureSnapshot(ref.current, {
        filename: `${filename}-${timestamp}`,
        yAxisLabelOffset
      });
    },
    []
  );

  return (
    <div ref={menuRef} className="relative flex items-center">
      <Btn
        label="Snapshot"
        Icon={CameraIcon as ToolbarIcon}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      />

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[160px]"
          role="menu"
        >
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors"
            onClick={() => handleSnapshot(leftPanelRef, "left-image", 30)}
            role="menuitem"
          >
            Left Image
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors"
            onClick={() => handleSnapshot(rightPanelRef, "right-image")}
            role="menuitem"
          >
            Right Image
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors"
            onClick={() => handleSnapshot(comparisonPanelRef, "comparison")}
            role="menuitem"
          >
            Comparison
          </button>
          <div className="border-t border-gray-200 my-1" />
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors font-medium"
            onClick={() => handleSnapshot(allPanelsRef, "all-panels", 30)}
            role="menuitem"
          >
            All Panels
          </button>
        </div>
      )}
    </div>
  );
}

export default SnapshotMenu;
