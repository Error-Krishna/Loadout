import { useState, useEffect, useRef, useMemo } from 'react';
import type { FilterWorkerRequest, FilterWorkerResponse, FilterTelemetry } from '../types/dataset';

interface UseDatasetFilterParams {
  rows: Record<string, unknown>[];
  columns: string[];
  query: string;
  useWorker: boolean;
}

export function useDatasetFilter({ rows, columns, query, useWorker }: UseDatasetFilterParams) {
  const [activeResults, setActiveResults] = useState<{
    rows: Record<string, unknown>[];
    telemetry: FilterTelemetry;
  } | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const sequenceIdRef = useRef<number>(0);

  const trimmedQuery = query.trim().toLowerCase();
  const isEmpty = trimmedQuery.length === 0;

  // Initialize Web Worker instance if supported by runtime
  useEffect(() => {
    if (typeof Worker === 'undefined') {
      return;
    }

    try {
      const worker = new Worker(new URL('../workers/dataset-filter.worker.ts', import.meta.url), {
        type: 'module',
      });

      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent<FilterWorkerResponse>) => {
        const { id, filteredIndices, durationMs } = e.data;
        // Stale-result suppression: Discard if a newer search query was already issued
        if (id !== sequenceIdRef.current) {
          return;
        }

        const matchedRows = filteredIndices.map((idx) => rows[idx]!).filter(Boolean);
        setActiveResults({
          rows: matchedRows,
          telemetry: {
            executionDurationMs: durationMs,
            mainThreadLockMs: 0, // Worker offloads CPU: 0ms main thread lock!
            isWorker: true,
            matchesCount: matchedRows.length,
          },
        });
      };

      return () => {
        worker.terminate();
        workerRef.current = null;
      };
    } catch {
      // Graceful fallback if worker initialization fails in restricted environment
    }
  }, [rows]);

  // Execute search filtering when query is present
  useEffect(() => {
    if (!trimmedQuery) {
      return;
    }

    if (useWorker && workerRef.current) {
      // 1. Web Worker Execution with Sequence ID
      sequenceIdRef.current += 1;
      const currentId = sequenceIdRef.current;

      const request: FilterWorkerRequest = {
        id: currentId,
        query: trimmedQuery,
        rows,
        columns,
      };

      workerRef.current.postMessage(request);
    } else {
      // 2. Main Thread Execution (Blocking UI)
      const start = performance.now();
      const matched = rows.filter((row) => {
        for (let i = 0; i < columns.length; i++) {
          const col = columns[i];
          if (!col) continue;
          const val = row[col];
          if (
            val !== null &&
            val !== undefined &&
            String(val).toLowerCase().includes(trimmedQuery)
          ) {
            return true;
          }
        }
        return false;
      });

      const lockDuration = Number((performance.now() - start).toFixed(2));
      setActiveResults({
        rows: matched,
        telemetry: {
          executionDurationMs: lockDuration,
          mainThreadLockMs: lockDuration, // Main thread was blocked for this entire duration!
          isWorker: false,
          matchesCount: matched.length,
        },
      });
    }
  }, [trimmedQuery, rows, columns, useWorker]);

  const defaultTelemetry: FilterTelemetry = useMemo(
    () => ({
      executionDurationMs: 0,
      mainThreadLockMs: 0,
      isWorker: useWorker,
      matchesCount: rows.length,
    }),
    [useWorker, rows.length],
  );

  return useMemo(
    () => ({
      filteredRows: isEmpty ? rows : (activeResults?.rows ?? []),
      telemetry: isEmpty ? defaultTelemetry : (activeResults?.telemetry ?? defaultTelemetry),
    }),
    [isEmpty, rows, activeResults, defaultTelemetry],
  );
}
