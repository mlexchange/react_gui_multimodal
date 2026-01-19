/**
 * IndexedDB-based cache service for scan images.
 * Caches processed image data from the backend.
 */

import { unpack } from 'msgpackr';
import { reconstructFloat32Array } from '../utils/dataProcessingScatterSubplot';

const DB_NAME = 'scattering_analysis_cache';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const MAX_ENTRIES = 25;

/**
 * GISAXS transformed image data.
 */
export interface GISAXSTransformedData {
  array: number[][];
  qipValues: number[];
  qoopValues: number[];
}

/**
 * GISAXS pixel-space Q matrices for axis labels and tooltips.
 */
export interface GISAXSPixelQData {
  qipMatrix: number[][];
  qoopMatrix: number[][];
}

/**
 * Processed image data.
 */
export interface ProcessedImageData {
  array: number[][];

  // GISAXS-specific data (only present for GISAXS with calibration)
  gisaxsTransformed?: GISAXSTransformedData;
  gisaxsPixelQ?: GISAXSPixelQData;
}

export interface CachedScatteringImage {
  scanUri: string;              // Primary key
  imageData: ProcessedImageData;
  cachedAt: number;             // Timestamp for LRU eviction
}

export interface CacheStats {
  count: number;
  totalSize: number;
  maxEntries: number;
}

/**
 * Calibration parameters needed for GISAXS transform.
 */
export interface GISAXSCalibrationParams {
  sample_detector_distance: number;
  beam_center_x: number;
  beam_center_y: number;
  pixel_size_x: number;
  pixel_size_y: number;
  wavelength: number;
  incident_angle: number;
  tilt?: number;
  tilt_plan_rotation?: number;
}

let dbInstance: IDBDatabase | null = null;
let initPromise: Promise<IDBDatabase> | null = null;

/**
 * Initialize the IndexedDB database.
 * Creates the database and object store if they don't exist.
 */
export async function initializeCache(): Promise<IDBDatabase> {
  // Return existing instance if available
  if (dbInstance) {
    return dbInstance;
  }

  // Return existing init promise if initialization is in progress
  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      initPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('IndexedDB cache initialized');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'scanUri' });
        // Create index on cachedAt for LRU eviction queries
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
        console.log('Created images object store with cachedAt index');
      }
    };
  });

  return initPromise;
}

/**
 * Get a cached image by scan URI.
 * Returns null if not found.
 */
export async function getCachedImage(scanUri: string): Promise<ProcessedImageData | null> {
  const db = await initializeCache();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(scanUri);

    request.onerror = () => {
      console.error('Error getting cached image:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      const result = request.result as CachedScatteringImage | undefined;
      if (result) {
        console.log(`Cache HIT: ${scanUri}`);
        // Update cachedAt to mark as recently used (for LRU)
        updateCachedAt(scanUri).catch(console.error);
        resolve(result.imageData);
      } else {
        console.log(`Cache MISS: ${scanUri}`);
        resolve(null);
      }
    };
  });
}

/**
 * Update the cachedAt timestamp for LRU tracking.
 */
async function updateCachedAt(scanUri: string): Promise<void> {
  const db = await initializeCache();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(scanUri);

    getRequest.onsuccess = () => {
      const existing = getRequest.result as CachedScatteringImage | undefined;
      if (existing) {
        existing.cachedAt = Date.now();
        store.put(existing);
      }
      resolve();
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Cache image data. Automatically enforces storage limits via LRU eviction.
 */
export async function cacheProcessedImage(
  scanUri: string,
  imageData: ProcessedImageData
): Promise<void> {
  const db = await initializeCache();

  // First, enforce storage limit
  await enforceStorageLimit(db);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const cacheEntry: CachedScatteringImage = {
      scanUri,
      imageData,
      cachedAt: Date.now(),
    };

    const request = store.put(cacheEntry);

    request.onerror = () => {
      console.error('Error caching image:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log(`Cached: ${scanUri}`);
      resolve();
    };
  });
}

/**
 * Enforce the maximum number of cached entries using LRU eviction.
 */
async function enforceStorageLimit(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const countRequest = store.count();

    countRequest.onsuccess = () => {
      const count = countRequest.result;

      if (count < MAX_ENTRIES) {
        resolve();
        return;
      }

      // Need to evict oldest entries
      const toDelete = count - MAX_ENTRIES + 1; // +1 to make room for new entry
      const index = store.index('cachedAt');
      const cursorRequest = index.openCursor(); // Opens in ascending order (oldest first)
      let deleted = 0;

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor && deleted < toDelete) {
          const scanUri = cursor.value.scanUri;
          store.delete(scanUri);
          console.log(`Evicted from cache (LRU): ${scanUri}`);
          deleted++;
          cursor.continue();
        } else {
          resolve();
        }
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    };

    countRequest.onerror = () => reject(countRequest.error);
  });
}

/**
 * Clear all cached images.
 */
export async function clearCache(): Promise<void> {
  const db = await initializeCache();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => {
      console.error('Error clearing cache:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('Cache cleared');
      resolve();
    };
  });
}

/**
 * Get cache statistics.
 */
