import { describe, expect, it } from 'vitest';
import {
  calculateMean,
  calculateMedian,
  calculateMinMax,
  calculateMin,
  calculateMax,
  calculateSpread,
  calculateVariance,
  calculateStandardDeviation,
  calculatePercentile,
  calculateP95,
  calculateP99,
  calculateQuartiles,
  calculateIQR,
  detectOutliers,
  assessSampleConfidence,
  aggregateBenchmarkDistribution,
  assessComparisonUncertainty,
} from '../lib/benchmark/statistics';
import type { BenchmarkDistribution, BenchmarkTrial } from '../types/benchmark';

describe('Benchmark Statistics & Uncertainty Module (M1-T02a)', () => {
  describe('calculateMean', () => {
    it('calculates exact mean for odd and even sample sizes', () => {
      // Hand-calculated: (10 + 20 + 30 + 40 + 50) / 5 = 30.0
      expect(calculateMean([10, 20, 30, 40, 50])).toBe(30);

      // Hand-calculated: (12 + 16 + 20 + 24) / 4 = 18.0
      expect(calculateMean([12, 16, 20, 24])).toBe(18);
    });

    it('handles zero-duration values correctly', () => {
      expect(calculateMean([0, 0, 0])).toBe(0);
      expect(calculateMean([0, 10, 20])).toBe(10);
    });

    it('rejects empty arrays', () => {
      expect(() => calculateMean([])).toThrowError(/must not be empty/i);
    });

    it('rejects non-finite values (NaN, Infinity)', () => {
      expect(() => calculateMean([10, NaN, 20])).toThrowError(/finite number/i);
      expect(() => calculateMean([10, Infinity])).toThrowError(/finite number/i);
    });

    it('rejects negative duration values', () => {
      expect(() => calculateMean([10, -5, 20])).toThrowError(/non-negative/i);
    });
  });

  describe('calculateMedian', () => {
    it('calculates median for odd sample count (middle element)', () => {
      // Unsorted input; middle element of [10, 20, 30, 40, 50] is 30
      expect(calculateMedian([50, 10, 40, 20, 30])).toBe(30);
    });

    it('calculates median for even sample count (average of two middle elements)', () => {
      // Middle two of [12, 16, 20, 24] are 16 and 20; (16 + 20) / 2 = 18.0
      expect(calculateMedian([24, 12, 20, 16])).toBe(18);
    });

    it('handles single-element array', () => {
      expect(calculateMedian([42.5])).toBe(42.5);
    });
  });

  describe('calculateMin, calculateMax, and calculateSpread', () => {
    it('calculates min, max, and spread accurately', () => {
      const data = [14.2, 10.5, 25.8, 12.0];
      const { min, max } = calculateMinMax(data);
      expect(min).toBe(10.5);
      expect(max).toBe(25.8);
      expect(calculateMin(data)).toBe(10.5);
      expect(calculateMax(data)).toBe(25.8);
      // Hand-calculated: 25.8 - 10.5 = 15.3
      expect(calculateSpread(data)).toBe(15.3);
    });

    it('returns zero spread for uniform measurements', () => {
      expect(calculateSpread([15, 15, 15])).toBe(0);
    });
  });

  describe('calculateVariance and calculateStandardDeviation', () => {
    // Hand-calculated dataset: [10, 20, 30, 40, 50]
    // Mean = 30. Squared diffs: (-20)^2 + (-10)^2 + 0^2 + 10^2 + 20^2 = 1000
    // Sample variance (N - 1 = 4): 1000 / 4 = 250.0
    // Sample std dev: sqrt(250) = 15.8114
    // Population variance (N = 5): 1000 / 5 = 200.0
    // Population std dev: sqrt(200) = 14.1421

    it('calculates sample variance and standard deviation by default (Bessel correction N-1)', () => {
      const data = [10, 20, 30, 40, 50];
      expect(calculateVariance(data, true)).toBe(250);
      expect(calculateStandardDeviation(data, true)).toBe(15.8114);
    });

    it('calculates population variance and standard deviation when isSample is false', () => {
      const data = [10, 20, 30, 40, 50];
      expect(calculateVariance(data, false)).toBe(200);
      expect(calculateStandardDeviation(data, false)).toBe(14.1421);
    });

    it('returns 0 variance and std dev for a single sample', () => {
      expect(calculateVariance([100])).toBe(0);
      expect(calculateStandardDeviation([100])).toBe(0);
    });
  });

  describe('calculatePercentile, P95, and P99 (Type 7 Convention)', () => {
    // Hand-calculated on [10, 20, 30, 40, 50] (N = 5):
    // k = (5 - 1) * (P / 100) = 4 * (P / 100)
    // P25 (Q1): k = 1.0 -> x[1] = 20.0
    // P50 (Median): k = 2.0 -> x[2] = 30.0
    // P75 (Q3): k = 3.0 -> x[3] = 40.0
    // P95: k = 3.8 -> x[3] + 0.8 * (x[4] - x[3]) = 40 + 0.8 * 10 = 48.0
    // P99: k = 3.96 -> x[3] + 0.96 * 10 = 49.6

    it('matches hand-calculated linear interpolation for P25, P50, P75, P95, and P99', () => {
      const data = [10, 20, 30, 40, 50];
      expect(calculatePercentile(data, 25)).toBe(20);
      expect(calculatePercentile(data, 50)).toBe(30);
      expect(calculatePercentile(data, 75)).toBe(40);
      expect(calculateP95(data)).toBe(48);
      expect(calculateP99(data)).toBe(49.6);
    });

    it('handles boundary percentiles 0 and 100', () => {
      const data = [14, 22, 5, 80];
      expect(calculatePercentile(data, 0)).toBe(5);
      expect(calculatePercentile(data, 100)).toBe(80);
    });

    it('rejects invalid percentile parameters (<0 or >100 or NaN)', () => {
      expect(() => calculatePercentile([10, 20], -1)).toThrowError(/range \[0, 100\]/i);
      expect(() => calculatePercentile([10, 20], 101)).toThrowError(/range \[0, 100\]/i);
      expect(() => calculatePercentile([10, 20], NaN)).toThrowError(/finite number/i);
    });
  });

  describe('Quartiles, IQR, and Outlier Detection', () => {
    // Hand-calculated: [10, 12, 12, 13, 14, 15, 16, 18, 95] (N = 9)
    // k_25 = 8 * 0.25 = 2.0 -> Q1 = 12.0
    // k_75 = 8 * 0.75 = 6.0 -> Q3 = 16.0
    // IQR = 16.0 - 12.0 = 4.0
    // Lower fence = 12 - 1.5 * 4 = 6.0
    // Upper fence = 16 + 1.5 * 4 = 22.0
    // Outliers (> 22.0): [95]
    // Clean values (6.0 <= v <= 22.0): [10, 12, 12, 13, 14, 15, 16, 18]

    it('calculates quartiles and IQR correctly', () => {
      const data = [10, 12, 12, 13, 14, 15, 16, 18, 95];
      const { q1, q2, q3 } = calculateQuartiles(data);
      expect(q1).toBe(12);
      expect(q2).toBe(14); // median
      expect(q3).toBe(16);
      expect(calculateIQR(data)).toBe(4);
    });

    it('detects outliers using Tukey fence criteria', () => {
      const data = [10, 12, 12, 13, 14, 15, 16, 18, 95];
      const result = detectOutliers(data, 1.5);

      expect(result.lowerBound).toBe(6);
      expect(result.upperBound).toBe(22);
      expect(result.outliers).toEqual([95]);
      expect(result.cleanValues).toEqual([10, 12, 12, 13, 14, 15, 16, 18]);
    });
  });

  describe('Input Immutability Guarantee', () => {
    it('does not mutate caller-provided arrays in any calculation', () => {
      const original = [45, 12, 89, 3, 27];
      const frozenCopy = Object.freeze([...original]);

      expect(() => calculateMedian(frozenCopy)).not.toThrow();
      expect(() => calculatePercentile(frozenCopy, 95)).not.toThrow();
      expect(() => calculateQuartiles(frozenCopy)).not.toThrow();
      expect(() => detectOutliers(frozenCopy)).not.toThrow();
      expect(frozenCopy).toEqual(original);
    });
  });

  describe('Small Sample Handling & assessSampleConfidence', () => {
    it('flags small sample sizes (N < 20) with explicit tail-latency reliability caveats', () => {
      const n5 = assessSampleConfidence(5);
      expect(n5.isSmallSample).toBe(true);
      expect(n5.p95Reliable).toBe(false);
      expect(n5.p99Reliable).toBe(false);
      expect(n5.warnings.some((w) => w.includes('N>=20 recommended'))).toBe(true);
      expect(n5.warnings.some((w) => w.includes('N>=100 recommended'))).toBe(true);

      const n25 = assessSampleConfidence(25);
      expect(n25.isSmallSample).toBe(false);
      expect(n25.p95Reliable).toBe(true);
      expect(n25.p99Reliable).toBe(false);

      const n100 = assessSampleConfidence(100);
      expect(n100.p95Reliable).toBe(true);
      expect(n100.p99Reliable).toBe(true);
      expect(n100.warnings.length).toBe(0);
    });
  });

  describe('aggregateBenchmarkDistribution', () => {
    const trials: BenchmarkTrial[] = [
      // 2 warmup runs (must be excluded from measurement statistics)
      { iteration: 0, isWarmup: true, durationMs: 120, timestamp: 1 },
      { iteration: 1, isWarmup: true, durationMs: 85, timestamp: 2 },
      // 5 measured runs
      { iteration: 2, isWarmup: false, durationMs: 14.2, timestamp: 3 },
      { iteration: 3, isWarmup: false, durationMs: 13.8, timestamp: 4 },
      { iteration: 4, isWarmup: false, durationMs: 15.0, timestamp: 5 },
      { iteration: 5, isWarmup: false, durationMs: 14.1, timestamp: 6 },
      { iteration: 6, isWarmup: false, durationMs: 14.5, timestamp: 7 },
    ];

    it('excludes warmup trials from measured statistics and preserves all trials in result', () => {
      const dist = aggregateBenchmarkDistribution(trials);

      expect(dist.warmupCount).toBe(2);
      expect(dist.sampleCount).toBe(5);
      expect(dist.trials.length).toBe(7);

      // Measured values only: [13.8, 14.1, 14.2, 14.5, 15.0]
      expect(dist.medianMs).toBe(14.2);
      expect(dist.minMs).toBe(13.8);
      expect(dist.maxMs).toBe(15.0);
      expect(dist.spreadMs).toBe(1.2);
      expect(dist.meanMs).toBe(14.32);

      // Communicates small sample caveats
      expect(dist.warnings).toBeDefined();
      expect(dist.warnings?.length).toBeGreaterThan(0);
    });

    it('throws error if trials array is empty or contains only warmups', () => {
      expect(() => aggregateBenchmarkDistribution([])).toThrowError(/trials array is empty/i);

      const onlyWarmups: BenchmarkTrial[] = [
        { iteration: 0, isWarmup: true, durationMs: 50, timestamp: 1 },
      ];
      expect(() => aggregateBenchmarkDistribution(onlyWarmups)).toThrowError(
        /zero measured iterations/i,
      );
    });
  });

  describe('assessComparisonUncertainty', () => {
    const createDist = (
      medianMs: number,
      meanMs: number,
      minMs: number,
      maxMs: number,
      stdDevMs: number,
      sampleCount = 5,
    ): BenchmarkDistribution => ({
      sampleCount,
      warmupCount: 2,
      medianMs,
      meanMs,
      minMs,
      maxMs,
      spreadMs: maxMs - minMs,
      standardDeviationMs: stdDevMs,
      trials: [],
    });

    it('returns "no-difference" when medians are equivalent within equivalence threshold', () => {
      // Baseline: 100.0ms, Candidate: 100.5ms (+0.5% change, within 2.0% threshold)
      const baseline = createDist(100.0, 100.0, 99.0, 101.0, 0.8);
      const candidate = createDist(100.5, 100.5, 99.5, 101.5, 0.7);

      const result = assessComparisonUncertainty(baseline, candidate, {
        equivalenceThresholdPct: 2.0,
      });

      expect(result.verdict).toBe('no-difference');
      expect(result.deltaMedianPercent).toBe(0.5);
    });

    it('returns "improved" when candidate is faster and difference exceeds noise floor', () => {
      // Baseline: 420ms (spread 15ms), Candidate: 15ms (spread 2ms)
      const baseline = createDist(420.0, 421.0, 410.0, 425.0, 6.0);
      const candidate = createDist(15.0, 15.2, 14.0, 16.0, 0.8);

      const result = assessComparisonUncertainty(baseline, candidate);

      expect(result.verdict).toBe('improved');
      expect(result.deltaMedianMs).toBe(-405);
      expect(result.deltaMedianPercent).toBe(-96.43);
      expect(result.verdictReason).toMatch(/reduced median duration/i);
    });

    it('returns "regressed" when candidate is slower and difference exceeds noise floor', () => {
      // Baseline: 15ms, Candidate: 45ms
      const baseline = createDist(15.0, 15.2, 14.0, 16.0, 0.8);
      const candidate = createDist(45.0, 45.1, 43.0, 47.0, 1.5);

      const result = assessComparisonUncertainty(baseline, candidate);

      expect(result.verdict).toBe('regressed');
      expect(result.deltaMedianMs).toBe(30);
      expect(result.deltaMedianPercent).toBe(200);
      expect(result.verdictReason).toMatch(/increased median duration/i);
    });

    it('returns "inconclusive" when median difference is smaller than measurement noise and ranges overlap', () => {
      // Baseline: 20ms with wide spread [15ms, 25ms], stdDev 3.5ms
      // Candidate: 18.5ms with wide spread [14ms, 24ms], stdDev 3.2ms
      // Delta: -1.5ms (-7.5%), but combined noise threshold is ~3.2ms and distributions overlap substantially
      const baseline = createDist(20.0, 20.0, 15.0, 25.0, 3.5);
      const candidate = createDist(18.5, 18.5, 14.0, 24.0, 3.2);

      const result = assessComparisonUncertainty(baseline, candidate);

      expect(result.verdict).toBe('inconclusive');
      expect(result.isOverlapping).toBe(true);
      expect(result.verdictReason).toMatch(/within measurement uncertainty/i);
    });

    it('returns "invalid" if distributions contain zero measured samples', () => {
      const invalidDist: BenchmarkDistribution = {
        sampleCount: 0,
        warmupCount: 0,
        medianMs: 0,
        meanMs: 0,
        minMs: 0,
        maxMs: 0,
        spreadMs: 0,
        standardDeviationMs: 0,
        trials: [],
      };
      const validDist = createDist(10, 10, 8, 12, 1);

      const result = assessComparisonUncertainty(invalidDist, validDist);
      expect(result.verdict).toBe('invalid');
    });
  });
});
