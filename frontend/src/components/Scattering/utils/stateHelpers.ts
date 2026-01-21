/**
 * State management utilities for linecut hooks.
 * Extracted to eliminate code duplication across horizontal, vertical, and inclined hooks.
 */

/**
 * Renumbers items in an array after deletion to maintain sequential IDs starting from 1.
 * @param items Array of items with id property
 * @param deletedId The ID that was deleted
 * @returns New array with renumbered IDs
 */
export function renumberItems<T extends { id: number }>(
  items: T[],
  deletedId: number
): T[] {
  return items
    .filter((item) => item.id !== deletedId)
    .map((item, index) => ({ ...item, id: index + 1 }));
}

/**
 * Renumbers a Map's keys after deletion to maintain sequential IDs starting from 1.
 * @param map Map with numeric keys
 * @param deletedId The ID that was deleted
 * @returns New Map with renumbered keys
 */
export function renumberMapKeys<V>(
  map: Map<number, V>,
  deletedId: number
): Map<number, V> {
  const entries = Array.from(map.entries())
    .filter(([key]) => key !== deletedId)
    .sort(([a], [b]) => a - b)
    .map(([, value], index) => [index + 1, value] as [number, V]);
  return new Map(entries);
}

/**
 * Adds an item ID to a loading set (immutable).
 * @param prev Previous Set state
 * @param id ID to add
 * @returns New Set with the ID added
 */
export function addToLoadingSet(prev: Set<number>, id: number): Set<number> {
  return new Set(prev).add(id);
}

/**
 * Removes an item ID from a loading set (immutable).
 * @param prev Previous Set state
 * @param id ID to remove
 * @returns New Set with the ID removed
 */
export function removeFromLoadingSet(
  prev: Set<number>,
  id: number
): Set<number> {
  const updated = new Set(prev);
  updated.delete(id);
  return updated;
}

/**
 * Generates the next sequential ID for a new item.
 * @param items Array of items with id property
 * @returns Next available ID (max existing ID + 1, or 1 if empty)
 */
export function generateNextId<T extends { id: number }>(items: T[]): number {
  const existingIds = items.map((item) => item.id);
  return Math.max(0, ...existingIds) + 1;
}
