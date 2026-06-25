import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useState } from "react";
import Scattering from "../Scattering";

// ============================================================================
// Hoisted mock for useSummary (allows per-test control of data-loaded state)
// ============================================================================
const mockUseSummary = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useSummary", () => ({
  default: mockUseSummary
}));

// Mock useSessionPersistence to avoid localStorage side effects
vi.mock("../hooks/useSessionPersistence", () => ({
  default: vi.fn(() => ({
    isRestoring: false,
    hasRestoredSession: false,
    restoredSession: null,
    triggerAutoSave: vi.fn()
  }))
}));

vi.mock("../CalibrationWidget", () => ({
  default: () => <div data-testid="calibration-widget">Calibration Form</div>
}));

vi.mock("../BatchProcessingWidget", () => ({
  BatchProcessingWidget: () => <div data-testid="batch-processing-widget" />
}));

// Mock the Tiled component
vi.mock("@blueskyproject/tiled", () => ({
  TiledContainerSelector: vi.fn(({ open, onClose }) =>
    open ? (
      <div data-testid="tiled-viewer">
        <button onClick={onClose}>Close Tiled Viewer</button>
      </div>
    ) : null
  ),
  Tiled: vi.fn(({ isButtonMode, buttonModeText, onSelectCallback }) => {
    // Track internal open state for the Tiled viewer
    const TiledWithState = () => {
      const [isOpen, setIsOpen] = useState(false);

      if (isButtonMode) {
        return (
          <>
            <button onClick={() => setIsOpen(true)}>{buttonModeText}</button>
            {isOpen && (
              <div data-testid="tiled-viewer">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    // Simulate selecting data
                    if (onSelectCallback) {
                      onSelectCallback({ path: "/test/data" });
                    }
                  }}
                >
                  Close Tiled Viewer
                </button>
              </div>
            )}
          </>
        );
      }
      return null;
    };
    return <TiledWithState />;
  })
}));

// Mock the Finch library components
vi.mock("@blueskyproject/finch", () => ({
  InputSlider: ({
    value,
    onChange
  }: {
    value: number;
    onChange: (v: number) => void;
  }) => (
    <input
      type="range"
      data-testid="input-slider"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  ),
  InputSliderRange: () => <div data-testid="input-slider-range" />,
  Button: ({
    text,
    cb,
    disabled,
    styles
  }: {
    text: string;
    cb?: () => void;
    disabled?: boolean;
    styles?: string;
  }) => (
    <button
      onClick={cb}
      disabled={disabled}
      className={styles}
      data-testid="finch-button"
    >
      {text}
    </button>
  ),
  ButtonWithIcon: ({
    text,
    cb,
    disabled,
    styles
  }: {
    text: string;
    cb?: () => void;
    disabled?: boolean;
    styles?: string;
    icon?: React.ReactNode;
    bgColor?: string;
    hoverBgColor?: string;
    size?: string;
  }) => (
    <button
      onClick={cb}
      disabled={disabled}
      className={styles}
      data-testid="finch-button-with-icon"
    >
      {text}
    </button>
  )
}));

// Mock the H5Web components that require WebGL
vi.mock("@h5web/lib", async () => {
  const actual = await vi.importActual("@h5web/lib");
  return {
    ...actual,
    VisCanvas: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="vis-canvas">{children}</div>
    ),
    HeatmapMesh: () => <div data-testid="heatmap-mesh" />,
    TooltipMesh: () => <div data-testid="tooltip-mesh" />,
    ColorBar: () => <div data-testid="color-bar" />,
    DefaultInteractions: () => null,
    ResetZoomButton: () => null,
    DataCurve: () => <div data-testid="data-curve" />,
    XAxisZoom: () => null,
    YAxisZoom: () => null,
    Pan: () => null,
    SelectToZoom: () => null,
    Toolbar: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Separator: () => null,
    DomainWidget: () => null,
    ColorMapSelector: () => null,
    ScaleSelector: () => null,
    ToggleBtn: () => null
  };
});

