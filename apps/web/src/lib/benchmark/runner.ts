import {
  DEFAULT_BENCHMARK_POLICY,
  benchmarkPolicySchema,
  type BenchmarkDistribution,
  type BenchmarkEnvironment,
  type BenchmarkPolicy,
  type BenchmarkTrial,
  type PhaseTimings,
} from '../../types/benchmark';
import { aggregateBenchmarkDistribution } from './statistics';
import { captureBenchmarkEnvironment } from './environment';

/**
 * Clock abstraction for high-resolution timing.
 * Allows deterministic clock injection in test suites.
 */
export interface Clock {
  now(): number;
}

export const defaultClock: Clock = {
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
};

/**
 * Scheduler abstraction for inter-iteration cooldowns and yields.
 * Allows instantaneous virtual timer injection in test suites without setTimeout delays.
 */
export interface Scheduler {
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export const defaultScheduler: Scheduler = {
  sleep: (ms: number, signal?: AbortSignal): Promise<void> =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) {
        return reject(signal.reason ?? new Error('Benchmark operation cancelled.'));
      }
      const timer = setTimeout(() => resolve(), ms);
      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(signal.reason ?? new Error('Benchmark operation cancelled.'));
          },
          { once: true },
        );
      }
    }),
};

/**
 * Strongly typed Workload Adapter interface.
 *
 * Responsibilities:
 * - setup: Run preparatory work before timing begins (e.g. data generation, allocations).
 * - execute: The actual candidate or baseline routine to measure.
 * - cleanup: Teardown logic guaranteeing resource disposal (e.g. freeing memory, revoking URLs).
 * - validateOutput: Optional hook to verify semantic correctness per trial or post-run.
 * - collectMetrics: Optional hook to extract telemetry (DOM nodes, heap bytes) post-execute.
 */
export interface WorkloadAdapter<TContext = unknown, TOutput = unknown> {
  name: string;
  setup?: () => Promise<TContext> | TContext;
  execute: (
    context: TContext,
    trialInfo: { iteration: number; isWarmup: boolean },
  ) => Promise<TOutput> | TOutput;
  cleanup?: (context: TContext) => Promise<void> | void;
  validateOutput?: (
    output: TOutput,
    context: TContext,
  ) => Promise<boolean | string> | boolean | string;
  collectMetrics?: (
    output: TOutput,
    context: TContext,
  ) => { domNodes?: number; heapBytesUsed?: number };
}

/**
 * Benchmark execution phases for real-time progress callbacks.
 */
export type BenchmarkPhase =
  | 'validating'
  | 'environment'
  | 'setup'
  | 'warmup'
  | 'cooldown'
  | 'measurement'
  | 'cleanup'
  | 'aggregating'
  | 'completed'
  | 'failed';

export interface BenchmarkProgress {
  phase: BenchmarkPhase;
  currentIteration: number;
  isWarmup: boolean;
  totalWarmups: number;
  totalMeasured: number;
  completedMeasured: number;
  percent: number;
  message?: string;
}

export type BenchmarkProgressCallback = (progress: BenchmarkProgress) => void;

/**
 * Execution Status of a completed or halted benchmark run.
 */
export type BenchmarkRunStatus =
  | 'completed'
  | 'cancelled'
  | 'timed-out'
  | 'failed'
  | 'partial';

/**
 * Structured outcome returned by the Benchmark Execution Engine.
 */
export interface BenchmarkRunResult<TOutput = unknown> {
  status: BenchmarkRunStatus;
  adapterName: string;
  environment: BenchmarkEnvironment;
  policy: BenchmarkPolicy;
  /** Aggregated distribution computed via M1-T02a; only present when valid measured trials exist */
  distribution?: BenchmarkDistribution;
  trials: BenchmarkTrial[];
  warmupTrials: BenchmarkTrial[];
  measuredTrials: BenchmarkTrial[];
  failedTrials: BenchmarkTrial[];
  setupDurationMs: number;
  cleanupDurationMs: number;
  totalDurationMs: number;
  latestOutput?: TOutput;
  error?: string;
  warnings: string[];
}

/**
 * Configuration options for executing a benchmark run.
 */
