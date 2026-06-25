import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScaleType, type AxisScaleType } from "@h5web/lib";
import LinecutFig from "../LinecutFig";
import type { Linecut } from "../types";

// Mock the H5Web components
vi.mock("@h5web/lib", async () => {
  const actual = await vi.importActual("@h5web/lib");
  return {
    ...actual,
    VisCanvas: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="linecut-vis-canvas">{children}</div>
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
    TooltipMesh: () => <div data-testid="tooltip-mesh" />,
    XAxisZoom: () => null,
    YAxisZoom: () => null,
    Pan: () => null,
    SelectToZoom: () => null,
    ResetZoomButton: () => null
  };
});

// Helper to create mock linecut data
const createMockLinecutData = (numPoints: number = 100) => ({
  qValues: Array(numPoints)
    .fill(0)
    .map((_, i) => i * 0.01),
  intensities: Array(numPoints)
    .fill(0)
    .map(() => Math.random() * 1000),
  success: true,
  errorMessage: null
});

const createMockLinecut = (
  id: number,
  position: number = 0.5,
  width: number = 0.1
): Linecut => ({
  id,
  position,
  width,
  pixelPosition: Math.floor(position * 100),
  leftColor: "#ff0000",
  rightColor: "#0000ff",
  hidden: false
});

// Create dummy Q vectors
const createQVector = (length: number, scale: number = 0.01) =>
  Array(length)
    .fill(null)
    .map((_, i) => i * scale);

describe("LinecutFig Component", () => {
  const defaultProps = {
    direction: "horizontal" as const,
    linecuts: [createMockLinecut(1)],
    zoomedXPixelRange: null as [number, number] | null,
    zoomedYPixelRange: null as [number, number] | null,
    qXVector: createQVector(100),
    qYVector: createQVector(100),
    units: "nm⁻¹",
    leftLinecutData: new Map([[1, createMockLinecutData()]]),
    rightLinecutData: new Map([[1, createMockLinecutData()]]),
    yScaleType: ScaleType.Linear as AxisScaleType
  };

  describe("Basic Rendering", () => {
    it("renders the line plot container", () => {
      render(<LinecutFig {...defaultProps} />);

      expect(screen.getByTestId("linecut-vis-canvas")).toBeInTheDocument();
    });

    it("renders data curves for linecuts with data", () => {
      render(<LinecutFig {...defaultProps} />);

      // Should render curves for both left and right data
      const curves = screen.getAllByTestId("data-curve");
      expect(curves.length).toBeGreaterThan(0);
    });
  });

  describe("Direction Variants", () => {
    it("renders horizontal linecuts", () => {
      render(<LinecutFig {...defaultProps} direction="horizontal" />);

      expect(screen.getByTestId("linecut-vis-canvas")).toBeInTheDocument();
    });

    it("renders vertical linecuts", () => {
      render(<LinecutFig {...defaultProps} direction="vertical" />);

      expect(screen.getByTestId("linecut-vis-canvas")).toBeInTheDocument();
    });
  });

  describe("Multiple Linecuts", () => {
    it("renders multiple linecuts when provided", () => {
      const linecuts = [
        createMockLinecut(1, 0.3),
        createMockLinecut(2, 0.5),
        createMockLinecut(3, 0.7)
      ];

      const leftData = new Map([
        [1, createMockLinecutData()],
        [2, createMockLinecutData()],
        [3, createMockLinecutData()]
      ]);

      const rightData = new Map([
        [1, createMockLinecutData()],
        [2, createMockLinecutData()],
        [3, createMockLinecutData()]
      ]);

      render(
        <LinecutFig
          {...defaultProps}
          linecuts={linecuts}
          leftLinecutData={leftData}
          rightLinecutData={rightData}
        />
      );

      // Should have curves for each linecut
      const curves = screen.getAllByTestId("data-curve");
      expect(curves.length).toBe(6); // 3 linecuts x 2 (left + right)
    });
  });

  describe("Empty State", () => {
    it("shows 'No linecut data available' when no linecuts are provided", () => {
      render(
        <LinecutFig
          {...defaultProps}
          linecuts={[]}
          leftLinecutData={new Map()}
          rightLinecutData={new Map()}
        />
      );

      expect(screen.getByText("No linecut data available")).toBeInTheDocument();
    });

    it("shows 'No linecut data available' when linecut has no data", () => {
      render(
        <LinecutFig
          {...defaultProps}
          leftLinecutData={new Map()}
          rightLinecutData={new Map()}
        />
      );

      expect(screen.getByText("No linecut data available")).toBeInTheDocument();
    });
  });

  describe("Hidden Linecuts", () => {
    it("does not render curves for hidden linecuts", () => {
      const hiddenLinecut = { ...createMockLinecut(1), hidden: true };

      render(<LinecutFig {...defaultProps} linecuts={[hiddenLinecut]} />);

      // Hidden linecuts should not have visible curves
      const curves = screen.queryAllByTestId("data-curve");
      expect(curves.length).toBe(0);
    });
  });

  describe("Curve Colors", () => {
    it("uses correct colors from linecut configuration", () => {
      const linecut = {
        ...createMockLinecut(1),
        leftColor: "#ff5500",
        rightColor: "#0055ff"
      };

      render(<LinecutFig {...defaultProps} linecuts={[linecut]} />);

      const curves = screen.getAllByTestId("data-curve");
      const colors = curves.map((c) => c.getAttribute("data-color"));

      expect(colors).toContain("#ff5500");
      expect(colors).toContain("#0055ff");
    });
  });

  describe("With Zoom Range", () => {
    it("renders with zoomed pixel ranges", () => {
      render(
        <LinecutFig
          {...defaultProps}
          zoomedXPixelRange={[10, 90]}
          zoomedYPixelRange={[20, 80]}
        />
      );

      expect(screen.getByTestId("linecut-vis-canvas")).toBeInTheDocument();
    });
  });
});
