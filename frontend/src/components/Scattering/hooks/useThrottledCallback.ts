/**
 * useThrottledCallback - A hook that provides a throttled version of a callback
 * that properly handles dependency changes without stale closures.
 *
 * This pattern avoids the need for eslint-disable comments on exhaustive-deps
 * by storing the latest callback in a ref and only recreating the throttled
 * function when the wait time changes.
 */

import { useRef, useEffect, useMemo } from "react";
import { throttle, ThrottleSettings } from "lodash";

/**
 * Creates a throttled version of a callback that always uses the latest
 * version of the callback, avoiding stale closure issues.
 *
 * @param callback - The callback function to throttle
 * @param wait - The number of milliseconds to throttle invocations to
 * @param options - Optional lodash throttle settings (leading, trailing)
 * @returns A throttled version of the callback
 *
 * @example
 * const throttledUpdate = useThrottledCallback(
 *   (id: number, value: number) => {
 *     // Uses latest state/props without stale closure issues
 *     updatePosition(id, value);
 *   },
 *   200
 * );
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  wait: number,
  options?: ThrottleSettings
): T {
  // Store the latest callback in a ref to avoid stale closures
  const callbackRef = useRef(callback);

  // Always update the ref to the latest callback
  // This ensures the throttled function always calls the latest version
  useEffect(() => {
    callbackRef.current = callback;
  });

  // Create the throttled function once (or when wait/options change)
  // The throttled function calls through the ref, so it always gets the latest callback
  const throttledFn = useMemo(
    () =>
      throttle(
        (...args: Parameters<T>) => {
          return callbackRef.current(...args);
        },
        wait,
        options
      ),
    [wait, options]
  );

  // Clean up the throttled function on unmount
  useEffect(() => {
    return () => {
      throttledFn.cancel();
    };
  }, [throttledFn]);

  return throttledFn as unknown as T;
}

export default useThrottledCallback;