export interface BenchmarkRunnerOptions {
  policy?: Partial<BenchmarkPolicy>;
  signal?: AbortSignal;
  onProgress?: BenchmarkProgressCallback;
  clock?: Clock;
  scheduler?: Scheduler;
  customNavigator?: Partial<Navigator>;
}

/**
 * Validates a benchmark policy against schema and boundary constraints.
 */
function validatePolicy(policy: BenchmarkPolicy): void {
  if (policy.measuredIterations < 1) {
    throw new Error('Benchmark policy must specify at least 1 measured iteration.');
  }
  if (policy.timeoutMsPerIteration <= 0) {
    throw new Error('Benchmark policy timeout per iteration must be strictly positive.');
  }
  benchmarkPolicySchema.parse(policy);
}

/**
 * Deterministic Asynchronous Benchmark Execution Engine (Milestone 1, Task M1-T02b).
 *
 * Timing Guarantees:
 * - Only the code inside `adapter.execute()` is measured in trial `durationMs`.
 * - Setup and cleanup durations are recorded strictly outside trial durations.
 * - Caveat: Synchronous JavaScript execution timing does NOT account for full
 *   browser layout reflows, GPU compositing, or user-perceived INP unless the
 *   workload adapter explicitly yields to `requestAnimationFrame` or performance observers.
 *
 * Safety & Lifecycle Guarantees:
 * - `adapter.cleanup()` is guaranteed to execute on EVERY exit path (success, error, timeout, cancellation).
 * - Late-resolving asynchronous operations from timed-out iterations cannot overwrite completed results.
 * - Failed trials are never discarded; errors are recorded directly in trial entries.
 * - Partial benchmarks are explicitly labeled and never misrepresented as complete successful runs.
 */
