import React, { useRef, useState, useEffect, useMemo } from "react";
import Plot from "react-plotly.js";
import { AzimuthalIntegration, AzimuthalData } from './types';

interface AzimuthalIntegrationFigProps {
  integrations: AzimuthalIntegration[];
  azimuthalData1: AzimuthalData[];
  azimuthalData2: AzimuthalData[];
  zoomedQRange: [number, number] | null;
}

interface Dimensions {
  width: number | undefined;
  height: number | undefined;
}

const AzimuthalIntegrationFig: React.FC<AzimuthalIntegrationFigProps> = ({
  integrations,
  azimuthalData1,
  azimuthalData2,
  zoomedQRange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: undefined,
    height: undefined,
  });

  // Update dimensions when container size changes
  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({
          width: Math.floor(width),
          height: Math.floor(height),
        });
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Memoize plot data
  const plotData = useMemo(() =>
    integrations
      .filter(integration => !integration.hidden)
      .flatMap(integration => {
        // Find corresponding data for this integration
        const data1 = azimuthalData1.find(d => d.id === integration.id);
        const data2 = azimuthalData2.find(d => d.id === integration.id);

        if (!data1 || !data2) return [];

        // Return plot traces for both datasets
        return [
          {
            x: data1.q,
            y: data1.intensity,
            type: "scatter" as const,
            mode: "lines" as const,
            name: `Left Integration ${integration.id}`,
            line: {
              color: integration.leftColor,
              width: 2,
            },
          },
          {
            x: data2.q,
            y: data2.intensity,
            type: "scatter" as const,
            mode: "lines" as const,
            name: `Right Integration ${integration.id}`,
            line: {
              color: integration.rightColor,
              width: 2,
            },
          },
        ];
      }),
    [integrations, azimuthalData1, azimuthalData2]
  );

  // Memoize layout
  const layout = useMemo(() => {
    const defaultRange = {
      xaxis: {
        title: { text: "q (nm⁻¹)", font: { size: 12 } },
        tickfont: { size: 11 },
        autorange: true,
      },
    };

    // Apply zoom range if available
    const xAxisConfig = zoomedQRange
      ? {
          ...defaultRange.xaxis,
          range: zoomedQRange,
          autorange: false,
        }
      : defaultRange.xaxis;

    return {
      width: dimensions.width,
      height: dimensions.height,
      xaxis: xAxisConfig,
      yaxis: {
        title: { text: "Intensity", font: { size: 12 }, standoff: 40 },
        tickfont: { size: 11 },
        autorange: true,
      },
      margin: { l: 60, r: 10, t: 10, b: 40 },
      legend: { font: { size: 10 }, orientation: 'h' as const, y: -0.25 },
      font: { size: 11 },
      showlegend: true,
    };
  }, [dimensions, zoomedQRange]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <Plot
        data={plotData}
        layout={layout}
        config={{
          scrollZoom: true,
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtons: [
            [
              'pan2d',
              'zoom2d',
              'zoomIn2d',
              'zoomOut2d',
              'autoScale2d',
              'resetScale2d',
              'toImage',
            ],
          ],
          showTips: true,
        }}
        useResizeHandler
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
};

export default AzimuthalIntegrationFig;