/**
 * Parameter hashing utilities for stale data detection in batch processing.
 *
 * These functions generate deterministic hashes for linecut and azimuthal integration
 * parameters, used to detect when parameters have changed after batch processing.
 */

import { Linecut, InclinedLinecut, AzimuthalIntegration } from "../types";

/**
 * Round a number to a fixed precision to avoid floating point comparison issues.
 * Uses 6 decimal places for q-space values.
 */
function roundForHash(value: number, decimals: number = 6): string {
  return value.toFixed(decimals);
}

/**
 * Generate a hash for horizontal linecut parameters.
 * Only includes parameters that affect the batch processing results.
 */
export function hashHorizontalLinecut(linecut: Linecut): string {
  return JSON.stringify({
    position: roundForHash(linecut.position),
    width: roundForHash(linecut.width)
  });
}

/**
 * Generate a hash for vertical linecut parameters.
 * Only includes parameters that affect the batch processing results.
 */
export function hashVerticalLinecut(linecut: Linecut): string {
  return JSON.stringify({
    position: roundForHash(linecut.position),
    width: roundForHash(linecut.width)
  });
}

/**
 * Generate a hash for inclined linecut parameters.
 * Only includes parameters that affect the batch processing results.
 */
export function hashInclinedLinecut(linecut: InclinedLinecut): string {
  return JSON.stringify({
    qXPosition: roundForHash(linecut.qXPosition),
    qYPosition: roundForHash(linecut.qYPosition),
    angle: roundForHash(linecut.angle, 2),
    qWidth: roundForHash(linecut.qWidth)
  });
}

/**
 * Generate a hash for azimuthal integration parameters.
 * Only includes parameters that affect the batch processing results.
 */
export function hashAzimuthalIntegration(
  integration: AzimuthalIntegration
): string {
  return JSON.stringify({
    qRange: integration.qRange
      ? [
          roundForHash(integration.qRange[0]),
          roundForHash(integration.qRange[1])
        ]
      : null,
    azimuthRange: [
      roundForHash(integration.azimuthRange[0], 2),
      roundForHash(integration.azimuthRange[1], 2)
    ]
  });
}
