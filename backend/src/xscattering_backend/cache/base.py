"""
Generic LRU cache implementation for thread-safe caching.

Provides a reusable LRU (Least Recently Used) cache with O(1) operations
using OrderedDict. Thread-safe for concurrent access.
"""

import threading
from collections import OrderedDict
from typing import Callable, Generic, TypeVar

from xscattering_backend.config.logging import get_logger

K = TypeVar("K")
V = TypeVar("V")


class LRUCache(Generic[K, V]):
    """
    Thread-safe LRU cache with O(1) get/put operations.

    Uses OrderedDict for efficient LRU tracking. When the cache exceeds
    max_size, the least recently used entries are evicted.

    Args:
        max_size: Maximum number of entries to cache
        name: Cache name for logging (e.g., "GISAXS", "SAXS Q-matrix")
    """

    def __init__(self, max_size: int, name: str):
        self._cache: OrderedDict[K, V] = OrderedDict()
        self._lock = threading.Lock()
        self._max_size = max_size
        self._name = name
        self._logger = get_logger(__name__)

    def get(self, key: K) -> V | None:
        """
        Get a value from cache, updating LRU order.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found
        """
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                self._logger.debug(f"[{self._name}] HIT: {key}")
                return self._cache[key]
            self._logger.debug(f"[{self._name}] MISS: {key}")
            return None

    def put(self, key: K, value: V) -> None:
        """
        Store a value in cache, evicting oldest if full.

        Args:
            key: Cache key
            value: Value to cache
        """
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                self._cache[key] = value
                return

            # Evict oldest entries if at capacity
            while len(self._cache) >= self._max_size:
                oldest_key, _ = self._cache.popitem(last=False)
                self._logger.debug(f"[{self._name}] EVICT: {oldest_key}")

            self._cache[key] = value

    def get_or_compute(
        self,
        key: K,
        factory: Callable[[], V],
        check_after_compute: bool = True,
    ) -> V:
        """
        Get value from cache or compute and cache it.

        This method handles the common pattern of:
        1. Check cache (with lock)
        2. If miss, compute value (without lock for parallelism)
        3. Store result (with lock, checking if another thread added it)

        Args:
            key: Cache key
            factory: Function to compute value if not cached
            check_after_compute: If True, check cache again after computing
                                 (handles race conditions where another thread
                                 computed the same value)

        Returns:
            Cached or newly computed value
        """
        # Fast path: check cache
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                self._logger.debug(f"[{self._name}] HIT: {key}")
                return self._cache[key]

        self._logger.debug(f"[{self._name}] MISS: {key}")

        # Compute value outside lock for parallelism
        value = factory()

        # Store result
        with self._lock:
            if check_after_compute and key in self._cache:
                # Another thread added it while we were computing
                self._cache.move_to_end(key)
                self._logger.debug(f"[{self._name}] RACE: using existing value for {key}")
                return self._cache[key]

            # Evict oldest if at capacity
            while len(self._cache) >= self._max_size:
                oldest_key, _ = self._cache.popitem(last=False)
                self._logger.debug(f"[{self._name}] EVICT: {oldest_key}")

            self._cache[key] = value

        return value

    def invalidate(self, key: K | None = None, predicate: Callable[[K], bool] | None = None) -> int:
        """
        Invalidate cache entries.

        Args:
            key: If provided, invalidate only this key
            predicate: If provided, invalidate all keys where predicate(key) is True

        Returns:
            Number of entries invalidated
        """
        with self._lock:
            if key is None and predicate is None:
                # Clear entire cache
                count = len(self._cache)
                self._cache.clear()
                self._logger.info(f"[{self._name}] CLEAR: {count} entries")
                return count

            if key is not None:
                # Invalidate single key
                if key in self._cache:
                    del self._cache[key]
                    self._logger.debug(f"[{self._name}] INVALIDATE: {key}")
                    return 1
                return 0

            # Invalidate by predicate
            keys_to_remove = [k for k in self._cache if predicate(k)]
            for k in keys_to_remove:
                del self._cache[k]

            if keys_to_remove:
                self._logger.info(f"[{self._name}] INVALIDATE: {len(keys_to_remove)} entries")
            return len(keys_to_remove)

    def __len__(self) -> int:
        """Return number of cached entries."""
        with self._lock:
            return len(self._cache)

    def __contains__(self, key: K) -> bool:
        """Check if key is in cache (without updating LRU order)."""
        with self._lock:
            return key in self._cache
