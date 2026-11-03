import { describe, expect, it, vi } from 'vitest';
import {
  runBenchmark,
  type Clock,
  type Scheduler,
  type WorkloadAdapter,
  type BenchmarkProgress,
} from '../lib/benchmark/runner';
import type { BenchmarkPolicy } from '../types/benchmark';

describe('Benchmark Execution Runner (M1-T02b)', () => {
  // Deterministic virtual clock
  function createMockClock(start = 1000): { clock: Clock; advance: (ms: number) => void } {
    let currentTime = start;
    return {
      clock: { now: () => currentTime },
      advance: (ms: number) => {
        currentTime += ms;
      },
    };
  }

  // Deterministic virtual scheduler
  function createMockScheduler(advanceClock: (ms: number) => void): Scheduler {
    return {
      sleep: async (ms: number, signal?: AbortSignal) => {
        if (signal?.aborted) {
          throw signal.reason ?? new Error('Cancelled');
        }
        advanceClock(ms);
      },
    };
  }

  it('executes full benchmark lifecycle with correct warmup and measured iteration counts', async () => {
    const { clock, advance } = createMockClock();
    const scheduler = createMockScheduler(advance);

    let setupCalled = 0;
    let cleanupCalled = 0;
    const executedTrials: { iteration: number; isWarmup: boolean }[] = [];

    const adapter: WorkloadAdapter<string, number> = {
      name: 'test-dataset-virtualizer',
      setup: () => {
        setupCalled++;
        advance(50); // Setup takes 50ms
        return 'test-context-data';
      },
      execute: (_context, trialInfo) => {
        executedTrials.push(trialInfo);
        advance(15); // Each execution takes 15ms
        return 42;
      },
      cleanup: () => {
        cleanupCalled++;
        advance(10); // Cleanup takes 10ms
      },
      collectMetrics: () => ({
        domNodes: 240,
        heapBytesUsed: 1024 * 1024,
      }),
    };

    const policy: BenchmarkPolicy = {
      warmupIterations: 2,
      measuredIterations: 5,
      timeoutMsPerIteration: 1000,
      cooldownMsBetweenIterations: 16,
    };

    const result = await runBenchmark(adapter, { policy, clock, scheduler });

    expect(result.status).toBe('completed');
    expect(result.adapterName).toBe('test-dataset-virtualizer');
    expect(setupCalled).toBe(1);
    expect(cleanupCalled).toBe(1);
    expect(result.setupDurationMs).toBe(50);
    expect(result.cleanupDurationMs).toBe(10);

    // Warmup count and measured count verification
    expect(result.warmupTrials.length).toBe(2);
    expect(result.measuredTrials.length).toBe(5);
    expect(result.trials.length).toBe(7);
    expect(result.failedTrials.length).toBe(0);

    // Timing boundary separation: execution duration is strictly 15ms per trial
    result.trials.forEach((trial) => {
      expect(trial.durationMs).toBe(15);
      expect(trial.error).toBeUndefined();
      expect(trial.domNodes).toBe(240);
    });

    // Statistical aggregation integration (M1-T02a)
    expect(result.distribution).toBeDefined();
    expect(result.distribution?.sampleCount).toBe(5);
    expect(result.distribution?.warmupCount).toBe(2);
    expect(result.distribution?.medianMs).toBe(15);
    expect(result.distribution?.meanMs).toBe(15);
    expect(result.distribution?.spreadMs).toBe(0);
    expect(result.latestOutput).toBe(42);
  });

  it('strictly separates setup and cleanup timing from trial duration', async () => {
    const { clock, advance } = createMockClock();
    const scheduler = createMockScheduler(advance);

    const adapter: WorkloadAdapter = {
      name: 'timing-separation-adapter',
      setup: () => {
        advance(500); // 500ms setup
      },
      execute: () => {
        advance(20); // 20ms execution
      },
      cleanup: () => {
        advance(150); // 150ms cleanup
      },
    };

    const policy: BenchmarkPolicy = {
      warmupIterations: 1,
      measuredIterations: 2,
      timeoutMsPerIteration: 2000,
      cooldownMsBetweenIterations: 0,
    };

    const result = await runBenchmark(adapter, { policy, clock, scheduler });

    expect(result.setupDurationMs).toBe(500);
    expect(result.cleanupDurationMs).toBe(150);

    // Each trial duration must strictly reflect ONLY the execute() body (20ms)
    result.trials.forEach((t) => {
      expect(t.durationMs).toBe(20);
    });
  });

  it('guarantees cleanup execution when execute throws an error and preserves failure', async () => {
    const { clock, advance } = createMockClock();
    const scheduler = createMockScheduler(advance);
    let cleanupExecuted = false;

    const adapter: WorkloadAdapter = {
      name: 'failing-adapter',
      setup: () => ({ ready: true }),
      execute: (_ctx, { iteration, isWarmup }) => {
        if (!isWarmup && iteration === 2) {
          throw new Error('Synthetic database connection dropped');
        }
        advance(10);
      },
      cleanup: () => {
        cleanupExecuted = true;
      },
    };

    const policy: BenchmarkPolicy = {
      warmupIterations: 2,
      measuredIterations: 5,
      timeoutMsPerIteration: 1000,
      cooldownMsBetweenIterations: 0,
    };

    const result = await runBenchmark(adapter, { policy, clock, scheduler });

    // Cleanup must execute on failure
    expect(cleanupExecuted).toBe(true);

    // Status is failed, not completed
    expect(result.status).toBe('failed');
    expect(result.error).toContain('Synthetic database connection dropped');
    expect(result.failedTrials.length).toBe(1);

    const failedTrial = result.failedTrials[0]!;
    expect(failedTrial.iteration).toBe(2);
    expect(failedTrial.isWarmup).toBe(false);
    expect(failedTrial.error).toContain('Synthetic database connection dropped');

    // Partial results must not be marked as successful distributions
    expect(result.warnings.some((w) => w.includes('Synthetic database connection dropped'))).toBe(
      true,
    );
  });

  it('handles execution timeout, stops subsequent iterations, and guarantees cleanup', async () => {
    vi.useFakeTimers();
    let cleanupExecuted = false;

    const adapter: WorkloadAdapter = {
      name: 'hanging-adapter',
      setup: () => {},
      execute: async () => {
        // Simulates an infinite hang
        await new Promise(() => {});
      },
      cleanup: () => {
        cleanupExecuted = true;
      },
    };

    const policy: BenchmarkPolicy = {
      warmupIterations: 0,
      measuredIterations: 3,
      timeoutMsPerIteration: 50, // 50ms timeout
      cooldownMsBetweenIterations: 0,
    };

    const promise = runBenchmark(adapter, { policy });

    // Advance clock past the 50ms timeout
    await vi.advanceTimersByTimeAsync(60);

    const result = await promise;

    expect(cleanupExecuted).toBe(true);
    expect(result.status).toBe('timed-out');
    expect(result.failedTrials.length).toBe(1);
    expect(result.failedTrials[0]?.error).toContain('Timeout');

    vi.useRealTimers();
  });

  it('handles cancellation via AbortSignal during execution and runs cleanup', async () => {
    const { clock, advance } = createMockClock();
    const scheduler = createMockScheduler(advance);
    let cleanupExecuted = false;
    const controller = new AbortController();

    const adapter: WorkloadAdapter = {
      name: 'cancellable-adapter',
      setup: () => {},
      execute: (_ctx, { iteration, isWarmup }) => {
        // Abort during first measured iteration
        if (!isWarmup && iteration === 1) {
          controller.abort(new Error('User clicked cancel benchmark'));
        }
        advance(10);
      },
      cleanup: () => {
        cleanupExecuted = true;
      },
    };

    const policy: BenchmarkPolicy = {
      warmupIterations: 2,
      measuredIterations: 5,
      timeoutMsPerIteration: 1000,
      cooldownMsBetweenIterations: 0,
    };

    const result = await runBenchmark(adapter, {
      policy,
      signal: controller.signal,
      clock,
      scheduler,
    });

    expect(cleanupExecuted).toBe(true);
    expect(result.status).toBe('cancelled');
    expect(result.error).toContain('User clicked cancel benchmark');
    expect(result.measuredTrials.length).toBeLessThan(5);
  });

  it('handles cancellation during warmup iterations and guarantees cleanup', async () => {
    const { clock, advance } = createMockClock();
    const scheduler = createMockScheduler(advance);
    let cleanupExecuted = false;
    const controller = new AbortController();

    const adapter: WorkloadAdapter = {
      name: 'warmup-cancellation-adapter',
      setup: () => {},
      execute: (_ctx, { iteration, isWarmup }) => {
        // Abort on the second warmup iteration
        if (isWarmup && iteration === 1) {
          controller.abort(new Error('User cancelled during warmup phase'));
        }
        advance(10);
      },
      cleanup: () => {
        cleanupExecuted = true;
      },
    };

    const policy: BenchmarkPolicy = {
      warmupIterations: 3,
      measuredIterations: 5,
      timeoutMsPerIteration: 1000,
      cooldownMsBetweenIterations: 0,
    };

    const result = await runBenchmark(adapter, {
      policy,
      signal: controller.signal,
      clock,
      scheduler,
    });

    expect(cleanupExecuted).toBe(true);
    expect(result.status).toBe('cancelled');
    expect(result.error).toContain('User cancelled during warmup phase');
    expect(result.measuredTrials.length).toBe(0); // Zero measured trials reached
  });

  it('prevents late-resolving promises from timed-out iterations from mutating completed results', async () => {
    vi.useFakeTimers();

    let lateResolve: ((val: string) => void) | undefined;
    const adapter: WorkloadAdapter<void, string> = {
      name: 'late-resolving-adapter',
      execute: async () => {
        return new Promise<string>((resolve) => {
          lateResolve = resolve;
        });
      },
    };

    const policy: BenchmarkPolicy = {
      warmupIterations: 0,
      measuredIterations: 1,
      timeoutMsPerIteration: 40,
      cooldownMsBetweenIterations: 0,
    };

    const runPromise = runBenchmark(adapter, { policy });

    // Advance clock past the 40ms timeout
    await vi.advanceTimersByTimeAsync(50);
    const result = await runPromise;

    expect(result.status).toBe('timed-out');
    expect(result.failedTrials.length).toBe(1);

    // Now resolve the late promise after the benchmark has already completed
    if (lateResolve) {
      lateResolve('late-corrupted-output');
    }

    // Result must remain timed-out and latestOutput must not be mutated
    expect(result.status).toBe('timed-out');
    expect(result.latestOutput).toBeUndefined();

    vi.useRealTimers();
  });

  it('captures cleanup failure in warnings without unhandled rejection', async () => {
    const { clock, advance } = createMockClock();
    const scheduler = createMockScheduler(advance);

    const adapter: WorkloadAdapter = {
      name: 'cleanup-throwing-adapter',
      execute: () => {
        advance(10);
      },
      cleanup: () => {
        throw new Error('Disk flush error on cleanup');
      },
    };

    const policy: BenchmarkPolicy = {
      warmupIterations: 0,
      measuredIterations: 2,
      timeoutMsPerIteration: 1000,
      cooldownMsBetweenIterations: 0,
    };

    const result = await runBenchmark(adapter, { policy, clock, scheduler });

    expect(result.warnings.some((w) => w.includes('Disk flush error on cleanup'))).toBe(true);
    expect(result.cleanupDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('runs cleanly with minimal adapter and zero warmups', async () => {
    const { clock, advance } = createMockClock();
    const scheduler = createMockScheduler(advance);

    const minimalAdapter: WorkloadAdapter = {
      name: 'minimal-adapter',
      execute: () => {
        advance(5);
        return 'done';
      },
    };

    const policy: BenchmarkPolicy = {
      warmupIterations: 0,
      measuredIterations: 3,
      timeoutMsPerIteration: 500,
      cooldownMsBetweenIterations: 0,
    };

    const result = await runBenchmark(minimalAdapter, { policy, clock, scheduler });

    expect(result.status).toBe('completed');
    expect(result.warmupTrials.length).toBe(0);
    expect(result.measuredTrials.length).toBe(3);
    expect(result.distribution?.sampleCount).toBe(3);
    expect(result.distribution?.warmupCount).toBe(0);
    expect(result.latestOutput).toBe('done');
  });

  it('handles early cancellation before setup is run', async () => {
    const controller = new AbortController();
    controller.abort('Pre-cancelled');

    let setupCalled = false;
    const adapter: WorkloadAdapter = {
      name: 'pre-cancelled-adapter',
      setup: () => {
        setupCalled = true;
      },
      execute: () => {},
    };

    const result = await runBenchmark(adapter, { signal: controller.signal });

    expect(result.status).toBe('cancelled');
    expect(setupCalled).toBe(false);
    expect(result.trials.length).toBe(0);
  });

  it('reports real progress transitions across all lifecycle phases', async () => {
    const { clock, advance } = createMockClock();
    const scheduler = createMockScheduler(advance);

    const progressReports: BenchmarkProgress[] = [];

    const adapter: WorkloadAdapter = {
      name: 'progress-adapter',
      setup: () => advance(10),
      execute: () => advance(15),
      cleanup: () => advance(5),
    };

    const policy: BenchmarkPolicy = {
      warmupIterations: 1,
      measuredIterations: 2,
      timeoutMsPerIteration: 1000,
      cooldownMsBetweenIterations: 10,
    };

    await runBenchmark(adapter, {
      policy,
      clock,
      scheduler,
      onProgress: (p) => progressReports.push(p),
    });

    const phases = progressReports.map((p) => p.phase);

    expect(phases).toContain('validating');
    expect(phases).toContain('environment');
    expect(phases).toContain('setup');
    expect(phases).toContain('warmup');
    expect(phases).toContain('measurement');
    expect(phases).toContain('cleanup');
    expect(phases).toContain('completed');

    // Real progress counters
    const warmupReports = progressReports.filter((p) => p.phase === 'warmup');
    expect(warmupReports.length).toBe(1);
    expect(warmupReports[0]?.isWarmup).toBe(true);

    const measurementReports = progressReports.filter((p) => p.phase === 'measurement');
    expect(measurementReports.length).toBe(2);
    expect(measurementReports[0]?.isWarmup).toBe(false);
  });

  it('rejects invalid policy configurations', async () => {
    const adapter: WorkloadAdapter = {
      name: 'invalid-policy-adapter',
      execute: () => {},
    };

    // measuredIterations < 1
    await expect(
      runBenchmark(adapter, {
        policy: { measuredIterations: 0 },
      }),
    ).rejects.toThrowError(/at least 1 measured iteration/i);

    // timeout <= 0
    await expect(
      runBenchmark(adapter, {
        policy: { timeoutMsPerIteration: -100 },
      }),
    ).rejects.toThrowError(/strictly positive/i);
  });

  it('preserves validation errors reported by adapter.validateOutput', async () => {
    const { clock, advance } = createMockClock();
    const scheduler = createMockScheduler(advance);

    const adapter: WorkloadAdapter<void, string> = {
      name: 'validation-hook-adapter',
      execute: () => {
        advance(10);
        return 'corrupted-data-output';
      },
      validateOutput: (output) => {
        if (output === 'corrupted-data-output') {
          return 'Data hash divergence: output corrupted';
        }
        return true;
      },
    };

    const policy: BenchmarkPolicy = {
      warmupIterations: 0,
      measuredIterations: 2,
      timeoutMsPerIteration: 1000,
      cooldownMsBetweenIterations: 0,
    };

    const result = await runBenchmark(adapter, { policy, clock, scheduler });

    expect(result.status).toBe('failed');
    expect(result.failedTrials.length).toBe(1);
    expect(result.failedTrials[0]?.error).toContain('Data hash divergence');
  });

  it('appends incomplete run warnings if cancelled after some measured iterations', async () => {
    const { clock, advance } = createMockClock();
    const scheduler = createMockScheduler(advance);
    const controller = new AbortController();

    let count = 0;
    const adapter: WorkloadAdapter = {
      name: 'partially-completed-adapter',
      execute: () => {
        count++;
        advance(10);
        if (count === 3) {
          // Abort after 3 trials (1 warmup + 2 measured)
          controller.abort('User stopped early');
        }
      },
    };

    const policy: BenchmarkPolicy = {
      warmupIterations: 1,
      measuredIterations: 5,
      timeoutMsPerIteration: 1000,
      cooldownMsBetweenIterations: 0,
    };

    const result = await runBenchmark(adapter, {
      policy,
      signal: controller.signal,
      clock,
      scheduler,
    });

    expect(result.status).toBe('cancelled');
    expect(result.distribution).toBeDefined();
    // Incomplete run warning must be attached
    expect(result.distribution?.warnings?.some((w) => w.includes('INCOMPLETE BENCHMARK'))).toBe(
      true,
    );
  });
});
