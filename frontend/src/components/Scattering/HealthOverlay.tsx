/**
 * Health check overlay.
 *
 * Displays live service status (backend, Tiled data, calibration, results)
 * and a history of items saved to Tiled during the current session.
 */

import { useState, useEffect } from "react";
import { ButtonCopyToClipboard } from "@blueskyproject/finch";
import { ArrowClockwiseIcon, XIcon, TrashIcon } from "@phosphor-icons/react";
import type { HealthData, ServiceStatus } from "./services/healthApi";
import type { SavedToTiledItem } from "./types";
import {
  getSavedToTiledItems,
  clearSavedToTiledItems
} from "./services/savedToTiledItemsStore";

interface HealthOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  health: HealthData | null;
  isHealthLoading: boolean;
  onRefreshHealth: () => void;
  /** When true the backend is unreachable - overlay cannot be dismissed. */
  isBackendDown?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<ServiceStatus, string> = {
  ok: "Connected",
  error: "Error",
  not_configured: "Not configured"
};

const STATUS_COLORS: Record<ServiceStatus, string> = {
  ok: "bg-green-500",
  error: "bg-red-500",
  not_configured: "bg-gray-400"
};

function formatRelativeTime(ts: string | number): string {
  const diff =
    Date.now() - (typeof ts === "number" ? ts : new Date(ts).getTime());
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  horizontal: "bg-blue-100 text-blue-800",
  vertical: "bg-emerald-100 text-emerald-800",
  inclined: "bg-purple-100 text-purple-800",
  azimuthal: "bg-amber-100 text-amber-800",
  batch: "bg-rose-100 text-rose-800"
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HealthOverlay({
  isOpen,
  onClose,
  health,
  isHealthLoading,
  onRefreshHealth,
  isBackendDown = false
}: HealthOverlayProps) {
  const [savedItems, setSavedItems] = useState<SavedToTiledItem[]>([]);

  // Refresh saved items whenever the overlay opens
  useEffect(() => {
    if (isOpen) {
      setSavedItems(getSavedToTiledItems());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClearAll = () => {
    clearSavedToTiledItems();
    setSavedItems([]);
  };

  const services: { label: string; key: keyof HealthData }[] = [
    { label: "Backend", key: "backend" },
    { label: "Tiled (Data)", key: "tiled_data" },
    { label: "Tiled (Calibration)", key: "tiled_calibration" },
    { label: "Tiled (Results)", key: "tiled_results" }
  ];

  const reversedItems = [...savedItems].reverse();

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={isBackendDown ? undefined : onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <span className="text-base font-semibold text-sky-950">
            Health Check & Saved Data
          </span>
          {!isBackendDown && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label="Close"
            >
              <XIcon size={18} />
            </button>
          )}
        </div>

        {/* Backend-down banner */}
        {isBackendDown && (
          <div className="px-5 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700">
            Backend is unreachable. Retrying automatically...
          </div>
        )}

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* ---- Services Health ---- */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-sky-950">
                Services Health
              </h3>
              <button
                onClick={onRefreshHealth}
                disabled={isHealthLoading}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 transition-colors"
                aria-label="Refresh health check"
              >
                <ArrowClockwiseIcon
                  size={14}
                  className={`text-sky-950 ${isHealthLoading ? "animate-spin" : ""}`}
                />
              </button>
              {health?.checked_at && (
                <span className="text-xs text-gray-400 ml-auto">
                  {formatRelativeTime(health.checked_at)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {services.map(({ label, key }) => {
                const svc = health?.[key];
                const status: ServiceStatus =
                  typeof svc === "object" && svc !== null && "status" in svc
                    ? (svc as { status: ServiceStatus }).status
                    : "error";
                const message =
                  typeof svc === "object" && svc !== null && "message" in svc
                    ? (svc as { message?: string }).message
                    : undefined;

                const statusText = health
                  ? STATUS_LABELS[status]
                  : isHealthLoading
                    ? "Loading..."
                    : "Unreachable";

                const dotColor = health
                  ? STATUS_COLORS[status]
                  : isHealthLoading
                    ? "bg-gray-300"
                    : "bg-red-500";

                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                    title={message ? `${statusText} - ${message}` : statusText}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`}
                    />
                    <div className="min-w-0">
                      <span className="font-medium text-sky-950 block truncate">
                        {label}
                      </span>
                      <span className="text-xs text-gray-500 block truncate">
                        {statusText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ---- Saved Items History ---- */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-sky-950">
                Saved to Tiled
              </h3>
              {savedItems.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 transition-colors"
                >
                  <TrashIcon size={14} />
                  Clear all
                </button>
              )}
            </div>

            {reversedItems.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                No items saved to Tiled in this session.
              </p>
            ) : (
              <div className="space-y-2">
                {reversedItems.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5"
                  >
                    {/* Top row: label + type badge + timestamp */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-sky-950 truncate flex-1">
                        {item.label}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${TYPE_BADGE_COLORS[item.type] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {item.type}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>

                    {/* ID row */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 w-6 flex-shrink-0">
                        ID
                      </span>
                      <code className="text-xs bg-white px-2 py-0.5 rounded border border-gray-200 flex-1 truncate">
                        {item.id}
                      </code>
                      <ButtonCopyToClipboard copyText={item.id} size="small" />
                    </div>

                    {/* URI row */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 w-6 flex-shrink-0">
                        URI
                      </span>
                      <code className="text-xs bg-white px-2 py-0.5 rounded border border-gray-200 flex-1 truncate">
                        {item.uri}
                      </code>
                      <ButtonCopyToClipboard copyText={item.uri} size="small" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
