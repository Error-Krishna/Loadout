import type { LoadedDataset } from '../../types/dataset';
import { parseCsvRecords, parseNdjsonRecords, parseJsonArrayRecords } from './stream-parser';

export function parseDatasetRows(
  dataset: LoadedDataset,
  maxRows?: number,
): { columns: string[]; rows: Record<string, unknown>[] } {
  // If the dataset already carries the fully parsed records from streamParseFile, reuse them directly
  if (dataset.parsedRows && dataset.parsedRows.length > 0) {
    const rows = maxRows ? dataset.parsedRows.slice(0, maxRows) : dataset.parsedRows;
    const columns =
      dataset.columns && dataset.columns.length > 0
        ? dataset.columns
        : rows[0]
          ? Object.keys(rows[0])
          : [];
    return { columns, rows };
  }

  if (dataset.format === 'csv') {
    const res = parseCsvRecords(dataset.rawText, ',', maxRows);
    return { columns: res.columns, rows: res.rows };
  }

  if (dataset.format === 'ndjson') {
    const res = parseNdjsonRecords(dataset.rawText, maxRows);
    return { columns: res.columns, rows: res.rows };
  }

  try {
    const res = parseJsonArrayRecords(dataset.rawText, maxRows);
    return { columns: res.columns, rows: res.rows };
  } catch {
    // Malformed JSON fallback
    return { columns: [], rows: [] };
  }
}
