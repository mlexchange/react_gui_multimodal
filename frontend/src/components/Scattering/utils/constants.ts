import { ScaleType } from '@h5web/lib';
import type { BatchOperationType } from '../hooks/useBatchProcessing';

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
    "cyan",
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
    "turquoise",
  ];

// ============================================================================
// Batch Processing Constants
// ============================================================================

/**
 * Short labels for batch operation types (used in tabs)
 */
export const OPERATION_LABELS: Record<BatchOperationType, string> = {
  horizontal: 'Horizontal',
  vertical: 'Vertical',
  inclined: 'Inclined',
  azimuthal: 'Azimuthal',
};

/**
 * Full descriptive labels for batch operation types (used in titles/headers)
 */
export const OPERATION_LABELS_FULL: Record<BatchOperationType, string> = {
  horizontal: 'Horizontal Linecut',
  vertical: 'Vertical Linecut',
  inclined: 'Inclined Linecut',
  azimuthal: 'Azimuthal Integration',
};

/**
 * Color scale type for heatmap visualization
 */
export type ColorScaleType = ScaleType.Linear | ScaleType.Log | ScaleType.SymLog | ScaleType.Sqrt;

/**
 * Available scale options for the ScaleSelector component
 */
export const SCALE_OPTIONS: ColorScaleType[] = [
  ScaleType.Linear,
  ScaleType.Log,
  ScaleType.SymLog,
  ScaleType.Sqrt,
];