// Mock UI components with a testable native Select
vi.mock("@/components/ui", async () => {
  const actual = await vi.importActual("@/components/ui");
  return {
    ...actual,
    Select: ({
      label,
      value,
      onChange,
      data
    }: {
      label?: string;
      value: string | null;
      onChange: (value: string | null) => void;
      data: Array<{ value: string; label: string }>;
    }) => (
      <div>
        {label && <label>{label}</label>}
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          aria-label={label}
        >
          {data.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
    ),
    notifications: {
      show: vi.fn(),
      update: vi.fn(),
      hide: vi.fn()
    }
  };
});

// ============================================================================
// Helpers
// ============================================================================

/** Build a useSummary return value */
const createSummaryState = (overrides: Record<string, unknown> = {}) => ({
  leftImageIndex: "" as number | "",
  setLeftImageIndex: vi.fn(),
  rightImageIndex: "" as number | "",
  setRightImageIndex: vi.fn(),
  selectedContainerPath: "",
  setSelectedContainerPath: vi.fn(),
  isFetchingData: false,
  isLoadingImages: false,
  setIsLoadingImages: vi.fn(),
  numOfFiles: 0,
  progress: 0,
  progressMessage: "",
  maxIntensities: [] as number[],
  avgIntensities: [] as number[],
  imageNames: [] as string[],
  scanUris: [] as string[],
  fetchSummaryData: vi.fn().mockResolvedValue(undefined),
  handleImageIndicesChange: vi.fn(),
  handleTiledSelection: vi.fn(),
  displayOption: "both" as const,
  setDisplayOption: vi.fn(),
  ...overrides
});

const renderWithRouter = (component: React.ReactNode) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

// ============================================================================
// Tests
// ============================================================================

describe("Scattering Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSummary.mockReturnValue(createSummaryState());
  });

  describe("Initial Load State", () => {
    it("displays 'No data loaded' message when app first loads", () => {
      renderWithRouter(<Scattering standalone />);

      expect(screen.getByText("No data loaded")).toBeInTheDocument();
    });

    it("displays instruction to select a Tiled container", () => {
      renderWithRouter(<Scattering standalone />);

      expect(
        screen.getByText(/Please select a Tiled container/i)
      ).toBeInTheDocument();
    });

    it("shows 'Select Data' button in the sidebar", () => {
      renderWithRouter(<Scattering standalone />);

      const selectDataButton = screen.getByRole("button", {
        name: /select data/i
      });
      expect(selectDataButton).toBeInTheDocument();
    });
  });

  describe("Select Data Button", () => {
    it("opens the Tiled viewer when 'Select Data' button is clicked", async () => {
      renderWithRouter(<Scattering standalone />);

      const selectDataButton = screen.getByRole("button", {
        name: /select data/i
      });
      fireEvent.click(selectDataButton);

      await waitFor(() => {
        expect(screen.getByTestId("tiled-viewer")).toBeInTheDocument();
      });
    });
  });

  describe("Calibration Button", () => {
    it("shows calibration button (disabled when no data is loaded)", () => {
      renderWithRouter(<Scattering standalone />);

      const calibrationButton = screen.getByRole("button", {
        name: /calibration/i
      });
      expect(calibrationButton).toBeInTheDocument();
      expect(calibrationButton).toBeDisabled();
    });

    it("calibration button is disabled without data loaded", () => {
      renderWithRouter(<Scattering standalone />);

      const calibrationButton = screen.getByRole("button", {
        name: /calibration/i
      });

      expect(calibrationButton).toBeDisabled();
    });
  });

  describe("Calibration Interaction", () => {
    it("shows 'Calibration required' button when data is loaded but no calibration set", () => {
      mockUseSummary.mockReturnValue(createSummaryState({ numOfFiles: 5 }));
      renderWithRouter(<Scattering standalone />);

      const button = screen.getByRole("button", {
        name: /calibration required/i
      });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it("opens the calibration modal when 'Calibration required' button is clicked", async () => {
      mockUseSummary.mockReturnValue(createSummaryState({ numOfFiles: 5 }));
      renderWithRouter(<Scattering standalone />);

      const button = screen.getByRole("button", {
        name: /calibration required/i
      });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText("Calibration parameters")).toBeInTheDocument();
      });
    });

    it("renders calibration widget inside the opened modal", async () => {
      mockUseSummary.mockReturnValue(createSummaryState({ numOfFiles: 5 }));
      renderWithRouter(<Scattering standalone />);

      fireEvent.click(
        screen.getByRole("button", { name: /calibration required/i })
      );

      await waitFor(() => {
        expect(screen.getByTestId("calibration-widget")).toBeInTheDocument();
      });
    });
  });

  describe("Experiment Type Switching", () => {
    it("shows Azimuthal button in default SAXS mode", () => {
      renderWithRouter(<Scattering standalone />);

      expect(
        screen.getByRole("button", { name: /azimuthal/i })
      ).toBeInTheDocument();
    });

    it("hides Azimuthal button when switched to GISAXS mode", async () => {
      renderWithRouter(<Scattering standalone />);

      // Verify Azimuthal button exists in SAXS mode
      expect(
        screen.getByRole("button", { name: /azimuthal/i })
      ).toBeInTheDocument();

      // Switch to GISAXS
      const select = screen.getByLabelText("Experiment type");
      fireEvent.change(select, { target: { value: "GISAXS" } });

      // Azimuthal button should be removed
      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /azimuthal/i })
        ).not.toBeInTheDocument();
      });
    });

    it("shows Azimuthal button again when switched back to SAXS mode", async () => {
      renderWithRouter(<Scattering standalone />);

      // Switch to GISAXS
      const select = screen.getByLabelText("Experiment type");
      fireEvent.change(select, { target: { value: "GISAXS" } });

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /azimuthal/i })
        ).not.toBeInTheDocument();
      });

      // Switch back to SAXS
      fireEvent.change(select, { target: { value: "SAXS" } });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /azimuthal/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe("Linecut Buttons", () => {
    it("disables linecut buttons when no calibration is set", () => {
      renderWithRouter(<Scattering standalone />);

      const horizontalButton = screen.getByRole("button", {
        name: /horizontal/i
      });
      expect(horizontalButton).toBeDisabled();
    });

    it("shows tooltip explaining why linecut buttons are disabled", () => {
      renderWithRouter(<Scattering standalone />);

      const horizontalButton = screen.getByRole("button", {
        name: /horizontal/i
      });

      expect(horizontalButton).toHaveAttribute(
        "title",
        "Set calibration parameters first"
      );
    });
  });

  describe("Batch Processing Button", () => {
    it("shows Batch Processing button in the sidebar", () => {
      renderWithRouter(<Scattering standalone />);

      const batchButton = screen.getByRole("button", {
        name: /batch processing/i
      });
      expect(batchButton).toBeInTheDocument();
    });

    it("disables Batch Processing button when no data is loaded", () => {
      renderWithRouter(<Scattering standalone />);

      const batchButton = screen.getByRole("button", {
        name: /batch processing/i
      });
      expect(batchButton).toBeDisabled();
    });

    it("disables Batch Processing button when data loaded but no linecuts defined", () => {
      mockUseSummary.mockReturnValue(createSummaryState({ numOfFiles: 5 }));
      renderWithRouter(<Scattering standalone />);

      const batchButton = screen.getByRole("button", {
        name: /batch processing/i
      });
      expect(batchButton).toBeDisabled();
    });
  });
});
