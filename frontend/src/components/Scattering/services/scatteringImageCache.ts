/**
 * IndexedDB-based cache service for scan images.
 * Caches the last N fetched scans to avoid re-fetching when navigating between images.
 */

const DB_NAME = 'scattering_analysis_cache';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const MAX_ENTRIES = 25;

export interface CachedScatteringImage {
  scanUri: string;              // Primary key
  imageData: ArrayBuffer;       // msgpack binary
  metadata: {
    shape: [number, number];
    dtype: string;
  };
  cachedAt: number;             // Timestamp for LRU eviction
  size: number;                 // Size in bytes for stats
}

export interface CacheStats {
  count: number;
  totalSize: number;
  maxEntries: number;
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
export async function getCachedImage(scanUri: string): Promise<CachedScatteringImage | null> {
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
      } else {
        console.log(`Cache MISS: ${scanUri}`);
      }
      resolve(result || null);
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
 * Cache an image. Automatically enforces storage limits via LRU eviction.
 */
export async function cacheImage(
  scanUri: string,
  imageData: ArrayBuffer,
  metadata: { shape: [number, number]; dtype: string }
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
      metadata,
      cachedAt: Date.now(),
      size: imageData.byteLength,
    };

    const request = store.put(cacheEntry);

    request.onerror = () => {
      console.error('Error caching image:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log(`Cached: ${scanUri} (${(imageData.byteLength / 1024 / 1024).toFixed(1)} MB)`);
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
 * Fetch an image, using cache if available.
 * This is the main function to use for fetching scattering images.
 */
export async function fetchWithCache(scanUri: string): Promise<ArrayBuffer> {
  // Try to get from cache first
  const cached = await getCachedImage(scanUri);
  if (cached) {
    return cached.imageData;
  }

  // Cache miss - fetch from server
  const url = new URL('/api/fetch-scan-image', window.location.origin);
  url.searchParams.append('scan_uri', scanUri);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch scattering image: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();

  // Cache the result asynchronously (don't block return)
  // We need to decode to get metadata for caching
  const { unpack } = await import('msgpackr');
  const decoded = unpack(new Uint8Array(buffer)) as { metadata: { shape: [number, number]; dtype: string } };

  cacheImage(scanUri, buffer, decoded.metadata).catch((error) => {
    console.error('Failed to cache image:', error);
  });

  return buffer;
}
