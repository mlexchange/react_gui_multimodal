/**
 * useSessionPersistence Hook
 *
 * React hook for managing session persistence with debounced auto-save.
 * Handles saving/restoring application state to/from sessionStorage.
 * Session persists within a tab (survives refresh) but is cleared when tab closes.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { debounce } from 'lodash';
import {
  SessionState,
  DisplaySettings,
  saveSession,
  loadSession,
  clearSession,
} from '../services/sessionPersistence';
import type {
  CalibrationParams,
  Linecut,
  InclinedLinecut,
  AzimuthalIntegration
} from '../types';

// Auto-save debounce delay in milliseconds
const AUTO_SAVE_DEBOUNCE_MS = 1000;

/**
 * Input state that can be persisted
 */
export interface PersistableState {
  containerPath: string | null;
  leftImageIndex: number | "";
  rightImageIndex: number | "";
  experimentType: 'SAXS' | 'GISAXS';
  calibrationParams: CalibrationParams;
  displaySettings: DisplaySettings;
  horizontalLinecuts: Linecut[];
  verticalLinecuts: Linecut[];
  inclinedLinecuts: InclinedLinecut[];
  selectedLinecuts: string[];
  azimuthalIntegrations: AzimuthalIntegration[];
  isSidebarCollapsed: boolean;
  isRawDataCollapsed: boolean;
  operationType: 'subtract' | 'divide';
}

/**
 * Return type for the useSessionPersistence hook
 */
export interface UseSessionPersistenceReturn {
  /** Whether session restoration is in progress */
  isRestoring: boolean;

  /** Whether a session has been successfully restored */
  hasRestoredSession: boolean;

  /** The restored session state (null if no session or restoration failed) */
  restoredSession: SessionState | null;

  /** Manually save the current state */
  saveCurrentState: (state: PersistableState) => void;

  /** Trigger debounced auto-save with current state */
  triggerAutoSave: (state: PersistableState) => void;

  /** Clear the saved session */
  clearSavedSession: () => void;

  /** Timestamp of last successful save */
  lastSaveTime: number | null;
}

/**
 * Hook for managing session persistence
 *
 * @returns Session persistence utilities and state
 */
export default function useSessionPersistence(): UseSessionPersistenceReturn {
  const [isRestoring, setIsRestoring] = useState(true);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const [restoredSession, setRestoredSession] = useState<SessionState | null>(null);
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);

  // Ref to track if component is mounted (for async operations)
  const isMountedRef = useRef(true);

  // Create debounced save function
  const debouncedSave = useRef(
    debounce((state: PersistableState) => {
      if (!isMountedRef.current) return;

      const sessionState: SessionState = {
        version: 1,
        ...state,
        savedAt: Date.now()
      };

      const success = saveSession(sessionState);
      if (success && isMountedRef.current) {
        setLastSaveTime(Date.now());
      }
    }, AUTO_SAVE_DEBOUNCE_MS)
  ).current;

  // Restore session on mount
  useEffect(() => {
    const session = loadSession();

    if (session) {
      setRestoredSession(session);
      setHasRestoredSession(true);
    }

    setIsRestoring(false);

    // Cleanup
    return () => {
      isMountedRef.current = false;
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  /**
   * Manually save the current state immediately
   */
  const saveCurrentState = useCallback((state: PersistableState) => {
    const sessionState: SessionState = {
      version: 1,
      ...state,
      savedAt: Date.now()
    };

    const success = saveSession(sessionState);
    if (success) {
      setLastSaveTime(Date.now());
    }
  }, []);

  /**
   * Trigger debounced auto-save
   */
  const triggerAutoSave = useCallback((state: PersistableState) => {
    debouncedSave(state);
  }, [debouncedSave]);

  /**
   * Clear the saved session
   */
  const clearSavedSession = useCallback(() => {
    clearSession();
    setRestoredSession(null);
    setHasRestoredSession(false);
    setLastSaveTime(null);
  }, []);

  return {
    isRestoring,
    hasRestoredSession,
    restoredSession,
    saveCurrentState,
    triggerAutoSave,
    clearSavedSession,
    lastSaveTime
  };
}

// Re-export types for convenience
export type { SessionState, DisplaySettings };
