/**
 * H5WebLegend - Simple legend component for H5Web-based line plots.
 *
 * Displays legend entries with colored indicators (line or marker style).
 * Positioned at the bottom of the plot container.
 */

export interface LegendEntry {
  /** Unique identifier for the entry */
  id: string | number;
  /** Display label */
  label: string;
  /** Color of the line/marker */
  color: string;
  /** Whether to show as marker only (circle) vs line */
  isMarker?: boolean;
  /** Optional: marker outline color (for selected image indicators) */
  outlineColor?: string;
  /** Whether this entry is currently visible */
  visible?: boolean;
}

interface H5WebLegendProps {
  /** Array of legend entries to display */
  entries: LegendEntry[];
  /** Optional: callback when entry is clicked (for toggle visibility) */
  onEntryClick?: (id: string | number) => void;
  /** Optional: additional CSS class */
  className?: string;
}

/**
 * Renders a horizontal legend at the bottom of a plot.
 * Entries can be lines or markers with optional outline colors.
 */
export function H5WebLegend({
  entries,
  onEntryClick,
  className = ""
}: H5WebLegendProps) {
  if (entries.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 py-1 text-xs ${className}`}
    >
      {entries.map((entry) => {
        const isClickable = onEntryClick !== undefined;
        const isHidden = entry.visible === false;

        return (
          <div
            key={entry.id}
            className={`flex items-center gap-1.5 ${isClickable ? "cursor-pointer hover:opacity-80" : ""} ${isHidden ? "opacity-50" : ""}`}
            onClick={isClickable ? () => onEntryClick(entry.id) : undefined}
          >
            {/* Color indicator */}
            {entry.isMarker ? (
              // Marker style (circle) - filled with outline color to match graph markers
              <svg width="14" height="14" viewBox="0 0 14 14">
                <circle
                  cx="7"
                  cy="7"
                  r="5"
                  fill={entry.outlineColor || entry.color}
                  stroke={entry.outlineColor || entry.color}
                  strokeWidth={1.5}
                />
              </svg>
            ) : (
              // Line style
              <svg width="20" height="12" viewBox="0 0 20 12">
                <line
                  x1="0"
                  y1="6"
                  x2="20"
                  y2="6"
                  stroke={entry.color}
                  strokeWidth="2"
                />
              </svg>
            )}
            {/* Label */}
            <span className="text-gray-700 select-none">{entry.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default H5WebLegend;
