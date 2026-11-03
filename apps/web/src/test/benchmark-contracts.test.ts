import { describe, expect, it } from 'vitest';
import {
  METRIC_PROVENANCES,
  createProvenancedValue,
  isMeasured,
  isEstimated,
  isSimulated,
  isInferred,
  provenancedValueSchema,
  benchmarkTrialSchema,
  benchmarkDistributionSchema,
  correctnessGateResultSchema,
  benchmarkEnvironmentSchema,
  benchmarkPolicySchema,
  DEFAULT_BENCHMARK_POLICY,
  validateBenchmarkComparisonRecord,
  safeValidateBenchmarkComparisonRecord,
  type BenchmarkComparisonRecord,
  type BenchmarkTrial,
  type BenchmarkDistribution,
  type BenchmarkEnvironment,
  type CorrectnessGateResult,
  type BenchmarkVariantRun,
} from '../types/benchmark';
import { z } from 'zod';

describe('Benchmark Contracts & Metric Provenance (M1-T01)', () => {
  describe('Metric Provenance Labels', () => {
    it('defines all 6 standard provenance labels from Version 2 Source of Truth Sec. 10.3', () => {
      expect(METRIC_PROVENANCES).toEqual([
        'measured',
        'estimated',
        'simulated',
        'inferred',
        'unavailable',
        'unsupported',
      ]);
    });

    it('creates provenanced value wrappers and applies type predicates correctly', () => {
      const measuredRender = createProvenancedValue(
        14.2,
        'measured',
        'performance.now() rAF delta',
      );
      const estimatedDom = createProvenancedValue(
        24000,
        'estimated',
        'formula: totalRows * (cols * 2 + 1)',
        'Subject to virtualizer viewport bounding',
      );
      const simulatedStream = createProvenancedValue(
        200,
        'simulated',
        'Synthetic in-memory interval generator',
      );
      const inferredBottleneck = createProvenancedValue(
        'DOM Layout Saturation',
        'inferred',
        'Rule engine heuristic from rowCount > 1000',
      );

      expect(isMeasured(measuredRender)).toBe(true);
      expect(isEstimated(measuredRender)).toBe(false);

      expect(isEstimated(estimatedDom)).toBe(true);
      expect(isMeasured(estimatedDom)).toBe(false);
      expect(estimatedDom.notes).toBe('Subject to virtualizer viewport bounding');

      expect(isSimulated(simulatedStream)).toBe(true);
      expect(isInferred(inferredBottleneck)).toBe(true);
    });

    it('validates provenanced values through Zod schema', () => {
      const numberSchema = provenancedValueSchema(z.number());

      const validMetric = {
        value: 42.5,
        provenance: 'measured',
        method: 'performance.now()',
      };
      expect(numberSchema.parse(validMetric)).toEqual(validMetric);

      // Rejects invalid provenance label
      expect(() =>
        numberSchema.parse({
          value: 42.5,
          provenance: 'guessed', // invalid
          method: 'guesswork',
        }),
      ).toThrow();

      // Rejects missing method
      expect(() =>
        numberSchema.parse({
          value: 42.5,
          provenance: 'measured',
          method: '',
        }),
      ).toThrow();
    });
  });

  describe('Benchmark Trials & Phase Timings', () => {
    it('validates single trial records and warm-up flags', () => {
      const warmupTrial: BenchmarkTrial = {
        iteration: 0,
        isWarmup: true,
        durationMs: 25.4,
        phaseTimings: {
          setupMs: 2.1,
          parseMs: 5.0,
          renderMs: 18.0,
          cleanupMs: 0.3,
          totalMs: 25.4,
        },
        domNodes: 120,
        timestamp: 1730000000000,
      };

      const parsed = benchmarkTrialSchema.parse(warmupTrial);
      expect(parsed.isWarmup).toBe(true);
      expect(parsed.phaseTimings?.renderMs).toBe(18.0);
    });

    it('rejects trial records with negative duration or negative iteration indices', () => {
      expect(() =>
        benchmarkTrialSchema.parse({
          iteration: -1,
          isWarmup: false,
          durationMs: 12.0,
          timestamp: Date.now(),
        }),
      ).toThrow();

      expect(() =>
        benchmarkTrialSchema.parse({
          iteration: 1,
          isWarmup: false,
          durationMs: -5.0,
          timestamp: Date.now(),
        }),
      ).toThrow();
    });
  });

  describe('Benchmark Distribution Model', () => {
    it('validates multi-trial distribution with median, spread, and standard deviation', () => {
      const trials: BenchmarkTrial[] = [
        { iteration: 1, isWarmup: false, durationMs: 14.1, timestamp: 100 },
        { iteration: 2, isWarmup: false, durationMs: 14.5, timestamp: 200 },
        { iteration: 3, isWarmup: false, durationMs: 13.9, timestamp: 300 },
      ];

      const distribution: BenchmarkDistribution = {
        sampleCount: 3,
        warmupCount: 2,
        medianMs: 14.1,
        meanMs: 14.17,
        minMs: 13.9,
        maxMs: 14.5,
        spreadMs: 0.6,
        standardDeviationMs: 0.25,
        p95Ms: 14.48,
        trials,
      };

      const parsed = benchmarkDistributionSchema.parse(distribution);
      expect(parsed.sampleCount).toBe(3);
      expect(parsed.spreadMs).toBe(0.6);
      expect(parsed.trials.length).toBe(3);
    });
  });

  describe('Correctness Gates Schema', () => {
    it('validates passed correctness status when records and schemas match', () => {
      const passedGate: CorrectnessGateResult = {
        status: 'passed',
        recordCountParity: true,
        schemaParity: true,
        sampleHashParity: true,
        nullSemanticsPreserved: true,
        orderPreserved: true,
      };

      expect(correctnessGateResultSchema.parse(passedGate).status).toBe('passed');
    });

    it('validates failed status with divergence diagnostics', () => {
      const failedGate: CorrectnessGateResult = {
        status: 'failed',
        recordCountParity: false,
        schemaParity: true,
        nullSemanticsPreserved: false,
        divergenceDetails: [
          'Row count mismatch: baseline has 10,000 rows, candidate produced 9,950',
          'Candidate dropped 50 null-containing records',
        ],
      };

      const parsed = correctnessGateResultSchema.parse(failedGate);
      expect(parsed.status).toBe('failed');
      expect(parsed.divergenceDetails?.length).toBe(2);
    });
  });

  describe('Benchmark Environment & Policy', () => {
    it('validates runtime environment and ISO timestamp', () => {
      const env: BenchmarkEnvironment = {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        platform: 'MacIntel',
        hardwareConcurrency: 8,
        deviceMemoryGb: 16,
        browserEngine: 'Blink',
        jsRuntime: 'V8',
        capturedAt: new Date().toISOString(),
      };

      const parsed = benchmarkEnvironmentSchema.parse(env);
      expect(parsed.hardwareConcurrency).toBe(8);
      expect(parsed.deviceMemoryGb).toBe(16);
    });

    it('validates default policy parameters', () => {
      const policy = benchmarkPolicySchema.parse(DEFAULT_BENCHMARK_POLICY);
      expect(policy.warmupIterations).toBe(2);
      expect(policy.measuredIterations).toBe(5);
      expect(policy.timeoutMsPerIteration).toBe(5000);
    });
  });

  describe('Full Canonical Comparison Record (BenchmarkComparisonRecord)', () => {
    const mockEnvironment: BenchmarkEnvironment = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: 'MacIntel',
      hardwareConcurrency: 10,
      deviceMemoryGb: 32,
      browserEngine: 'Blink',
      jsRuntime: 'V8',
      capturedAt: '2026-11-03T12:00:00.000Z',
    };

    const mockBaselineVariant: BenchmarkVariantRun = {
      variantId: 'variant-naive-dom',
      variantLabel: 'Baseline Naive DOM Mounting',
      distribution: {
        sampleCount: 5,
        warmupCount: 2,
        medianMs: 420.5,
        meanMs: 422.1,
        minMs: 410.0,
        maxMs: 435.0,
        spreadMs: 25.0,
        standardDeviationMs: 8.2,
        trials: [
          { iteration: 1, isWarmup: false, durationMs: 420.5, timestamp: 100 },
          { iteration: 2, isWarmup: false, durationMs: 410.0, timestamp: 200 },
          { iteration: 3, isWarmup: false, durationMs: 435.0, timestamp: 300 },
          { iteration: 4, isWarmup: false, durationMs: 425.0, timestamp: 400 },
          { iteration: 5, isWarmup: false, durationMs: 420.0, timestamp: 500 },
        ],
      },
      domNodeCount: createProvenancedValue(
        80000,
        'estimated',
        'formula: rows * (cols * 2 + 1)',
        'Uncapped baseline DOM tree',
      ),
      estimatedMemoryBytes: createProvenancedValue(
        15728640,
        'estimated',
        'heuristic: rawBytes * 3.2',
      ),
    };

    const mockCandidateVariant: BenchmarkVariantRun = {
      variantId: 'variant-tanstack-virtual',
      variantLabel: 'Row Virtualization (TanStack Virtual)',
      distribution: {
        sampleCount: 5,
        warmupCount: 2,
        medianMs: 14.8,
        meanMs: 15.1,
        minMs: 13.9,
        maxMs: 16.5,
        spreadMs: 2.6,
        standardDeviationMs: 0.9,
        p95Ms: 16.3,
        trials: [
          { iteration: 1, isWarmup: false, durationMs: 14.8, timestamp: 100 },
          { iteration: 2, isWarmup: false, durationMs: 13.9, timestamp: 200 },
          { iteration: 3, isWarmup: false, durationMs: 16.5, timestamp: 300 },
          { iteration: 4, isWarmup: false, durationMs: 15.2, timestamp: 400 },
          { iteration: 5, isWarmup: false, durationMs: 15.1, timestamp: 500 },
        ],
      },
      domNodeCount: createProvenancedValue(
        240,
        'measured',
        'document.querySelectorAll inside table container',
        'Constant O(1) viewport footprint',
      ),
    };

    const validRecord: BenchmarkComparisonRecord = {
      id: 'cmp_run_20261103_001',
      workloadId: 'workload_ecommerce_25k',
      workloadName: 'ecommerce-inventory-25k.csv',
      workloadFingerprint: 'sha256-a1b2c3d4e5f6',
      environment: mockEnvironment,
      policy: DEFAULT_BENCHMARK_POLICY,
      baseline: mockBaselineVariant,
      candidate: mockCandidateVariant,
      correctness: {
        status: 'passed',
        recordCountParity: true,
        schemaParity: true,
        nullSemanticsPreserved: true,
      },
      verdict: 'improved',
      verdictReason:
        'Median initial render duration decreased by 96.5% with O(1) DOM reduction and verified output correctness.',
      delta: {
        medianDurationMs: -405.7,
        medianDurationChangePct: -96.5,
        domNodesDelta: -79760,
        domNodesChangePct: -99.7,
      },
      warnings: [],
      createdAt: '2026-11-03T12:05:00.000Z',
    };

    it('strictly distinguishes measured vs estimated metrics across variants', () => {
      // Baseline DOM is estimated; Candidate DOM is measured
      expect(isEstimated(validRecord.baseline.domNodeCount)).toBe(true);
      expect(isMeasured(validRecord.candidate.domNodeCount)).toBe(true);

      // Render durations are both measured via performance.now()
      expect(validRecord.baseline.distribution.trials[0]!.durationMs).toBe(420.5);
      expect(validRecord.candidate.distribution.trials[0]!.durationMs).toBe(14.8);
    });

    it('validates a complete comparison record through validateBenchmarkComparisonRecord', () => {
      const validated = validateBenchmarkComparisonRecord(validRecord);
      expect(validated.id).toBe('cmp_run_20261103_001');
      expect(validated.verdict).toBe('improved');
      expect(validated.correctness.status).toBe('passed');
    });

    it('safeValidateBenchmarkComparisonRecord returns success: false for invalid records', () => {
      const invalid = {
        ...validRecord,
        verdict: 'miraculously-fast', // invalid verdict
      };

      const result = safeValidateBenchmarkComparisonRecord(invalid);
      expect(result.success).toBe(false);
    });
  });
});
