/// <reference lib="webworker" />

import type {
  FilterWorkerInboundMessage,
  FilterWorkerOutboundMessage,
} from '../types/dataset';

// In-worker cached state: dataset rows are initialized ONCE to eliminate repeated structured cloning
let cachedDatasetId: string | null = null;
let cachedRows: Record<string, unknown>[] = [];
let cachedColumns: string[] = [];

function executeFilter(query: string, rows: Record<string, unknown>[], columns: string[]): number[] {
  const lowerQuery = query.toLowerCase().trim();
  const filteredIndices: number[] = [];

  if (!lowerQuery) {
    for (let i = 0; i < rows.length; i++) {
      filteredIndices.push(i);
    }
    return filteredIndices;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    let matched = false;
    for (let c = 0; c < columns.length; c++) {
      const colName = columns[c];
      if (!colName) continue;
      const val = row[colName];
      if (val !== null && val !== undefined && String(val).toLowerCase().includes(lowerQuery)) {
        matched = true;
        break;
      }
    }

    if (matched) {
      filteredIndices.push(i);
    }
  }

  return filteredIndices;
}

self.onmessage = (event: MessageEvent<FilterWorkerInboundMessage>) => {
  const data = event.data;
  if (!data) return;

  try {
    // 1. Dataset Initialization message (Cached once)
    if ('type' in data && data.type === 'init') {
      const initData = data as { type: 'init'; datasetId: string; rows: Record<string, unknown>[]; columns: string[] };
      cachedDatasetId = initData.datasetId;
      cachedRows = initData.rows ?? [];
      cachedColumns = initData.columns ?? [];

      const readyMsg: FilterWorkerOutboundMessage = {
        type: 'ready',
        datasetId: cachedDatasetId,
        rowCount: cachedRows.length,
      };
      self.postMessage(readyMsg);
      return;
    }

    // 2. Query Filtering message (Uses cached dataset with 0 cloning overhead)
    if ('type' in data && data.type === 'filter') {
      const filterData = data as { type: 'filter'; id: number; query: string };
      const start = performance.now();
      const filteredIndices = executeFilter(filterData.query, cachedRows, cachedColumns);
      const durationMs = Number((performance.now() - start).toFixed(2));

      const filterMsg: FilterWorkerOutboundMessage = {
        type: 'filtered',
        id: filterData.id,
        filteredIndices,
        durationMs,
      };
      self.postMessage(filterMsg);
      return;
    }

    // 3. Clear Cache message
    if ('type' in data && data.type === 'clear') {
      cachedDatasetId = null;
      cachedRows = [];
      cachedColumns = [];
      return;
    }

    // 4. Legacy fallback: request containing rows directly
    const legacyData = data as { id: number; query: string; rows?: Record<string, unknown>[]; columns?: string[] };
    if (legacyData.rows && Array.isArray(legacyData.rows)) {
      const start = performance.now();
      const rows = legacyData.rows;
      const columns = legacyData.columns ?? [];
      const filteredIndices = executeFilter(legacyData.query, rows, columns);
      const durationMs = Number((performance.now() - start).toFixed(2));

      const response: FilterWorkerOutboundMessage = {
        id: legacyData.id,
        filteredIndices,
        durationMs,
      };
      self.postMessage(response);
    }
  } catch (err) {
    const errorMsg: FilterWorkerOutboundMessage = {
      type: 'error',
      id: typeof (data as { id?: number }).id === 'number' ? (data as { id: number }).id : undefined,
      message: (err as Error).message || String(err),
    };
    self.postMessage(errorMsg);
  }
};
