/**
 * CSV export utilities for linecut and batch processing data.
 */

import type {
  BatchLinecutResult,
  LinecutData,
  InclinedLinecutData,
  Linecut,
  InclinedLinecut,
  AzimuthalIntegration,
  AzimuthalData
} from "../types";

/**
 * Download string content as a file.
 */
function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Get timestamp string for filenames.
 */
function getTimestamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Convert 2D array to CSV string.
 */
function toCSV(header: string[], rows: (string | number)[][]): string {
  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

/**
 * Export batch processing results to CSV.
 */
export function exportBatchToCSV(
  results: BatchLinecutResult[],
  operationType: string
): void {
  const successful = results.filter((r) => r.success);
  if (successful.length === 0) return;

  const qValues = successful[0].q_values;
  const header = ["q", ...successful.map((r) => r.scan_name)];
  const rows = qValues.map((q, i) => [
    q,
    ...successful.map((r) => r.intensities[i] ?? "")
  ]);

  downloadFile(
    toCSV(header, rows),
    `batch_${operationType}_${getTimestamp()}.csv`
  );
}

/**
 * Export horizontal/vertical linecut data to CSV.
 */
export function exportLinecutsToCSV(
  linecuts: Linecut[],
  leftData: Map<number, LinecutData>,
  rightData: Map<number, LinecutData>,
  direction: "horizontal" | "vertical"
): void {
  const visible = linecuts.filter((l) => !l.hidden);
  if (visible.length === 0) return;

  const firstData = leftData.get(visible[0].id) ?? rightData.get(visible[0].id);
  if (!firstData) return;

  const header = [
    "q",
    ...visible.flatMap((l) => [`linecut_${l.id}_left`, `linecut_${l.id}_right`])
  ];
  const rows = firstData.qValues.map((q, i) => [
    q,
    ...visible.flatMap((l) => [
      leftData.get(l.id)?.intensities[i] ?? "",
      rightData.get(l.id)?.intensities[i] ?? ""
    ])
  ]);

  downloadFile(
    toCSV(header, rows),
    `${direction}_linecuts_${getTimestamp()}.csv`
  );
}

/**
 * Export inclined linecut data to CSV.
 */
export function exportInclinedLinecutsToCSV(
  linecuts: InclinedLinecut[],
  leftData: Map<number, InclinedLinecutData>,
  rightData: Map<number, InclinedLinecutData>
): void {
  const visible = linecuts.filter((l) => !l.hidden);
  if (visible.length === 0) return;

  const firstData = leftData.get(visible[0].id) ?? rightData.get(visible[0].id);
  if (!firstData) return;

  const header = [
    "path_distance",
    ...visible.flatMap((l) => [`linecut_${l.id}_left`, `linecut_${l.id}_right`])
  ];
  const rows = firstData.pathDistances.map((d, i) => [
    d,
    ...visible.flatMap((l) => [
      leftData.get(l.id)?.intensities[i] ?? "",
      rightData.get(l.id)?.intensities[i] ?? ""
    ])
  ]);

  downloadFile(toCSV(header, rows), `inclined_linecuts_${getTimestamp()}.csv`);
}

/**
 * Export azimuthal integration data to CSV.
 */
export function exportAzimuthalToCSV(
  integrations: AzimuthalIntegration[],
  data1: AzimuthalData[],
  data2: AzimuthalData[]
): void {
  const visible = integrations.filter((i) => !i.hidden);
  if (visible.length === 0) return;

  const firstData =
    data1.find((d) => d.id === visible[0].id) ??
    data2.find((d) => d.id === visible[0].id);
  if (!firstData) return;

  const header = [
    "q",
    ...visible.flatMap((i) => [
      `integration_${i.id}_image1`,
      `integration_${i.id}_image2`
    ])
  ];
  const rows = firstData.q.map((q, i) => [
    q,
    ...visible.flatMap((int) => [
      data1.find((d) => d.id === int.id)?.intensity[i] ?? "",
      data2.find((d) => d.id === int.id)?.intensity[i] ?? ""
    ])
  ]);

  downloadFile(
    toCSV(header, rows),
    `azimuthal_integrations_${getTimestamp()}.csv`
  );
}