export async function runBenchmark<TContext = unknown, TOutput = unknown>(
  adapter: WorkloadAdapter<TContext, TOutput>,
  options: BenchmarkRunnerOptions = {},
): Promise<BenchmarkRunResult<TOutput>> {
  const clock = options.clock ?? defaultClock;
  const scheduler = options.scheduler ?? defaultScheduler;
  const signal = options.signal;
  const onProgress = options.onProgress;

  const policy: BenchmarkPolicy = {
    ...DEFAULT_BENCHMARK_POLICY,
    ...(options.policy ?? {}),
  };

  const warnings: string[] = [];
  const allTrials: BenchmarkTrial[] = [];
  let status: BenchmarkRunStatus = 'completed';
  let runError: string | undefined;
  let latestOutput: TOutput | undefined;

  let setupDurationMs = 0;
  let cleanupDurationMs = 0;
  const runStartTime = clock.now();

  // Token guarding against late-resolving promises modifying completed results
  let isRunActive = true;

  // Helper for progress notification
  const notifyProgress = (
    phase: BenchmarkPhase,
    currentIteration: number,
    isWarmup: boolean,
    completedMeasured: number,
    message?: string,
  ) => {
    if (!onProgress) return;
    const totalWarmups = policy.warmupIterations;
    const totalMeasured = policy.measuredIterations;
    const totalIterations = totalWarmups + totalMeasured;
    const completedTotal = (isWarmup ? currentIteration : totalWarmups) + completedMeasured;
    const percent =
      totalIterations > 0 ? Math.min(100, Math.round((completedTotal / totalIterations) * 100)) : 100;

    onProgress({
      phase,
      currentIteration,
      isWarmup,
      totalWarmups,
      totalMeasured,
      completedMeasured,
      percent,
      message,
    });
  };

  notifyProgress('validating', 0, true, 0, 'Validating benchmark configuration.');

  // 1. Validate configuration
  try {
    validatePolicy(policy);
  } catch (err) {
    notifyProgress('failed', 0, true, 0, (err as Error).message);
    throw err;
  }

  // 2. Capture runtime environment metadata
  notifyProgress('environment', 0, true, 0, 'Capturing runtime environment metadata.');
  const environment = captureBenchmarkEnvironment(options.customNavigator);

  // Check early cancellation before setup
  if (signal?.aborted) {
    status = 'cancelled';
    runError = signal.reason ? String(signal.reason) : 'Benchmark cancelled prior to setup.';
    warnings.push(runError);
    notifyProgress('failed', 0, true, 0, runError);

    return {
      status,
      adapterName: adapter.name,
      environment,
      policy,
      trials: [],
      warmupTrials: [],
      measuredTrials: [],
      failedTrials: [],
      setupDurationMs,
      cleanupDurationMs,
      totalDurationMs: clock.now() - runStartTime,
      error: runError,
      warnings,
    };
  }

  let context: TContext | undefined;

  try {
    // 3. Execute Setup (timed strictly outside trials)
    notifyProgress('setup', 0, true, 0, 'Executing workload setup.');
    const setupStart = clock.now();
    if (adapter.setup) {
      context = await adapter.setup();
    }
    setupDurationMs = Math.max(0, clock.now() - setupStart);

    // 4. Execute Warmup and Measured Trials
    const totalIterations = policy.warmupIterations + policy.measuredIterations;

    for (let i = 0; i < totalIterations; i++) {
      if (!isRunActive) break;

      const isWarmup = i < policy.warmupIterations;
      const trialIteration = isWarmup ? i : i - policy.warmupIterations;
      const currentPhase: BenchmarkPhase = isWarmup ? 'warmup' : 'measurement';
      const completedMeasured = allTrials.filter((t) => !t.isWarmup && !t.error).length;

      // Check cancellation prior to trial launch
      if (signal?.aborted) {
        status = 'cancelled';
        runError = signal.reason ? String(signal.reason) : 'Benchmark cancelled by user.';
        warnings.push(runError);
        isRunActive = false;
        break;
      }

      notifyProgress(
        currentPhase,
        trialIteration,
        isWarmup,
        completedMeasured,
        `Running ${isWarmup ? 'warm-up' : 'measured'} iteration ${trialIteration + 1}.`,
      );

      // Execute trial with timeout protection
      const trialStart = clock.now();
      let trialDuration = 0;
      let trialError: string | undefined;
      let trialPhaseTimings: PhaseTimings | undefined;
      let metrics: { domNodes?: number; heapBytesUsed?: number } | undefined;

      try {
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(
              new Error(
                `Timeout: Iteration ${trialIteration} exceeded policy timeout of ${policy.timeoutMsPerIteration}ms.`,
              ),
            );
          }, policy.timeoutMsPerIteration);
        });

        const abortPromise = new Promise<never>((_, reject) => {
          if (signal) {
            signal.addEventListener(
              'abort',
              () => {
                reject(
                  new Error(
                    signal.reason
                      ? String(signal.reason)
                      : 'Benchmark cancelled during iteration execution.',
                  ),
                );
              },
              { once: true },
            );
          }
        });

        const executePromise = Promise.resolve().then(() =>
          adapter.execute(context as TContext, { iteration: trialIteration, isWarmup }),
        );

        // Race execution against timeout and cancellation
        const output = await Promise.race([executePromise, timeoutPromise, abortPromise]);

        if (timeoutHandle) clearTimeout(timeoutHandle);

        trialDuration = Math.max(0, clock.now() - trialStart);
        latestOutput = output;

        // Optional metric collection hook
        if (adapter.collectMetrics) {
          metrics = adapter.collectMetrics(output, context as TContext);
        }

        // Optional output validation hook
        if (adapter.validateOutput) {
          const valid = await adapter.validateOutput(output, context as TContext);
          if (valid === false || typeof valid === 'string') {
            const reason = typeof valid === 'string' ? valid : 'Validation hook returned false';
            trialError = `Validation Error: ${reason}`;
            status = 'failed';
            runError = trialError;
            isRunActive = false;
          }
        }

        trialPhaseTimings = {
          totalMs: trialDuration,
        };
      } catch (err) {
        trialDuration = Math.max(0, clock.now() - trialStart);
        const errMessage = (err as Error).message || String(err);

        if (signal?.aborted || errMessage.toLowerCase().includes('cancelled')) {
          trialError = `Cancelled: ${errMessage}`;
          status = 'cancelled';
          runError = trialError;
          isRunActive = false;
        } else if (errMessage.toLowerCase().includes('timeout')) {
          trialError = `Timeout: ${errMessage}`;
          status = 'timed-out';
          runError = trialError;
          isRunActive = false; // Stop subsequent runs on timeout
        } else {
          trialError = `Execution Error: ${errMessage}`;
          status = 'failed';
          runError = trialError;
          isRunActive = false; // Stop subsequent runs on execution error
        }
      }

      // Record trial preserving failure information
      const trialRecord: BenchmarkTrial = {
        iteration: trialIteration,
        isWarmup,
        durationMs: trialDuration,
        timestamp: trialStart,
        domNodes: metrics?.domNodes,
        heapBytesUsed: metrics?.heapBytesUsed,
        phaseTimings: trialPhaseTimings,
        error: trialError,
      };

      allTrials.push(trialRecord);

      if (trialError) {
        warnings.push(`Trial ${trialIteration} (${isWarmup ? 'warmup' : 'measured'}): ${trialError}`);
        break; // Stop iteration loop on failure
      }

      // Inter-iteration cooldown if requested by policy and not the last iteration
      if (i < totalIterations - 1 && policy.cooldownMsBetweenIterations > 0 && isRunActive) {
        notifyProgress('cooldown', trialIteration, isWarmup, completedMeasured);
        await scheduler.sleep(policy.cooldownMsBetweenIterations, signal);
      }
    }
  } catch (unhandledSetupErr) {
    status = 'failed';
    runError = `Setup Error: ${(unhandledSetupErr as Error).message}`;
    warnings.push(runError);
  } finally {
    // 5. Cleanup Execution Guarantee (always runs on every exit path)
    notifyProgress('cleanup', 0, false, allTrials.filter((t) => !t.isWarmup && !t.error).length);
    const cleanupStart = clock.now();
    if (adapter.cleanup) {
      try {
        await adapter.cleanup(context as TContext);
      } catch (cleanupErr) {
        const cleanupMsg = `Cleanup Error: ${(cleanupErr as Error).message}`;
        warnings.push(cleanupMsg);
        if (!runError) {
          runError = cleanupMsg;
        }
      }
    }
    cleanupDurationMs = Math.max(0, clock.now() - cleanupStart);
  }

  // 6. Partition trials
  const warmupTrials = allTrials.filter((t) => t.isWarmup);
  const measuredTrials = allTrials.filter((t) => !t.isWarmup);
  const failedTrials = allTrials.filter((t) => t.error !== undefined);

  // Determine final status
  if (status === 'completed' && measuredTrials.length < policy.measuredIterations) {
    status = 'partial';
    warnings.push(
      `Partial benchmark: only ${measuredTrials.length} of ${policy.measuredIterations} planned iterations completed.`,
    );
  }

  // 7. Statistical Aggregation (Delegated to M1-T02a)
  let distribution: BenchmarkDistribution | undefined;
  const successfulMeasuredTrials = measuredTrials.filter((t) => !t.error);

  if (successfulMeasuredTrials.length > 0) {
    notifyProgress('aggregating', 0, false, successfulMeasuredTrials.length);
    try {
      // Delegate to M1-T02a aggregation function
      distribution = aggregateBenchmarkDistribution(allTrials);

      // If the benchmark was interrupted or partial, reflect in distribution warnings
      if (status !== 'completed') {
        const partialWarning = `INCOMPLETE BENCHMARK (${status.toUpperCase()}): Statistics computed from ${successfulMeasuredTrials.length} of ${policy.measuredIterations} planned iterations.`;
        distribution.warnings = [partialWarning, ...(distribution.warnings ?? [])];
      }
    } catch (aggErr) {
      warnings.push(`Statistical aggregation error: ${(aggErr as Error).message}`);
    }
  } else if (status === 'completed') {
    status = 'failed';
    runError = 'No successful measured trials available for statistical aggregation.';
    warnings.push(runError);
  }

  const finalPhase: BenchmarkPhase = status === 'completed' ? 'completed' : 'failed';
  notifyProgress(
    finalPhase,
    0,
    false,
    successfulMeasuredTrials.length,
    status === 'completed' ? 'Benchmark completed successfully.' : `Benchmark halted: ${status}.`,
  );

  return {
    status,
    adapterName: adapter.name,
    environment,
    policy,
    distribution,
    trials: allTrials,
    warmupTrials,
    measuredTrials,
    failedTrials,
    setupDurationMs,
    cleanupDurationMs,
    totalDurationMs: clock.now() - runStartTime,
    latestOutput,
    error: runError,
    warnings,
  };
}
