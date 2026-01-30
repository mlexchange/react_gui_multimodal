/**
 * Centered overlay shown after saving an item to Tiled.
 *
 * Displays the saved item label, Tiled ID, and URI with copy-to-clipboard
 * buttons.
 */

import { ButtonCopyToClipboard } from "@blueskyproject/finch";
import { XIcon } from "@phosphor-icons/react";
import type { SavedToTiledItem } from "./types";

interface SavedToTiledItemPopupProps {
  item: SavedToTiledItem;
  onClose: () => void;
}

export default function SavedToTiledItemPopup({
  item,
  onClose
}: SavedToTiledItemPopupProps) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-sky-950">
            {item.label}
          </span>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label="Close"
          >
            <XIcon size={16} />
          </button>
        </div>

        <div className="space-y-2">
          <div>
            <span className="text-xs text-gray-500 block mb-1">Tiled ID</span>
            <div className="flex items-center gap-1">
              <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 truncate">
                {item.id}
              </code>
              <ButtonCopyToClipboard copyText={item.id} size="small" />
            </div>
          </div>

          <div>
            <span className="text-xs text-gray-500 block mb-1">URI</span>
            <div className="flex items-center gap-1">
              <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 truncate">
                {item.uri}
              </code>
              <ButtonCopyToClipboard copyText={item.uri} size="small" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
