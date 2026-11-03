/**
 * LOADOUT Version 2.0 — Dataset Benchmark Suite Coordinator
 *
 * Coordinates execution of baseline and candidate workload adapters, executes correctness gates,
 * calculates statistical comparison uncertainty, and produces canonical BenchmarkComparisonRecord instances.
 *
 * Core Principles:
 * - Timings capture solely execute() duration. Setup, cleanup, and correctness run outside timed interval.
 * - If correctness fails, comparison verdict is strictly set to 'invalid', preventing corrupt candidates from claiming improvement.
 * - Runtime environment metadata is captured honestly without fabricated properties.
 */

import type {
  BenchmarkComparisonRecord,
  BenchmarkPolicy,
  BenchmarkVariantRun,
  ComparisonVerdict,
} from '../../../types/benchmark.ts';
import { DEFAULT_BENCHMARK_POLICY, createProvenancedValue } from '../../../types/benchmark.ts';
import { captureBenchmarkEnvironment } from '../environment.ts';
import { runBenchmark, type BenchmarkProgress, type WorkloadAdapter } from '../runner.ts';
import { assessComparisonUncertainty } from '../statistics.ts';
import {
  naiveFilterWorkload,
  optimizedFilterWorkload,
  verifyFilterOutputCorrectness,
  naiveRenderWorkload,
  virtualizedRenderWorkload,
  verifyRenderOutputCorrectness,
  type FilterWorkloadContext,
  type FilterWorkloadOutput,
  type RenderWorkloadContext,
  type RenderWorkloadOutput,
} from './dataset-workloads.ts';

export type DatasetBenchmarkType = 'table-render' | 'search-filter';

export interface RunDatasetBenchmarkOptions {
  datasetName: string;
  rows: Record<string, unknown>[];
  columns: string[];
  benchmarkType: DatasetBenchmarkType;
  searchQuery?: string;
  policy?: BenchmarkPolicy;
  signal?: AbortSignal;
  onProgress?: (progress: BenchmarkProgress & { activeVariant: 'baseline' | 'candidate' }) => void;
}

