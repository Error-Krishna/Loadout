import type { LoadedDataset } from '../../types/dataset';

export function parseDatasetRows(
  dataset: LoadedDataset,
  maxRows?: number,
): { columns: string[]; rows: Record<string, unknown>[] } {
  if (dataset.format === 'csv') {
    const lines = dataset.rawText.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { columns: [], rows: [] };

    const columns = lines[0]!.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    const dataLines = maxRows ? lines.slice(1, maxRows + 1) : lines.slice(1);

    const rows = dataLines.map((line) => {
      const vals = line.split(',');
      const row: Record<string, unknown> = {};
      columns.forEach((col, idx) => {
        row[col] = vals[idx]?.trim().replace(/^["']|["']$/g, '') ?? '';
      });
      return row;
    });

    return { columns, rows };
  }

  try {
    const parsed = JSON.parse(dataset.rawText);
    if (Array.isArray(parsed)) {
      const rows = maxRows ? parsed.slice(0, maxRows) : parsed;
      const columns =
        rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null
          ? Object.keys(rows[0] as object)
          : [];
      return { columns, rows };
    }
  } catch {
    // Malformed JSON fallback
  }

  return { columns: [], rows: [] };
}
