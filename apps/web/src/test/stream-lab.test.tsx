import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StreamLabView from '../components/stream/StreamLabView';
import { useStreamSimulation } from '../hooks/useStreamSimulation';

describe('StreamLabView and stream simulation hook', () => {
  it('initializes with default telemetry and paused state', () => {
    const { result } = renderHook(() =>
      useStreamSimulation({
        eventRate: 100,
        strategy: 'batched',
        batchIntervalMs: 50,
        queueCapacity: 100,
      }),
    );

    expect(result.current.isRunning).toBe(false);
    expect(result.current.telemetry.eventsReceived).toBe(0);
    expect(result.current.telemetry.renderCycles).toBe(0);
  });

  it('runs batched simulation and updates telemetry when timers advance', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useStreamSimulation({
        eventRate: 200,
        strategy: 'batched',
        batchIntervalMs: 50,
        queueCapacity: 200,
      }),
    );

    act(() => {
      result.current.start();
    });
    expect(result.current.isRunning).toBe(true);

    // Advance 100ms
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.telemetry.eventsReceived).toBeGreaterThan(0);
    expect(result.current.telemetry.renderCycles).toBeGreaterThan(0);

    act(() => {
      result.current.stop();
    });
    expect(result.current.isRunning).toBe(false);

    vi.useRealTimers();
  });

  it('renders stream lab UI and allows strategy toggles', () => {
    render(<StreamLabView />);

    expect(screen.getByText('Live Stream & Backpressure Workbench')).toBeInTheDocument();
    expect(screen.getByText('▶ Start Stream')).toBeInTheDocument();
    expect(screen.getByText('1. Baseline (Unthrottled)')).toBeInTheDocument();
    expect(screen.getByText('2. Interval Batching')).toBeInTheDocument();
    expect(screen.getByText('3. Visual Coalescing')).toBeInTheDocument();
    expect(screen.getByText('4. Bounded Backpressure')).toBeInTheDocument();

    const unthrottledBtn = screen.getByText('1. Baseline (Unthrottled)');
    fireEvent.click(unthrottledBtn);
    expect(screen.getByText('100% Main Thread Load')).toBeInTheDocument();
  });
});
