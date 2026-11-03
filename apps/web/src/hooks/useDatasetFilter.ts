import { useState, useEffect, useRef, useMemo } from 'react';
import type {
  FilterWorkerInboundMessage,
  FilterWorkerOutboundMessage,
  FilterTelemetry,
} from '../types/dataset';

interface UseDatasetFilterParams {
  rows: Record<string, unknown>[];
  columns: string[];
  query: string;
  useWorker: boolean;
  datasetId?: string;
}

export function useDatasetFilter({
  rows,
  columns,
  query,
  useWorker,
  datasetId = 'default-dataset',
}: UseDatasetFilterParams) {
  const [activeResults, setActiveResults] = useState<{
    rows: Record<string, unknown>[];
    telemetry: FilterTelemetry;
  } | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const sequenceIdRef = useRef<number>(0);
  const isWorkerReadyRef = useRef<boolean>(false);
  const pendingQueryRef = useRef<string | null>(null);
  const dispatchDurationRef = useRef<number>(0);

  const trimmedQuery = query.trim().toLowerCase();
  const isEmpty = trimmedQuery.length === 0;

  // Initialize Web Worker instance & cache dataset ONCE
  useEffect(() => {
    if (typeof Worker === 'undefined') {
      return;
    }

    try {
      const worker = new Worker(new URL('../workers/dataset-filter.worker.ts', import.meta.url), {
        type: 'module',
      });

      workerRef.current = worker;
      isWorkerReadyRef.current = false;

      worker.onmessage = (e: MessageEvent<FilterWorkerOutboundMessage>) => {
        const msg = e.data;
        if (!msg) return;

        // 1. Worker acknowledges dataset initialization
        if (msg.type === 'ready') {
          isWorkerReadyRef.current = true;
          // Dispatch pending query if user typed during init
          if (pendingQueryRef.current !== null) {
            const pendingQuery = pendingQueryRef.current;
            pendingQueryRef.current = null;
            sequenceIdRef.current += 1;
            const currentId = sequenceIdRef.current;
            worker.postMessage({
              type: 'filter',
              id: currentId,
              query: pendingQuery,
            } satisfies FilterWorkerInboundMessage);
          }
          return;
        }

        // 2. Worker returned filtered indices
        if (msg.type === 'filtered' || ('filteredIndices' in msg && !msg.type)) {
          const { id, filteredIndices, durationMs } = msg;

          // Stale-result suppression: discard if a newer query has already been issued
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
              dispatchDurationMs: dispatchDurationRef.current,
            },
          });
          return;
        }

        // 3. Worker reported error: graceful fallback
        if (msg.type === 'error') {
          console.warn('Dataset filter worker error:', msg.message);
        }
      };

      worker.onerror = (err) => {
        console.warn('Web Worker runtime error, terminating:', err);
        isWorkerReadyRef.current = false;
      };

      // Initialize worker with dataset ONCE (eliminates repeated structured cloning on search)
      const initMsg: FilterWorkerInboundMessage = {
        type: 'init',
        datasetId,
        rows,
        columns,
      };
      worker.postMessage(initMsg);

      return () => {
        try {
          worker.postMessage({ type: 'clear' } satisfies FilterWorkerInboundMessage);
        } catch {
          // Worker might already be stopped
        }
        worker.terminate();
        workerRef.current = null;
        isWorkerReadyRef.current = false;
      };
    } catch {
      // Graceful fallback if worker initialization fails in restricted environment
    }
  }, [rows, columns, datasetId]);

  // Execute search filtering when query is present
  useEffect(() => {
    if (!trimmedQuery) {
      return;
    }

    if (useWorker && workerRef.current) {
      sequenceIdRef.current += 1;
      const currentId = sequenceIdRef.current;

      if (!isWorkerReadyRef.current) {
        // Queue until worker fires 'ready'
        pendingQueryRef.current = trimmedQuery;
        return;
      }

      // Send search query WITHOUT copying the rows array
      const dispatchStart = performance.now();
      const filterRequest: FilterWorkerInboundMessage = {
        type: 'filter',
        id: currentId,
        query: trimmedQuery,
      };
      workerRef.current.postMessage(filterRequest);
      dispatchDurationRef.current = Number((performance.now() - dispatchStart).toFixed(2));
    } else {
      // Main Thread Execution (Blocking UI)
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
      const duration = Number((performance.now() - start).toFixed(2));

      setActiveResults({
        rows: matched,
        telemetry: {
          executionDurationMs: duration,
          mainThreadLockMs: duration, // Main thread is synchronously frozen during search
          isWorker: false,
          matchesCount: matched.length,
          dispatchDurationMs: 0,
        },
      });
    }
  }, [trimmedQuery, useWorker, rows, columns]);

  // When search query is empty, return unfiltered original rows instantaneously
  return useMemo(() => {
    if (isEmpty) {
      return {
        filteredRows: rows,
        telemetry: {
          executionDurationMs: 0,
          mainThreadLockMs: 0,
          isWorker: useWorker,
          matchesCount: rows.length,
          dispatchDurationMs: 0,
        },
      };
    }

    return {
      filteredRows: activeResults?.rows ?? [],
      telemetry: activeResults?.telemetry ?? {
        executionDurationMs: 0,
        mainThreadLockMs: 0,
        isWorker: useWorker,
        matchesCount: 0,
        dispatchDurationMs: 0,
      },
    };
  }, [isEmpty, rows, useWorker, activeResults]);
}
