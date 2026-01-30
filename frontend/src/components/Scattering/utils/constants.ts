import { ScaleType, type AxisScaleType } from "@h5web/lib";

// ============================================================================
// Color Palettes
// ============================================================================

export const leftImageColorPalette = [
  "red",
  "blue",
  "green",
  "orange",
  "purple",
  "teal",
  "pink",
  "brown",
  "gray",
  "cyan"
];

export const rightImageColorPalette = [
  "lime",
  "gold",
  "navy",
  "magenta",
  "coral",
  "indigo",
  "olive",
  "maroon",
  "silver",
  "turquoise"
];

// ============================================================================
// Visualization Scale Types
// ============================================================================

/**
 * Color scale type for heatmap visualization
 */
export type ColorScaleType =
  | ScaleType.Linear
  | ScaleType.Log
  | ScaleType.SymLog
  | ScaleType.Sqrt;

/**
 * Available scale options for the ScaleSelector component
 */
export const SCALE_OPTIONS: ColorScaleType[] = [
  ScaleType.Linear,
  ScaleType.Log,
  ScaleType.SymLog,
  ScaleType.Sqrt
];

/**
 * Available axis scale options (Linear, Log, SymLog) for line plot Y-axes.
 * These are the scale types supported by h5web's VisCanvas ordinateConfig.
 */
export const AXIS_SCALE_OPTIONS: AxisScaleType[] = [
  ScaleType.Linear,
  ScaleType.Log,
  ScaleType.SymLog
];
