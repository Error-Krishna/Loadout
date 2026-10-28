import { useState, useEffect, useRef, useMemo } from 'react';
import type { ProgressiveChunkTelemetry } from '../types/dataset';

interface UseProgressiveChunkingParams<T> {
  items: T[];
  chunkSize?: number;
  enabled?: boolean;
}

export function useProgressiveChunking<T>({
  items,
  chunkSize = 100,
  enabled = true,
}: UseProgressiveChunkingParams<T>) {
  const [mountedCount, setMountedCount] = useState<number>(() =>
    enabled ? Math.min(items.length, chunkSize) : items.length,
  );
  const [telemetry, setTelemetry] = useState<ProgressiveChunkTelemetry>({
    mountedCount: enabled ? Math.min(items.length, chunkSize) : items.length,
    totalCount: items.length,
    isComplete: !enabled || items.length <= chunkSize,
    yieldCycles: 0,
    initialChunkDurationMs: 0,
    totalDurationMs: 0,
    chunkSize,
  });

  const sessionRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    sessionRef.current += 1;
    const currentSession = sessionRef.current;

    const initialCount = Math.min(items.length, chunkSize);
    const start = performance.now();
    let initialPainted = false;
    let initialDuration = 0;
    let cycles = 0;
    let currentMounted = initialCount;

    // Measure initial chunk paint via requestAnimationFrame
    const rafId = requestAnimationFrame(() => {
      if (!initialPainted && sessionRef.current === currentSession) {
        initialDuration = Number((performance.now() - start).toFixed(2));
        initialPainted = true;
      }
    });

    // Resilient idle scheduler supporting Chrome, Firefox, Safari, and test runners
    const schedule = (cb: () => void) => {
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        return window.requestIdleCallback(cb, { timeout: 100 });
      }
      return window.setTimeout(cb, 16);
    };

    const cancel = (handle: number) => {
      if (typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle);
      }
    };

    let idleHandle: number | null = null;

    const step = () => {
      if (sessionRef.current !== currentSession) {
        return;
      }

      cycles += 1;
      currentMounted = Math.min(currentMounted + chunkSize, items.length);
      const isDone = currentMounted >= items.length;
      const totalDur = Number((performance.now() - start).toFixed(2));

      setMountedCount(currentMounted);
      setTelemetry({
        mountedCount: currentMounted,
        totalCount: items.length,
        isComplete: isDone,
        yieldCycles: cycles,
        initialChunkDurationMs: initialDuration,
        totalDurationMs: totalDur,
        chunkSize,
      });

      if (!isDone) {
        idleHandle = schedule(step);
      }
    };

    if (currentMounted < items.length) {
      idleHandle = schedule(step);
    } else {
      // If entire dataset fits in one chunk
      setMountedCount(items.length);
      setTelemetry({
        mountedCount: items.length,
        totalCount: items.length,
        isComplete: true,
        yieldCycles: 0,
        initialChunkDurationMs: initialDuration,
        totalDurationMs: Number((performance.now() - start).toFixed(2)),
        chunkSize,
      });
    }

    return () => {
      cancelAnimationFrame(rafId);
      if (idleHandle !== null) {
        cancel(idleHandle);
      }
    };
  }, [items, chunkSize, enabled]);

  const chunkedItems = useMemo(() => {
    if (!enabled || items.length <= chunkSize) {
      return items;
    }
    return items.slice(0, mountedCount);
  }, [enabled, items, chunkSize, mountedCount]);

  const progressPercent = useMemo(() => {
    if (!enabled || items.length === 0) return 100;
    return Math.min(100, Math.round((mountedCount / items.length) * 100));
  }, [enabled, items.length, mountedCount]);

  return {
    chunkedItems,
    telemetry: enabled
      ? telemetry
      : {
          mountedCount: items.length,
          totalCount: items.length,
          isComplete: true,
          yieldCycles: 0,
          initialChunkDurationMs: 0,
          totalDurationMs: 0,
          chunkSize,
        },
    progressPercent,
  };
}
