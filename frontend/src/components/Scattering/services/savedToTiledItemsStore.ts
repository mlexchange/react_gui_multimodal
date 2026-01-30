/**
 * SessionStorage-backed store for tracking items saved to Tiled.
 *
 * Persists saved item metadata (ID, URI, type, label, timestamp) across
 * the session so the System Status overlay can display history.
 */

import type { SavedToTiledItem } from "../types";

const STORAGE_KEY = "scattering_saved_to_tiled_items";

/** Append a saved item to the store. */
export function addSavedToTiledItem(item: SavedToTiledItem): void {
  const items = getSavedToTiledItems();
  items.push(item);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** Read all saved items from the store. */
export function getSavedToTiledItems(): SavedToTiledItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedToTiledItem[];
  } catch {
    return [];
  }
}

/** Clear all saved items. */
export function clearSavedToTiledItems(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
