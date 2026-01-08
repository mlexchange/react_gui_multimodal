/**
 * Batch export utilities for downloading batch processing results.
 */

import { LinecutResult } from '../hooks/useBatchProcessing';

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
 * The CSV has the following structure:
 * - First row: header with scan_name and q-values
 * - Subsequent rows: scan_name followed by intensity values
 *
 * @param results - Array of linecut results
 * @param operationType - Type of operation (horizontal, vertical, etc.)
 */
export function exportToCSV(
  results: LinecutResult[],
  operationType: string
): void {
  const successfulResults = results.filter(r => r.success);

  if (successfulResults.length === 0) {
    alert('No successful results to export');
    return;
  }

  // Use the first result's q_values as reference
  const qValues = successfulResults[0].q_values;

  // Build header row
  const header = [
    'scan_name',
    ...qValues.map(q => `q=${q.toFixed(4)}`)
  ].join(',');

  // Build data rows
  const rows = successfulResults.map(result => {
    const intensities = result.intensities.map(i => i.toExponential(4));
    return [result.scan_name, ...intensities].join(',');
  });

  // Combine into CSV content
  const csvContent = [header, ...rows].join('\n');

  // Download
  const filename = `batch_${operationType}_${getDateString()}.csv`;
  downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;');
}

/**
 * Export batch results to JSON format.
 *
 * The JSON has metadata and full result data for each scan.
 *
 * @param results - Array of linecut results
 * @param operationType - Type of operation (horizontal, vertical, etc.)
 */
export function exportToJSON(
  results: LinecutResult[],
  operationType: string
): void {
  const exportData = {
    metadata: {
      operation_type: operationType,
      export_date: new Date().toISOString(),
      total_scans: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    },
    results: results.map(r => ({
      scan_name: r.scan_name,
      scan_uri: r.scan_uri,
      success: r.success,
      error_message: r.error_message,
      data: r.success ? {
        q_values: r.q_values,
        intensities: r.intensities,
      } : null,
    })),
  };

  const jsonContent = JSON.stringify(exportData, null, 2);

  // Download
  const filename = `batch_${operationType}_${getDateString()}.json`;
  downloadBlob(jsonContent, filename, 'application/json');
}

/**
 * Export batch results to a transposed CSV format.
 *
 * This format has:
 * - Each row is a q-value
 * - Columns are: q, scan1, scan2, scan3, ...
 *
 * Useful for analysis in spreadsheet software.
 *
 * @param results - Array of linecut results
 * @param operationType - Type of operation (horizontal, vertical, etc.)
 */
export function exportToTransposedCSV(
  results: LinecutResult[],
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
  const filename = `batch_${operationType}_transposed_${getDateString()}.csv`;
  downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;');
}
