import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ndarray from "ndarray";
import { ScaleType } from "@h5web/lib";
import { HeatmapPanel } from "../HeatmapPanel";
import type { ColorScaleType } from "../utils/constants";

// Mock the H5Web components
vi.mock("@h5web/lib", async () => {
  const actual = await vi.importActual("@h5web/lib");
  return {
    ...actual,
    VisCanvas: ({
      children,
      abscissaConfig,
      ordinateConfig
    }: {
      children: React.ReactNode;
      abscissaConfig: { label: string };
      ordinateConfig: { label: string };
    }) => (
      <div data-testid="vis-canvas">
        <span data-testid="x-axis-label">{abscissaConfig.label}</span>
        <span data-testid="y-axis-label">{ordinateConfig.label}</span>
        {children}
      </div>
    ),
    HeatmapMesh: () => <div data-testid="heatmap-mesh">Heatmap Rendered</div>,
    TooltipMesh: () => <div data-testid="tooltip-mesh" />,
    ColorBar: ({ domain }: { domain: [number, number] }) => (
      <div data-testid="color-bar">
        Domain: {domain[0]} - {domain[1]}
      </div>
    ),
    DefaultInteractions: () => null,
    ResetZoomButton: () => null
  };
});

// Mock overlay components
vi.mock("../utils/generateOverlays", () => ({
  LinecutOverlay: ({ linecuts }: { linecuts: Array<{ hidden?: boolean }> }) => (
    <div data-testid="linecut-overlay">
      {linecuts.filter((l) => !l.hidden).length} visible overlays
    </div>
  ),
  InclinedLinecutOverlay: () => <div data-testid="inclined-linecut-overlay" />,
  AzimuthalSectorOverlay: ({
    integrations
  }: {
    integrations: Array<{ hidden?: boolean }>;
  }) => (
    <div data-testid="azimuthal-overlay">
      {integrations.filter((i) => !i.hidden).length} visible sectors
    </div>
  ),
  MaskOverlay: () => <div data-testid="mask-overlay" />,
  BeamCenterOverlay: () => <div data-testid="beam-center-overlay" />
}));

// Helper to create dummy ndarray data
const createDummyData = (
  rows: number,
  cols: number
): ndarray.NdArray<Float32Array> => {
  const data = new Float32Array(rows * cols);
  for (let i = 0; i < rows * cols; i++) {
    data[i] = Math.random() * 100;
  }
  return ndarray(data, [rows, cols]);
};

