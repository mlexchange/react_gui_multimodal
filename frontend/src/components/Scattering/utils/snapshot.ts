/**
 * Snapshot utilities for capturing visualizations as images.
 * Uses html-to-image library to capture DOM elements including axes and labels.
 */

import { toPng } from "html-to-image";

export interface SnapshotOptions {
  /** Filename without extension */
  filename?: string;
  /** Background color (default: white) */
  backgroundColor?: string;
  /** Pixel ratio for higher resolution (default: 2) */
  pixelRatio?: number;
  /** Y-axis label translateY offset for snapshot (adjusts rotated label position) */
  yAxisLabelOffset?: number;
}

/**
 * Capture a DOM element as PNG and trigger download.
 */
export async function captureSnapshot(
  element: HTMLElement | null,
  options: SnapshotOptions = {}
): Promise<void> {
  if (!element) {
    console.warn("Snapshot: No element provided");
    return;
  }

  const {
    filename = "snapshot",
    backgroundColor = "#ffffff",
    pixelRatio = 1,
    yAxisLabelOffset = 0
  } = options;

  // Store original styles to restore later
  const originalStyles: Array<{ element: SVGTextElement; transform: string }> =
    [];

  try {
    // Find y-axis labels and adjust their transform for snapshot capture
    // The labels use rotate(-90deg) translateY(Npx) which positions them outside bounds
    if (yAxisLabelOffset > 0) {
      const yAxisLabels = element.querySelectorAll(
        '[data-type="ordinate"] text[class*="label"]'
      );
      yAxisLabels.forEach((label) => {
        if (label instanceof SVGTextElement) {
          originalStyles.push({
            element: label,
            transform: label.style.transform
          });
          label.style.transform = `rotate(-90deg) translateY(${yAxisLabelOffset}px)`;
        }
      });
    }

    const dataUrl = await toPng(element, {
      backgroundColor,
      pixelRatio,
      skipFonts: false,
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true;
        // Exclude elements marked for snapshot exclusion
        if (node.hasAttribute("data-exclude-snapshot")) return false;
        // Exclude H5Web floating controls (reset zoom button)
        if (node.className?.includes?.("floating")) return false;
        return true;
      }
    });

    // Create download link
    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error("Snapshot capture failed:", error);
  } finally {
    // Restore original transforms
    originalStyles.forEach(({ element: el, transform }) => {
      el.style.transform = transform;
    });
  }
}
