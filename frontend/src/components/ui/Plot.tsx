/**
 * Custom Plot component using partial Plotly.js bundle for smaller bundle size.
 * Uses plotly.js-cartesian-dist-min which includes scatter and heatmap trace types.
 */
import Plotly from "plotly.js-cartesian-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";

const Plot = createPlotlyComponent(Plotly);

// Re-export commonly used types from plotly.js for convenience
export type { PlotMouseEvent } from "plotly.js";

export default Plot;
