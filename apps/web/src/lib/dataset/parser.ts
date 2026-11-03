import type { LoadedDataset } from '../../types/dataset';
import { parseCsvRecords, parseNdjsonRecords, parseJsonArrayRecords } from './stream-parser';

export function parseDatasetRows(
  dataset: LoadedDataset,
  maxRows?: number,
): { columns: string[]; rows: Record<string, unknown>[] } {
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