export async function getCacheStats(): Promise<CacheStats> {
  const db = await initializeCache();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const cursorRequest = store.openCursor();

    let count = 0;
    let totalSize = 0;

    cursorRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

      if (cursor) {
        count++;
        totalSize += cursor.value.size || 0;
        cursor.continue();
      } else {
        resolve({
          count,
          totalSize,
          maxEntries: MAX_ENTRIES,
        });
      }
    };

    cursorRequest.onerror = () => reject(cursorRequest.error);
  });
}

/**
 * Backend response format for image data.
 */
interface BackendImageResponse {
  image: Uint8Array;
  shape: [number, number];
  dtype: string;
  scan_uri: string;
  mask_uri?: string | null;

  // GISAXS-specific fields (only present for GISAXS with calibration)
  gisaxs_transformed?: {
    image: Uint8Array;
    shape: [number, number];
    qip_values: number[];
    qoop_values: number[];
  };
  gisaxs_pixel_q?: {
    qip_matrix: Uint8Array;
    qoop_matrix: Uint8Array;
    shape: [number, number];
  };
}

/**
 * Deserialize backend response containing image data.
 */
function deserializeBackendResponse(buffer: ArrayBuffer): ProcessedImageData {
  const decoded = unpack(new Uint8Array(buffer)) as BackendImageResponse;

  const result: ProcessedImageData = {
    array: reconstructFloat32Array(decoded.image, decoded.shape),
  };

  // Add GISAXS-specific data if present
  if (decoded.gisaxs_transformed) {
    const transformed = decoded.gisaxs_transformed;
    result.gisaxsTransformed = {
      array: reconstructFloat32Array(transformed.image, transformed.shape),
      qipValues: transformed.qip_values,
      qoopValues: transformed.qoop_values,
    };
  }

  if (decoded.gisaxs_pixel_q) {
    const pixelQ = decoded.gisaxs_pixel_q;
    result.gisaxsPixelQ = {
      qipMatrix: reconstructFloat32Array(pixelQ.qip_matrix, pixelQ.shape),
      qoopMatrix: reconstructFloat32Array(pixelQ.qoop_matrix, pixelQ.shape),
    };
  }

  return result;
}

/**
 * Create a cache key that includes relevant parameters.
 * For GISAXS, includes calibration hash to invalidate on calibration change.
 */
function createCacheKey(
  scanUri: string,
  maskUri?: string | null,
  experimentType?: string,
  calibration?: GISAXSCalibrationParams | null
): string {
  let key = scanUri;

  if (maskUri) {
    key += `|mask=${maskUri}`;
  }

  // For GISAXS, include calibration hash since different calibration = different transform
  if (experimentType === 'GISAXS' && calibration) {
    const calibHash = `${calibration.sample_detector_distance}_${calibration.beam_center_x}_${calibration.beam_center_y}_${calibration.incident_angle}`;
    key += `|gisaxs=${calibHash}`;
  }

  return key;
}

/**
 * Fetch and cache an image from backend.
 * Returns processed image data ready for display.
 *
 * @param scanUri - The scan URI to fetch
 * @param maskUri - Optional mask URI to apply (masked pixels become NaN)
 * @param experimentType - 'SAXS' or 'GISAXS' (default: 'SAXS')
 * @param calibration - Calibration parameters (required for GISAXS transform)
 */
export async function fetchWithCache(
  scanUri: string,
  maskUri?: string | null,
  experimentType?: string,
  calibration?: GISAXSCalibrationParams | null
): Promise<ProcessedImageData> {
  // Create cache key that includes all relevant parameters
  const cacheKey = createCacheKey(scanUri, maskUri, experimentType, calibration);

  // Try to get from cache first
  const cached = await getCachedImage(cacheKey);
  if (cached) {
    return cached;
  }

  // Cache miss - fetch from server
  const url = new URL('/api/fetch-scan-image', window.location.origin);
  url.searchParams.append('scan_uri', scanUri);

  if (maskUri) {
    url.searchParams.append('mask_uri', maskUri);
  }

  // Add experiment type
  if (experimentType) {
    url.searchParams.append('experiment_type', experimentType);
  }

  // Add calibration params for GISAXS
  if (experimentType === 'GISAXS' && calibration) {
    url.searchParams.append('sample_detector_distance', String(calibration.sample_detector_distance));
    url.searchParams.append('beam_center_x', String(calibration.beam_center_x));
    url.searchParams.append('beam_center_y', String(calibration.beam_center_y));
    url.searchParams.append('pixel_size_x', String(calibration.pixel_size_x));
    url.searchParams.append('pixel_size_y', String(calibration.pixel_size_y));
    url.searchParams.append('wavelength', String(calibration.wavelength));
    url.searchParams.append('incident_angle', String(calibration.incident_angle));
    if (calibration.tilt !== undefined) {
      url.searchParams.append('tilt', String(calibration.tilt));
    }
    if (calibration.tilt_plan_rotation !== undefined) {
      url.searchParams.append('tilt_plan_rotation', String(calibration.tilt_plan_rotation));
    }
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch scattering image: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();

  // Deserialize response from backend
  const imageData = deserializeBackendResponse(buffer);

  // Cache the processed result asynchronously (don't block return)
  cacheProcessedImage(cacheKey, imageData).catch((error) => {
    console.error('Failed to cache image:', error);
  });

  return imageData;
}
