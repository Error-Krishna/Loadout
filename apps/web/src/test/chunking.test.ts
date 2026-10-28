import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProgressiveChunking } from '../hooks/useProgressiveChunking';

describe('useProgressiveChunking hook', () => {
  const createMockRows = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: i, label: `Row ${i}` }));

  it('renders all rows immediately when enabled is false', () => {
    const rows = createMockRows(500);
    const { result } = renderHook(() =>
      useProgressiveChunking({
        items: rows,
        chunkSize: 50,
        enabled: false,
      }),
    );

    expect(result.current.chunkedItems.length).toBe(500);
    expect(result.current.telemetry.isComplete).toBe(true);
    expect(result.current.progressPercent).toBe(100);
  });

  it('mounts rows in initial chunk when enabled', () => {
    const rows = createMockRows(250);
    const { result } = renderHook(() =>
      useProgressiveChunking({
        items: rows,
        chunkSize: 50,
        enabled: true,
      }),
    );

    // Initial chunk is 50
    expect(result.current.chunkedItems.length).toBe(50);
    expect(result.current.telemetry.totalCount).toBe(250);
  });

  it('progressively advances chunks to completion over timer ticks', async () => {
    vi.useFakeTimers();

    const rows = createMockRows(150);
    const { result } = renderHook(() =>
      useProgressiveChunking({
        items: rows,
        chunkSize: 50,
        enabled: true,
      }),
    );

    expect(result.current.chunkedItems.length).toBe(50);

    // Advance 1st idle tick (chunk 2: 50 -> 100)
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(result.current.chunkedItems.length).toBe(100);
    expect(result.current.telemetry.yieldCycles).toBe(1);

    // Advance 2nd idle tick (chunk 3: 100 -> 150)
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(result.current.chunkedItems.length).toBe(150);
    expect(result.current.telemetry.isComplete).toBe(true);
    expect(result.current.progressPercent).toBe(100);

    vi.useRealTimers();
  });
});
