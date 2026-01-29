import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SummaryFig from "../SummaryFig";

// Mock the H5Web components
vi.mock("@h5web/lib", async () => {
  const actual = await vi.importActual("@h5web/lib");
  return {
    ...actual,
    VisCanvas: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="summary-vis-canvas">{children}</div>
    ),
    DataCurve: ({
      abscissas,
      color
    }: {
      abscissas: number[];
      ordinates: number[];
      color: string;
    }) => (
      <div data-testid="data-curve" data-color={color}>
        Points: {abscissas.length}
      </div>
    ),
    DefaultInteractions: () => null,
    ResetZoomButton: () => null,
    TooltipMesh: () => <div data-testid="tooltip-mesh" />,
    Annotation: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="annotation">{children}</div>
    ),
    useVisCanvasContext: vi.fn(() => ({
      canvasArea: document.createElement("div"),
      htmlToData: vi.fn()
    })),
    CurveType: { LineAndGlyphs: "LineAndGlyphs", GlyphsOnly: "GlyphsOnly" },
    GlyphType: { Circle: "Circle" }
  };
});

// Mock @react-three/fiber
vi.mock("@react-three/fiber", () => ({
  useThree: vi.fn(() => ({
    camera: {}
  }))
}));

// Mock three.js Vector3
vi.mock("three", () => ({
  Vector3: vi.fn()
}));

// Mock the ToggleGroup component
vi.mock("@/components/ui", async () => {
  const actual = await vi.importActual("@/components/ui");
  return {
    ...actual,
    ToggleGroup: ({
      value,
      onValueChange,
      options
    }: {
      value: string;
      onValueChange: (v: string) => void;
      options: Array<{ value: string; label: string }>;
    }) => (
      <div data-testid="toggle-group">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onValueChange(opt.value)}
            data-selected={value === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )
  };
});

describe("SummaryFig Component", () => {
  const defaultProps = {
    maxIntensities: [100, 200, 150, 300, 250],
    avgIntensities: [50, 100, 75, 150, 125],
    leftImageIndex: 0 as number | "",
    rightImageIndex: 1 as number | "",
    onSelectImages: vi.fn(),
    displayOption: "both" as const,
    setDisplayOption: vi.fn(),
    imageNames: ["scan_001", "scan_002", "scan_003", "scan_004", "scan_005"]
  };

  describe("Basic Rendering", () => {
    it("renders the plot container with data", () => {
      render(<SummaryFig {...defaultProps} />);

      expect(screen.getByTestId("summary-vis-canvas")).toBeInTheDocument();
    });

    it("renders data curves for intensity data", () => {
      render(<SummaryFig {...defaultProps} />);

      const curves = screen.getAllByTestId("data-curve");
      // "both" display: max curve + avg curve + left marker + right marker = 4
      expect(curves.length).toBe(4);
    });

    it("renders display toggle buttons when data is present", () => {
      render(<SummaryFig {...defaultProps} />);

      expect(screen.getByTestId("toggle-group")).toBeInTheDocument();
      // "Average" and "Both" are unique to the toggle (legend uses "Max"/"Avg")
      expect(screen.getByText("Average")).toBeInTheDocument();
      expect(screen.getByText("Both")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows 'No data available' when no intensity data provided", () => {
      render(
        <SummaryFig {...defaultProps} maxIntensities={[]} avgIntensities={[]} />
      );

      expect(screen.getByText("No data available")).toBeInTheDocument();
    });

    it("does not show display toggle when no data", () => {
      render(
        <SummaryFig {...defaultProps} maxIntensities={[]} avgIntensities={[]} />
      );

      expect(screen.queryByTestId("toggle-group")).not.toBeInTheDocument();
    });
  });

  describe("Selected Image Markers", () => {
    it("renders L and R annotations for selected images", () => {
      render(<SummaryFig {...defaultProps} />);

      const annotations = screen.getAllByTestId("annotation");
      const texts = annotations.map((a) => a.textContent);
      expect(texts).toContain("L");
      expect(texts).toContain("R");
    });

    it("does not render markers when no images are selected", () => {
      render(
        <SummaryFig {...defaultProps} leftImageIndex="" rightImageIndex="" />
      );

      // Only the data curves, no marker curves
      const curves = screen.getAllByTestId("data-curve");
      // "both" display: max + avg = 2 curves (no markers)
      expect(curves.length).toBe(2);
    });
  });

  describe("Display Options", () => {
    it("renders only max curve when displayOption is 'max'", () => {
      render(
        <SummaryFig
          {...defaultProps}
          displayOption="max"
          leftImageIndex=""
          rightImageIndex=""
        />
      );

      const curves = screen.getAllByTestId("data-curve");
      // 1 max curve only
      expect(curves.length).toBe(1);
    });

    it("renders only avg curve when displayOption is 'avg'", () => {
      render(
        <SummaryFig
          {...defaultProps}
          displayOption="avg"
          leftImageIndex=""
          rightImageIndex=""
        />
      );

      const curves = screen.getAllByTestId("data-curve");
      // 1 avg curve only
      expect(curves.length).toBe(1);
    });
  });

  describe("Loading State", () => {
    it("shows loading overlay when fetching data with progress < 100", () => {
      render(
        <SummaryFig
          {...defaultProps}
          isFetchingData={true}
          progress={50}
          progressMessage="Loading scans..."
        />
      );

      expect(screen.getByText("Loading... 50%")).toBeInTheDocument();
    });

    it("shows 'Initializing...' when progress is 0", () => {
      render(
        <SummaryFig {...defaultProps} isFetchingData={true} progress={0} />
      );

      expect(screen.getByText("Initializing...")).toBeInTheDocument();
    });
  });
});
