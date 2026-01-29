import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AzimuthalIntegrationFig from "../AzimuthalIntegrationFig";
import type { AzimuthalIntegration, AzimuthalData } from "../types";

// Mock the H5Web components
vi.mock("@h5web/lib", async () => {
  const actual = await vi.importActual("@h5web/lib");
  return {
    ...actual,
    VisCanvas: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="azimuthal-vis-canvas">{children}</div>
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

const createMockIntegration = (
  id: number,
  overrides: Partial<AzimuthalIntegration> = {}
): AzimuthalIntegration => ({
  id,
  qRange: [0.1, 2.0],
  azimuthRange: [-180, 180],
  leftColor: "#ff0000",
  rightColor: "#0000ff",
  hidden: false,
  ...overrides
});

const createMockAzimuthalData = (
  id: number,
  numPoints: number = 100
): AzimuthalData => ({
  id,
  q: Array(numPoints)
    .fill(0)
    .map((_, i) => i * 0.02),
  intensity: Array(numPoints)
    .fill(0)
    .map(() => Math.random() * 1000),
  qArray: []
});

const createQMagnitudeMatrix = (rows: number, cols: number) =>
  Array(rows)
    .fill(null)
    .map((_, row) =>
      Array(cols)
        .fill(null)
        .map((_, col) => Math.sqrt(row * row + col * col) * 0.01)
    );

describe("AzimuthalIntegrationFig Component", () => {
  const defaultProps = {
    integrations: [createMockIntegration(1)],
    azimuthalData1: [createMockAzimuthalData(1)],
    azimuthalData2: [createMockAzimuthalData(1)],
    zoomedXPixelRange: null as [number, number] | null,
    zoomedYPixelRange: null as [number, number] | null,
    qMagnitudeMatrix: createQMagnitudeMatrix(100, 100)
  };

  describe("Basic Rendering", () => {
    it("renders the plot container", () => {
      render(<AzimuthalIntegrationFig {...defaultProps} />);

      expect(screen.getByTestId("azimuthal-vis-canvas")).toBeInTheDocument();
    });

    it("renders data curves for integrations with data", () => {
      render(<AzimuthalIntegrationFig {...defaultProps} />);

      const curves = screen.getAllByTestId("data-curve");
      // 1 integration × 2 (left + right) = 2 curves
      expect(curves.length).toBe(2);
    });
  });

  describe("Multiple Integrations", () => {
    it("renders correct number of curves for multiple integrations", () => {
      const integrations = [
        createMockIntegration(1),
        createMockIntegration(2, { azimuthRange: [-90, 90] }),
        createMockIntegration(3, { azimuthRange: [0, 180] })
      ];

      const data1 = [
        createMockAzimuthalData(1),
        createMockAzimuthalData(2),
        createMockAzimuthalData(3)
      ];
      const data2 = [
        createMockAzimuthalData(1),
        createMockAzimuthalData(2),
        createMockAzimuthalData(3)
      ];

      render(
        <AzimuthalIntegrationFig
          {...defaultProps}
          integrations={integrations}
          azimuthalData1={data1}
          azimuthalData2={data2}
        />
      );

      const curves = screen.getAllByTestId("data-curve");
      expect(curves.length).toBe(6); // 3 integrations × 2
    });
  });

  describe("Empty State", () => {
    it("shows empty message when no integrations are provided", () => {
      render(
        <AzimuthalIntegrationFig
          {...defaultProps}
          integrations={[]}
          azimuthalData1={[]}
          azimuthalData2={[]}
        />
      );

      expect(
        screen.getByText("No azimuthal integration data available")
      ).toBeInTheDocument();
    });

    it("shows empty message when integration has no data", () => {
      render(
        <AzimuthalIntegrationFig
          {...defaultProps}
          azimuthalData1={[]}
          azimuthalData2={[]}
        />
      );

      expect(
        screen.getByText("No azimuthal integration data available")
      ).toBeInTheDocument();
    });
  });

  describe("Hidden Integrations", () => {
    it("does not render curves for hidden integrations", () => {
      const hiddenIntegration = createMockIntegration(1, { hidden: true });

      render(
        <AzimuthalIntegrationFig
          {...defaultProps}
          integrations={[hiddenIntegration]}
        />
      );

      const curves = screen.queryAllByTestId("data-curve");
      expect(curves.length).toBe(0);
    });
  });

  describe("Curve Colors", () => {
    it("uses correct colors from integration configuration", () => {
      const integration = createMockIntegration(1, {
        leftColor: "#aa1100",
        rightColor: "#0011aa"
      });

      render(
        <AzimuthalIntegrationFig
          {...defaultProps}
          integrations={[integration]}
        />
      );

      const curves = screen.getAllByTestId("data-curve");
      const colors = curves.map((c) => c.getAttribute("data-color"));

      expect(colors).toContain("#aa1100");
      expect(colors).toContain("#0011aa");
    });
  });

  describe("With Zoom Range", () => {
    it("renders with zoomed pixel ranges", () => {
      render(
        <AzimuthalIntegrationFig
          {...defaultProps}
          zoomedXPixelRange={[10, 90]}
          zoomedYPixelRange={[20, 80]}
        />
      );

      expect(screen.getByTestId("azimuthal-vis-canvas")).toBeInTheDocument();
    });
  });
});
