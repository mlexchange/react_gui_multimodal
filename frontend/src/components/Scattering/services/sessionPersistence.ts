/**
 * Session Persistence Service
 *
 * Handles saving and restoring application state to/from sessionStorage.
 * This enables the app to restore its state when the page is refreshed,
 * but the session is cleared when the tab is closed.
 * Each tab has its own independent session.
 */

import type {
  CalibrationParams,
  Linecut,
  InclinedLinecut,
  AzimuthalIntegration
} from '../types';
import type {
  BatchResultsStore,
  BatchParameterHashes
} from '../hooks/useBatchProcessing';

// Storage key for sessionStorage
const STORAGE_KEY = 'scattering_session_v1';

/**
 * Display settings stored in session
 */
export interface DisplaySettings {
  isLogScale: boolean;
  lowerPercentile: number;
  upperPercentile: number;
  normalization: string;
  imageColormap: string;
  differenceColormap: string;
  normalizationMode: string;
}

/**
 * Complete session state structure
 */
export interface SessionState {
  /** Schema version for future migrations */
  version: number;

  /** Tiled container path for the loaded data folder */
  containerPath: string | null;

  /** Selected image indices */
  leftImageIndex: number | "";
  rightImageIndex: number | "";

  /** Experiment type (SAXS or GISAXS) */
  experimentType: 'SAXS' | 'GISAXS';

  /** Calibration parameters */
  calibrationParams: CalibrationParams | null;

  /** Display/transformation settings */
  displaySettings: DisplaySettings;

  /** Linecut definitions (without extracted data) */
  horizontalLinecuts: Linecut[];
  verticalLinecuts: Linecut[];
  inclinedLinecuts: InclinedLinecut[];

  /** Which linecut types are currently active */
  selectedLinecuts: string[];

  /** Azimuthal integration definitions */
  azimuthalIntegrations: AzimuthalIntegration[];

  /** UI state */
  isSidebarCollapsed: boolean;
  isSummaryCollapsed: boolean;
  operationType: 'subtract' | 'divide';

  /** Batch processing results (optional for backward compatibility) */
  batchResults?: BatchResultsStore;
  batchParameterHashes?: BatchParameterHashes;
  batchSelectedScanUris?: string[];

  /** Timestamp when session was saved */
  savedAt: number;
}

/**
 * Default display settings
 */
const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  isLogScale: false,
  lowerPercentile: 1,
  upperPercentile: 99,
  normalization: 'none',
  imageColormap: 'Viridis',
  differenceColormap: 'RdBu',
  normalizationMode: 'together'
};

/**
 * Create a default/empty session state
 */
export function createDefaultSessionState(): SessionState {
  return {
    version: 1,
    containerPath: null,
    leftImageIndex: "",
    rightImageIndex: "",
    experimentType: 'SAXS',
    calibrationParams: null,
    displaySettings: { ...DEFAULT_DISPLAY_SETTINGS },
    horizontalLinecuts: [],
    verticalLinecuts: [],
    inclinedLinecuts: [],
    selectedLinecuts: [],
    azimuthalIntegrations: [],
    isSidebarCollapsed: false,
    isSummaryCollapsed: false,
    operationType: 'subtract',
    savedAt: Date.now()
  };
}

/**
 * Save session state to sessionStorage
 *
 * @param state - The session state to save
 * @returns true if save was successful, false otherwise
 */
export function saveSession(state: SessionState): boolean {
  try {
    const stateToSave: SessionState = {
      ...state,
      savedAt: Date.now()
    };

    const serialized = JSON.stringify(stateToSave);
    sessionStorage.setItem(STORAGE_KEY, serialized);

    return true;
  } catch (error) {
    // Handle quota exceeded or other storage errors
    console.error('Failed to save session to sessionStorage:', error);
    return false;
  }
}

/**
 * Load session state from sessionStorage
 *
 * @returns The loaded session state, or null if no valid session exists
 */
export function loadSession(): SessionState | null {
  try {
    const serialized = sessionStorage.getItem(STORAGE_KEY);

    if (!serialized) {
      return null;
    }

    const state = JSON.parse(serialized) as SessionState;

    // Validate the loaded state
    if (!isValidSessionState(state)) {
      console.warn('Invalid session state found in sessionStorage, clearing...');
      clearSession();
      return null;
    }

    return state;
  } catch (error) {
    console.error('Failed to load session from sessionStorage:', error);
    return null;
  }
}

/**
 * Clear the saved session from sessionStorage
 */
export function clearSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear session from sessionStorage:', error);
  }
}

/**
 * Validate the structure of a session state object
 *
 * @param state - The object to validate
 * @returns true if the object has the correct structure
 */
function isValidSessionState(state: unknown): state is SessionState {
  if (typeof state !== 'object' || state === null) {
    return false;
  }

  const s = state as Partial<SessionState>;

  // Check required fields exist and have correct types
  if (typeof s.version !== 'number') return false;
  if (s.containerPath !== null && typeof s.containerPath !== 'string') return false;
  if (s.leftImageIndex !== "" && typeof s.leftImageIndex !== 'number') return false;
  if (s.rightImageIndex !== "" && typeof s.rightImageIndex !== 'number') return false;
  if (s.experimentType !== 'SAXS' && s.experimentType !== 'GISAXS') return false;
  if (s.calibrationParams !== null && typeof s.calibrationParams !== 'object') return false;
  if (typeof s.displaySettings !== 'object') return false;
  if (!Array.isArray(s.horizontalLinecuts)) return false;
  if (!Array.isArray(s.verticalLinecuts)) return false;
  if (!Array.isArray(s.inclinedLinecuts)) return false;
  if (!Array.isArray(s.selectedLinecuts)) return false;
  if (!Array.isArray(s.azimuthalIntegrations)) return false;
  if (typeof s.isSidebarCollapsed !== 'boolean') return false;
  if (typeof s.isSummaryCollapsed !== 'boolean') return false;
  if (s.operationType !== 'subtract' && s.operationType !== 'divide') return false;
  if (typeof s.savedAt !== 'number') return false;

  return true;
}

/**
 * Get the age of a session in a human-readable format
 *
 * @param state - The session state
 * @returns A string describing how old the session is
 */
export function getSessionAge(state: SessionState): string {
  const age = Date.now() - state.savedAt;
  const hours = Math.floor(age / (60 * 60 * 1000));
  const minutes = Math.floor((age % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
}
