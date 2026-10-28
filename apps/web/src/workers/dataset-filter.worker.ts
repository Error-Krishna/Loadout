/// <reference lib="webworker" />

import type { FilterWorkerRequest, FilterWorkerResponse } from '../types/dataset';

self.onmessage = (event: MessageEvent<FilterWorkerRequest>) => {
  const { id, query, rows, columns } = event.data;
  const start = performance.now();

  const lowerQuery = query.toLowerCase().trim();
  const filteredIndices: number[] = [];

  if (!lowerQuery) {
    for (let i = 0; i < rows.length; i++) {
      filteredIndices.push(i);
    }
  } else {
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
  }

  const durationMs = Number((performance.now() - start).toFixed(2));

  const response: FilterWorkerResponse = {
    id,
    filteredIndices,
    durationMs,
  };

  self.postMessage(response);
};
