/**
 * Batch export utilities for downloading batch processing results.
 */

import { BatchLinecutResult } from '../types';

/**
 * Download a blob as a file
 */
function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get current date string for filenames
 */
function getDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Export batch results to CSV format.
 *
 * Format:
 * - Each row is a q-value
 * - Columns are: q, scan1, scan2, scan3, ...
 *
 * @param results - Array of linecut results
 * @param operationType - Type of operation (horizontal, vertical, etc.)
 */
export function exportToCSV(
  results: BatchLinecutResult[],
  operationType: string
): void {
  const successfulResults = results.filter(r => r.success);

  if (successfulResults.length === 0) {
    alert('No successful results to export');
    return;
  }

  // Use the first result's q_values as reference
  const qValues = successfulResults[0].q_values;

  // Build header row: q, scan1, scan2, ...
  const header = ['q', ...successfulResults.map(r => r.scan_name)].join(',');

  // Build data rows: each row is a q-value with intensities from all scans
  const rows = qValues.map((q, i) => {
    const intensities = successfulResults.map(r => r.intensities[i]?.toExponential(4) ?? '');
    return [q.toFixed(4), ...intensities].join(',');
  });

  const csvContent = [header, ...rows].join('\n');

  // Download
  const filename = `batch_${operationType}_${getDateString()}.csv`;
  downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;');
}
