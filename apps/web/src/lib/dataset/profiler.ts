import type {
  LoadedDataset,
  DatasetProfile,
  ColumnProfile,
  InferredType,
  DiagnosticSignal,
} from '../../types/dataset';

function inferType(value: unknown): InferredType {
  if (value === null || value === undefined || value === '') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!isNaN(Number(trimmed)) && trimmed !== '') return 'number';
    if (trimmed.toLowerCase() === 'true' || trimmed.toLowerCase() === 'false') return 'boolean';
    // ISO 8601 or common date formats
    if (
      trimmed.length >= 10 &&
      !isNaN(Date.parse(trimmed)) &&
      (trimmed.includes('-') || trimmed.includes('/'))
    ) {
      return 'date';
    }
  }
  return 'string';
}

export function profileDataset(dataset: LoadedDataset): DatasetProfile {
  let rows: Record<string, unknown>[] = [];
  let totalRowCount = 0;
  let columnNames: string[] = [];

  if (dataset.format === 'csv') {
    const lines = dataset.rawText.split('\n').filter((line) => line.trim().length > 0);
    totalRowCount = Math.max(0, lines.length - 1);

    if (lines.length > 0) {
      columnNames = lines[0]!.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
      const sampleLines = lines.slice(1, 201); // Sample first 200 rows for speed

      rows = sampleLines.map((line) => {
        const values = line.split(',');
        const row: Record<string, unknown> = {};
        columnNames.forEach((col, idx) => {
          row[col] = values[idx]?.trim().replace(/^["']|["']$/g, '') ?? null;
        });
        return row;
      });
    }
  } else {
    try {
      const parsed = JSON.parse(dataset.rawText);
      if (Array.isArray(parsed)) {
        totalRowCount = parsed.length;
        rows = parsed.slice(0, 200);
        if (rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
          columnNames = Object.keys(rows[0] as object);
        }
      }
    } catch {
      // In case of malformed JSON, rows remain empty
    }
  }

  // 1. Analyze Columns
  const columns: ColumnProfile[] = columnNames.map((col) => {
    let nullCount = 0;
    const typeVotes: Record<InferredType, number> = { string: 0, number: 0, boolean: 0, date: 0 };
    const samples: (string | number | boolean | null)[] = [];

    rows.forEach((row) => {
      const val = row[col];
      if (val === null || val === undefined || val === '') {
        nullCount++;
      } else {
        const detected = inferType(val);
        typeVotes[detected]++;
        if (samples.length < 3) samples.push(val as string | number | boolean);
      }
    });

    // Majority vote for column type
    let dominantType: InferredType = 'string';
    let maxVotes = 0;
    for (const [t, votes] of Object.entries(typeVotes)) {
      if (votes > maxVotes) {
        maxVotes = votes;
        dominantType = t as InferredType;
      }
    }

    return {
      name: col,
      type: dominantType,
      nullCount,
      sampleValues: samples,
    };
  });

  // 2. Calculate Memory & DOM Estimates
  // JS Object heap overhead is roughly 3.2x raw UTF-8 text size
  const estimatedHeapBytes = Math.round(dataset.sizeBytes * 3.2);
  // Unvirtualized DOM nodes: 1 tr + 1 td per col + text node per td
  const estimatedDomNodes = totalRowCount * (columns.length * 2 + 1);

  // 3. Diagnose Bottlenecks
  const diagnostics: DiagnosticSignal[] = [];

  if (totalRowCount > 1_000) {
    diagnostics.push({
      id: 'dom-explosion',
      severity: 'critical',
      title: 'DOM Node Exhaustion Risk',
      description: `Rendering ${totalRowCount.toLocaleString()} rows naively creates ~${estimatedDomNodes.toLocaleString()} DOM elements. Browsers begin dropping frames above 5,000 DOM nodes.`,
      metric: `~${estimatedDomNodes.toLocaleString()} DOM nodes`,
      recommendedTechnique: 'Row Virtualization (TanStack Virtual)',
    });
  }

  if (dataset.sizeBytes > 4 * 1024 * 1024) {
    const sizeMb = (dataset.sizeBytes / (1024 * 1024)).toFixed(1);
    diagnostics.push({
      id: 'main-thread-parsing',
      severity: 'warning',
      title: 'Main-Thread Parser Freeze',
      description: `Parsing this ${sizeMb} MB payload synchronously on the main thread will cause interaction lag during initial load.`,
      metric: `${sizeMb} MB raw payload`,
      recommendedTechnique: 'Web Worker Chunked Parsing',
    });
  }

  if (columns.length > 20) {
    diagnostics.push({
      id: 'wide-table',
      severity: 'warning',
      title: 'Wide Table Horizontal Thrashing',
      description: `Table has ${columns.length} columns. Rendering all cells horizontally increases reflow cost during horizontal scrolling.`,
      metric: `${columns.length} columns`,
      recommendedTechnique: 'Column Virtualization',
    });
  }

  return {
    rowCount: totalRowCount,
    columnCount: columns.length,
    columns,
    previewRows: rows.slice(0, 10),
    rawSizeBytes: dataset.sizeBytes,
    estimatedHeapBytes,
    estimatedDomNodes,
    diagnostics,
  };
}