export async function runDatasetComparisonSuite(
  options: RunDatasetBenchmarkOptions,
): Promise<BenchmarkComparisonRecord> {
  const {
    datasetName,
    rows,
    columns,
    benchmarkType,
    searchQuery = 'test',
    policy = DEFAULT_BENCHMARK_POLICY,
    signal,
    onProgress,
  } = options;

  const environment = captureBenchmarkEnvironment();
  const timestamp = new Date().toISOString();

  let baselineVariant: BenchmarkVariantRun;
  let candidateVariant: BenchmarkVariantRun;
  let correctnessResult;

  if (benchmarkType === 'search-filter') {
    // 1. Search Filter Comparison
    const filterContext: FilterWorkloadContext = {
      rows,
      columns,
      query: searchQuery,
    };

    const baselineAdapter: WorkloadAdapter<FilterWorkloadContext, FilterWorkloadOutput> = {
      ...naiveFilterWorkload,
      setup: () => filterContext,
    };

    const baselineRun = await runBenchmark(baselineAdapter, {
      policy,
      signal,
      onProgress: (p) => onProgress?.({ ...p, activeVariant: 'baseline' }),
    });

    if (baselineRun.status !== 'completed' || !baselineRun.distribution) {
      throw new Error(
        `Baseline benchmark failed or was halted: ${baselineRun.error || baselineRun.status}`,
      );
    }

    const candidateAdapter: WorkloadAdapter<FilterWorkloadContext, FilterWorkloadOutput> = {
      ...optimizedFilterWorkload,
      setup: () => filterContext,
    };

    const candidateRun = await runBenchmark(candidateAdapter, {
      policy,
      signal,
      onProgress: (p) => onProgress?.({ ...p, activeVariant: 'candidate' }),
    });

    if (candidateRun.status !== 'completed' || !candidateRun.distribution) {
      throw new Error(
        `Candidate benchmark failed or was halted: ${candidateRun.error || candidateRun.status}`,
      );
    }

    // Correctness verification executed OUTSIDE timed measurement interval
    const baseOutput = naiveFilterWorkload.execute(filterContext, {
      iteration: 1,
      isWarmup: false,
    });
    const candOutput = optimizedFilterWorkload.execute(filterContext, {
      iteration: 1,
      isWarmup: false,
    });
    correctnessResult = verifyFilterOutputCorrectness(baseOutput, candOutput);

    const baseMatched = baseOutput.matchedIndices.length;
    const candMatched = candOutput.matchedIndices.length;

    baselineVariant = {
      variantId: 'filter-naive-baseline',
      variantLabel: 'Naive Synchronous Search',
      distribution: baselineRun.distribution,
      domNodeCount: createProvenancedValue(
        0,
        'measured',
        'DOM count not applicable for pure filter search',
      ),
      estimatedMemoryBytes: createProvenancedValue(
        baseMatched * 128,
        'estimated',
        'Estimated memory footprint of filtered row pointer array',
      ),
    };

    candidateVariant = {
      variantId: 'filter-optimized-candidate',
      variantLabel: 'Optimized Tokenized Search',
      distribution: candidateRun.distribution,
      domNodeCount: createProvenancedValue(
        0,
        'measured',
        'DOM count not applicable for pure filter search',
      ),
      estimatedMemoryBytes: createProvenancedValue(
        candMatched * 128,
        'estimated',
        'Estimated memory footprint of filtered row pointer array',
      ),
    };
  } else {
    // 2. Table Render / Mount Comparison
    const renderContext: RenderWorkloadContext = {
      rows,
      columns,
      viewportHeight: 480,
      rowHeight: 36,
      scrollTop: 0,
      overscan: 5,
    };

    const baselineAdapter: WorkloadAdapter<RenderWorkloadContext, RenderWorkloadOutput> = {
      ...naiveRenderWorkload,
      setup: () => renderContext,
    };

    const baselineRun = await runBenchmark(baselineAdapter, {
      policy,
      signal,
      onProgress: (p) => onProgress?.({ ...p, activeVariant: 'baseline' }),
    });

    if (baselineRun.status !== 'completed' || !baselineRun.distribution) {
      throw new Error(
        `Baseline benchmark failed or was halted: ${baselineRun.error || baselineRun.status}`,
      );
    }

    const candidateAdapter: WorkloadAdapter<RenderWorkloadContext, RenderWorkloadOutput> = {
      ...virtualizedRenderWorkload,
      setup: () => renderContext,
    };

    const candidateRun = await runBenchmark(candidateAdapter, {
      policy,
      signal,
      onProgress: (p) => onProgress?.({ ...p, activeVariant: 'candidate' }),
    });

    if (candidateRun.status !== 'completed' || !candidateRun.distribution) {
      throw new Error(
        `Candidate benchmark failed or was halted: ${candidateRun.error || candidateRun.status}`,
      );
    }

    // Correctness verification executed OUTSIDE timed interval
    const candidateOutput = virtualizedRenderWorkload.execute(renderContext, {
      iteration: 1,
      isWarmup: false,
    });
    correctnessResult = verifyRenderOutputCorrectness(renderContext, candidateOutput);

    const baseOutput = naiveRenderWorkload.execute(renderContext, {
      iteration: 1,
      isWarmup: false,
    });

    baselineVariant = {
      variantId: 'render-naive-baseline',
      variantLabel: 'Naive Full Table Rendering',
      distribution: baselineRun.distribution,
      domNodeCount: createProvenancedValue(
        baseOutput.domNodeCount,
        'measured',
        'DOM elements required to mount full un-virtualized dataset',
      ),
      estimatedMemoryBytes: createProvenancedValue(
        rows.length * columns.length * 64,
        'estimated',
        'Estimated DOM node heap footprint for full table',
      ),
    };

    candidateVariant = {
      variantId: 'render-virtualized-candidate',
      variantLabel: 'Row Virtualization (TanStack Virtual)',
      distribution: candidateRun.distribution,
      domNodeCount: createProvenancedValue(
        candidateOutput.domNodeCount,
        'measured',
        'DOM elements required to mount viewport-only row window',
      ),
      estimatedMemoryBytes: createProvenancedValue(
        candidateOutput.mountedRowCount * columns.length * 64,
        'estimated',
        'Estimated DOM node heap footprint for viewport slice',
      ),
    };
  }

  // Statistical Comparison Assessment
  const assessment = assessComparisonUncertainty(
    baselineVariant.distribution,
    candidateVariant.distribution,
  );

  let finalVerdict: ComparisonVerdict = assessment.verdict;
  let finalReason = assessment.verdictReason;

  // CRITICAL PRINCIPLE: Prevent incorrect candidates from receiving improvement verdicts
  if (correctnessResult.status === 'failed') {
    finalVerdict = 'invalid';
    finalReason = `Correctness verification failed: ${
      correctnessResult.divergenceDetails?.[0] || 'Semantic divergence detected in candidate output'
    }. A faster candidate that alters output is not a valid optimization.`;
  }

  const baseMedian = baselineVariant.distribution.medianMs;
  const candMedian = candidateVariant.distribution.medianMs;
  const medianDelta = Number((candMedian - baseMedian).toFixed(2));
  const medianPct =
    baseMedian > 0 ? Number((((candMedian - baseMedian) / baseMedian) * 100).toFixed(1)) : 0;

  const baseDom = baselineVariant.domNodeCount.value;
  const candDom = candidateVariant.domNodeCount.value;
  const domDelta = candDom - baseDom;
  const domPct = baseDom > 0 ? Number((((candDom - baseDom) / baseDom) * 100).toFixed(1)) : 0;

  const record: BenchmarkComparisonRecord = {
    id: `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    workloadId: `workload_${datasetName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    workloadName: datasetName,
    workloadFingerprint: `${rows.length}_rows_${columns.length}_cols`,
    environment,
    policy,
    baseline: baselineVariant,
    candidate: candidateVariant,
    correctness: correctnessResult,
    verdict: finalVerdict,
    verdictReason: finalReason,
    delta: {
      medianDurationMs: medianDelta,
      medianDurationChangePct: medianPct,
      domNodesDelta: domDelta,
      domNodesChangePct: domPct,
    },
    warnings: [...assessment.warnings, ...(correctnessResult.warnings || [])],
    createdAt: timestamp,
  };

  return record;
}
