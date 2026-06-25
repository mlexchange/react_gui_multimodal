import { binarySearchClosest } from "./h5webUtils";

/**
 * Find pixel position from q-value using a 1D q-vector
 * @param qValue The q-value to find in the vector
 * @param qVector The 1D array of q-values (one per pixel row or column)
 * @returns The pixel index corresponding to the q-value
 */
export function findPixelPositionForQValue(
  qValue: number,
  qVector: number[]
): number {
  if (!qVector || qVector.length === 0) {
    return 0;
  }

  return binarySearchClosest(qVector, qValue);
}