describe("HeatmapPanel Component", () => {
  const defaultProps = {
    dataArray: createDummyData(100, 100),
    domain: [0, 100] as [number, number],
    colorMap: "Viridis" as const,
    scaleType: ScaleType.Linear as ColorScaleType,
    rows: 100,
    cols: 100
  };

  describe("Basic Rendering", () => {
    it("renders the heatmap mesh with valid data", () => {
      render(<HeatmapPanel {...defaultProps} />);

      expect(screen.getByTestId("heatmap-mesh")).toBeInTheDocument();
      expect(screen.getByText("Heatmap Rendered")).toBeInTheDocument();
    });

    it("renders the color bar", () => {
      render(<HeatmapPanel {...defaultProps} />);

      expect(screen.getByTestId("color-bar")).toBeInTheDocument();
    });

    it("renders with correct domain in color bar", () => {
      render(<HeatmapPanel {...defaultProps} domain={[10, 200]} />);

      expect(screen.getByText("Domain: 10 - 200")).toBeInTheDocument();
    });

    it("renders VisCanvas container", () => {
      render(<HeatmapPanel {...defaultProps} />);

      expect(screen.getByTestId("vis-canvas")).toBeInTheDocument();
    });
  });

  describe("Axis Labels", () => {
    it("shows pixel axis labels when Q-space axes are disabled", () => {
      render(<HeatmapPanel {...defaultProps} showQSpaceAxes={false} />);

      expect(screen.getByTestId("x-axis-label")).toHaveTextContent(
        "X (pixels)"
      );
      expect(screen.getByTestId("y-axis-label")).toHaveTextContent(
        "Y (pixels)"
      );
    });

    it("shows Q-space axis labels when enabled for SAXS", () => {
      const qXVector = Array(100)
        .fill(0)
        .map((_, i) => i * 0.01);
      const qYVector = Array(100)
        .fill(0)
        .map((_, j) => j * 0.01);

      render(
        <HeatmapPanel
          {...defaultProps}
          showQSpaceAxes={true}
          experimentType="SAXS"
          qXVector={qXVector}
          qYVector={qYVector}
        />
      );

      expect(screen.getByTestId("x-axis-label")).toHaveTextContent("qₓ");
      expect(screen.getByTestId("y-axis-label")).toHaveTextContent("qᵧ");
    });

    it("shows GISAXS axis labels when enabled for GISAXS", () => {
      const qXVector = Array(100)
        .fill(0)
        .map((_, i) => i * 0.01);
      const qYVector = Array(100)
        .fill(0)
        .map((_, j) => j * 0.01);

      render(
        <HeatmapPanel
          {...defaultProps}
          showQSpaceAxes={true}
          experimentType="GISAXS"
          qXVector={qXVector}
          qYVector={qYVector}
          gisaxsQipValues={Array(100)
            .fill(0)
            .map((_, i) => i * 0.01)}
          gisaxsQoopValues={Array(100)
            .fill(0)
            .map((_, i) => i * 0.01)}
        />
      );

      expect(screen.getByTestId("x-axis-label")).toHaveTextContent(
        "q (in-plane)"
      );
      expect(screen.getByTestId("y-axis-label")).toHaveTextContent(
        "q (out-of-plane)"
      );
    });
  });

  describe("Loading State", () => {
    it("shows loading spinner when isLoading is true", () => {
      render(<HeatmapPanel {...defaultProps} isLoading={true} />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("shows custom loading message when provided", () => {
      render(
        <HeatmapPanel
          {...defaultProps}
          isLoading={true}
          loadingMessage="Fetching image data..."
        />
      );

      expect(screen.getByText("Fetching image data...")).toBeInTheDocument();
    });

    it("does not show loading spinner when isLoading is false", () => {
      render(<HeatmapPanel {...defaultProps} isLoading={false} />);

      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });
  });

  describe("Header", () => {
    it("renders custom header when provided", () => {
      render(
        <HeatmapPanel
          {...defaultProps}
          header={<span data-testid="custom-header">Image 1</span>}
        />
      );

      expect(screen.getByTestId("custom-header")).toBeInTheDocument();
      expect(screen.getByText("Image 1")).toBeInTheDocument();
    });
  });

  describe("Linecut Overlays", () => {
    it("renders linecut overlays when linecuts are provided", () => {
      const linecuts = [
        {
          position: 50,
          width: 10,
          color: "#ff0000",
          type: "horizontal" as const
        },
        { position: 30, width: 5, color: "#0000ff", type: "vertical" as const }
      ];

      render(
        <HeatmapPanel
          {...defaultProps}
          linecuts={linecuts}
          showLinecutOverlays={true}
        />
      );

      expect(screen.getByTestId("linecut-overlay")).toBeInTheDocument();
      expect(screen.getByText("2 visible overlays")).toBeInTheDocument();
    });

    it("does not render linecut overlays when showLinecutOverlays is false", () => {
      const linecuts = [
        {
          position: 50,
          width: 10,
          color: "#ff0000",
          type: "horizontal" as const
        }
      ];

      render(
        <HeatmapPanel
          {...defaultProps}
          linecuts={linecuts}
          showLinecutOverlays={false}
        />
      );

      expect(screen.queryByTestId("linecut-overlay")).not.toBeInTheDocument();
    });

    it("does not render linecut overlays when linecuts array is empty", () => {
      render(
        <HeatmapPanel
          {...defaultProps}
          linecuts={[]}
          showLinecutOverlays={true}
        />
      );

      expect(screen.queryByTestId("linecut-overlay")).not.toBeInTheDocument();
    });
  });

  describe("Azimuthal Overlays", () => {
    it("renders azimuthal overlays when integrations are provided", () => {
      const azimuthalIntegrations = [
        {
          qRange: [0.1, 2.0] as [number, number],
          azimuthRange: [-180, 180] as [number, number],
          color: "#00ff00"
        },
        {
          qRange: [0.5, 1.5] as [number, number],
          azimuthRange: [-90, 90] as [number, number],
          color: "#ff00ff"
        }
      ];

      render(
        <HeatmapPanel
          {...defaultProps}
          azimuthalIntegrations={azimuthalIntegrations}
          showLinecutOverlays={true}
        />
      );

      expect(screen.getByTestId("azimuthal-overlay")).toBeInTheDocument();
      expect(screen.getByText("2 visible sectors")).toBeInTheDocument();
    });

    it("does not render azimuthal overlays when disabled", () => {
      const azimuthalIntegrations = [
        {
          qRange: [0.1, 2.0] as [number, number],
          azimuthRange: [-180, 180] as [number, number],
          color: "#00ff00"
        }
      ];

      render(
        <HeatmapPanel
          {...defaultProps}
          azimuthalIntegrations={azimuthalIntegrations}
          showLinecutOverlays={false}
        />
      );

      expect(screen.queryByTestId("azimuthal-overlay")).not.toBeInTheDocument();
    });
  });

  describe("Mask Overlay", () => {
    it("renders mask overlay when mask data is provided and enabled", () => {
      const maskData = new Uint8Array(100 * 100);
      const maskShape: [number, number] = [100, 100];

      render(
        <HeatmapPanel
          {...defaultProps}
          maskData={maskData}
          maskShape={maskShape}
          showMaskOverlay={true}
        />
      );

      expect(screen.getByTestId("mask-overlay")).toBeInTheDocument();
    });

    it("does not render mask overlay when showMaskOverlay is false", () => {
      const maskData = new Uint8Array(100 * 100);
      const maskShape: [number, number] = [100, 100];

      render(
        <HeatmapPanel
          {...defaultProps}
          maskData={maskData}
          maskShape={maskShape}
          showMaskOverlay={false}
        />
      );

      expect(screen.queryByTestId("mask-overlay")).not.toBeInTheDocument();
    });
  });

  describe("Beam Center Overlay", () => {
    it("renders beam center overlay when enabled", () => {
      render(
        <HeatmapPanel
          {...defaultProps}
          beamCenterX={50}
          beamCenterY={50}
          showBeamCenterOverlay={true}
        />
      );

      expect(screen.getByTestId("beam-center-overlay")).toBeInTheDocument();
    });

    it("does not render beam center overlay when disabled", () => {
      render(
        <HeatmapPanel
          {...defaultProps}
          beamCenterX={50}
          beamCenterY={50}
          showBeamCenterOverlay={false}
        />
      );

      expect(
        screen.queryByTestId("beam-center-overlay")
      ).not.toBeInTheDocument();
    });
  });
});
