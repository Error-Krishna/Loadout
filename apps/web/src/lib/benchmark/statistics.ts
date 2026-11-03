import type {
  BenchmarkTrial,
  BenchmarkDistribution,
  ComparisonVerdict,
} from '../../types/benchmark';

/**
 * Validates a numerical array for statistical analysis.
 * Rejects empty arrays, non-finite numbers (NaN, Infinity), and negative durations.
 *
 * @param values - Array of numerical observations (e.g. durations in milliseconds).
 * @param label - Descriptive name of the input parameter for error messages.
 * @throws Error if values is empty or contains non-finite or negative numbers.
 */
export function validateDurations(values: readonly number[], label = 'values'): void {
  if (!values || values.length === 0) {
    throw new Error(`Invalid input for ${label}: array must not be empty.`);
  }

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      throw new Error(
        `Invalid input for ${label} at index ${i}: value must be a finite number. Received: ${val}`,
      );
    }
    if (val < 0) {
      throw new Error(
        `Invalid input for ${label} at index ${i}: duration must be non-negative. Received: ${val}`,
      );
    }
  }
}

/**
 * Rounds a floating point number to a fixed precision to prevent IEEE-754 display anomalies
 * (e.g. 14.100000000000001 -> 14.1).
 */
export function roundStat(val: number, decimals = 4): number {
  if (!Number.isFinite(val)) return val;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * Calculates the arithmetic mean of an array of durations.
 *
 * Formula: \bar{x} = \frac{1}{N} \sum_{i=1}^N x_i
 */
export function calculateMean(values: readonly number[]): number {
  validateDurations(values, 'calculateMean');
  const sum = values.reduce((acc, v) => acc + v, 0);
  return roundStat(sum / values.length);
}

/**
 * Calculates the median (50th percentile) of an array of durations.
 * Caller's input array is never mutated.
 *
 * - For odd N: middle value at index (N - 1) / 2
 * - For even N: mean of the two middle values at N / 2 - 1 and N / 2
 */
export function calculateMedian(values: readonly number[]): number {
  validateDurations(values, 'calculateMedian');
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);

  if (n % 2 !== 0) {
    return roundStat(sorted[mid]!);
  }
  return roundStat((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/**
 * Returns the minimum and maximum values of an array of durations.
 * Caller's input array is never mutated.
 */
export function calculateMinMax(values: readonly number[]): { min: number; max: number } {
  validateDurations(values, 'calculateMinMax');
  let min = values[0]!;
  let max = values[0]!;

  for (let i = 1; i < values.length; i++) {
    const v = values[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  return { min: roundStat(min), max: roundStat(max) };
}

export function calculateMin(values: readonly number[]): number {
  return calculateMinMax(values).min;
}

export function calculateMax(values: readonly number[]): number {
  return calculateMinMax(values).max;
}

/**
 * Calculates the range/spread (maximum minus minimum) of an array of durations.
 *
 * Formula: spread = max - min
 */
export function calculateSpread(values: readonly number[]): number {
  const { min, max } = calculateMinMax(values);
  return roundStat(max - min);
}

/**
 * Calculates variance of an array of durations.
 *
 * Statistical Convention:
 * - Sample Variance (`isSample = true`, DEFAULT): Uses Bessel's correction (denominator N - 1)
 *   because benchmark trials are finite samples drawn from an infinite population of possible runs.
 *   If N = 1, sample variance is 0.
 * - Population Variance (`isSample = false`): Uses denominator N.
 *
 * @param values - Array of durations
 * @param isSample - Whether to use sample variance (N - 1) or population variance (N)
 */
export function calculateVariance(values: readonly number[], isSample = true): number {
  validateDurations(values, 'calculateVariance');
  const n = values.length;
  if (n === 1) return 0;

  const mean = values.reduce((acc, v) => acc + v, 0) / n;
  const sumSquaredDiff = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
  const divisor = isSample ? n - 1 : n;

  return roundStat(sumSquaredDiff / divisor);
}

/**
 * Calculates standard deviation.
 *
 * Standard deviation is the square root of variance: \sigma = \sqrt{variance}.
 * By default calculates sample standard deviation (Bessel's correction N - 1).
 */
export function calculateStandardDeviation(values: readonly number[], isSample = true): number {
  const variance = calculateVariance(values, isSample);
  return roundStat(Math.sqrt(variance));
}

/**
 * Calculates a percentile using the Hyndman & Fan (1996) Type 7 convention
 * (equivalent to NIST, NumPy/SciPy `method='linear'`, and Excel `PERCENTILE.INC`).
 *
 * Statistical Convention:
 * For sorted array x of length N (0-indexed) and percentile P \in [0, 100]:
 * Rank / index k = (N - 1) * (P / 100)
 * Let i = floor(k) and f = k - i
 * Value = x[i] + f * (x[i + 1] - x[i])
 *
 * Caller's input array is never mutated.
 *
 * @param values - Array of durations
 * @param percentile - Target percentile in range [0, 100]
 */
export function calculatePercentile(values: readonly number[], percentile: number): number {
  validateDurations(values, 'calculatePercentile');

  if (typeof percentile !== 'number' || !Number.isFinite(percentile)) {
    throw new Error(`Percentile must be a finite number. Received: ${percentile}`);
  }
  if (percentile < 0 || percentile > 100) {
    throw new Error(`Percentile must be in the range [0, 100]. Received: ${percentile}`);
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  if (n === 1 || percentile === 0) return roundStat(sorted[0]!);
  if (percentile === 100) return roundStat(sorted[n - 1]!);

  const k = (n - 1) * (percentile / 100);
  const i = Math.floor(k);
  const f = k - i;

  if (i >= n - 1) return roundStat(sorted[n - 1]!);
  if (i < 0) return roundStat(sorted[0]!);

  const interpolated = sorted[i]! + f * (sorted[i + 1]! - sorted[i]!);
  return roundStat(interpolated);
}

export function calculateP95(values: readonly number[]): number {
  return calculatePercentile(values, 95);
}

export function calculateP99(values: readonly number[]): number {
  return calculatePercentile(values, 99);
}

/**
 * Calculates the first (Q1), second (Q2 / median), and third (Q3) quartiles
 * using the Type 7 percentile interpolation convention.
 */
export function calculateQuartiles(values: readonly number[]): {
  q1: number;
  q2: number;
  q3: number;
} {
  return {
    q1: calculatePercentile(values, 25),
    q2: calculatePercentile(values, 50),
    q3: calculatePercentile(values, 75),
  };
}

/**
 * Calculates the Interquartile Range (IQR).
 *
 * Formula: IQR = Q3 - Q1
 */
export function calculateIQR(values: readonly number[]): number {
  const { q1, q3 } = calculateQuartiles(values);
  return roundStat(q3 - q1);
}

/**
 * Detects outliers using the standard Tukey Boxplot Fence criteria.
 *
 * Bounds:
 * - Lower bound = Q1 - k * IQR
 * - Upper bound = Q3 + k * IQR
 * (Default multiplier k = 1.5 for standard outliers)
 *
 * Preserves the original order of items in outliers and cleanValues.
 * Caller's input array is never mutated.
 */
export function detectOutliers(
  values: readonly number[],
  k = 1.5,
): {
  lowerBound: number;
  upperBound: number;
  outliers: number[];
  cleanValues: number[];
} {
  validateDurations(values, 'detectOutliers');
  const { q1, q3 } = calculateQuartiles(values);
  const iqr = q3 - q1;

  const lowerBound = roundStat(q1 - k * iqr);
  const upperBound = roundStat(q3 + k * iqr);

  const outliers: number[] = [];
  const cleanValues: number[] = [];

  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (v < lowerBound || v > upperBound) {
      outliers.push(v);
    } else {
      cleanValues.push(v);
    }
  }

  return {
    lowerBound,
    upperBound,
    outliers,
    cleanValues,
  };
}

/**
 * Evaluates the statistical confidence of a sample size.
 *
 * Benchmark Policy Reality:
 * Quick browser benchmarks default to 5 measured iterations. While sufficient for
 * detecting major regressions or 10x architectural shifts, 5 samples are NOT
 * statistically adequate for estimating tail latencies (P95/P99).
 *
 * Rule of thumb:
 * - P95 estimation requires at least N >= 20 independent trials.
 * - P99 estimation requires at least N >= 100 independent trials.
 */
export interface SampleConfidence {
  sampleCount: number;
  isSmallSample: boolean;
  p95Reliable: boolean;
  p99Reliable: boolean;
  warnings: string[];
}

export function assessSampleConfidence(sampleCount: number): SampleConfidence {
  const warnings: string[] = [];
  const isSmallSample = sampleCount < 20;
  const p95Reliable = sampleCount >= 20;
  const p99Reliable = sampleCount >= 100;

  if (sampleCount < 5) {
    warnings.push(
      `Very small sample size (N=${sampleCount}). Results are vulnerable to single-iteration background noise.`,
    );
  } else if (sampleCount < 20) {
    warnings.push(
      `Sample size (N=${sampleCount}) is sufficient for median estimation, but too small for reliable P95 tail-latency analysis (N>=20 recommended).`,
    );
  }

  if (!p99Reliable) {
    warnings.push(
      `Sample size (N=${sampleCount}) is insufficient for reliable P99 tail-latency analysis (N>=100 recommended).`,
    );
  }

  return {
    sampleCount,
    isSmallSample,
    p95Reliable,
    p99Reliable,
    warnings,
  };
}

/**
 * Aggregates raw benchmark trials into a canonical `BenchmarkDistribution`.
 *
 * Principles:
 * 1. Warm-up trials (`trial.isWarmup === true`) are strictly excluded from statistical measurements.
 * 2. Raw trials array is preserved in its entirety for provenance and reproducibility.
 * 3. Measured sampleCount accurately reflects only the eligible non-warmup trials.
 * 4. P95 and P99 are calculated, but accompanied by explicit small-sample warnings when N < 20 or N < 100.
 *
 * @param trials - All recorded trials (warmup and measured)
 * @throws Error if no measured (non-warmup) trials are provided or if trial durations are invalid.
 */
export function aggregateBenchmarkDistribution(
  trials: readonly BenchmarkTrial[],
): BenchmarkDistribution {
  if (!trials || trials.length === 0) {
    throw new Error('Cannot aggregate distribution: trials array is empty.');
  }

  const warmupTrials = trials.filter((t) => t.isWarmup);
  const measuredTrials = trials.filter((t) => !t.isWarmup);

  if (measuredTrials.length === 0) {
    throw new Error(
      'Cannot aggregate distribution: all provided trials are marked as warmup (zero measured iterations).',
    );
  }

  const durations = measuredTrials.map((t) => t.durationMs);
  validateDurations(durations, 'measured trials duration');

  const { min, max } = calculateMinMax(durations);
  const medianMs = calculateMedian(durations);
  const meanMs = calculateMean(durations);
  const spreadMs = roundStat(max - min);
  const standardDeviationMs = calculateStandardDeviation(durations, true);

  const confidence = assessSampleConfidence(durations.length);

  // Compute tail percentiles using Type 7 interpolation
  const p95Ms = calculateP95(durations);
  const p99Ms = calculateP99(durations);

  return {
    sampleCount: measuredTrials.length,
    warmupCount: warmupTrials.length,
    medianMs,
    meanMs,
    minMs: min,
    maxMs: max,
    spreadMs,
    standardDeviationMs,
    p95Ms,
    p99Ms,
    trials: [...trials], // Caller immutability preserved
    warnings: confidence.warnings.length > 0 ? confidence.warnings : undefined,
  };
}

/**
 * Options for configuring the baseline-versus-candidate comparison uncertainty analysis.
 */
export interface ComparisonAssessmentOptions {
  /**
   * Minimum relative median change percentage to distinguish an effect from equivalence.
   * Default: 2.0 (i.e. +/- 2.0%).
   */
  equivalenceThresholdPct?: number;
  /**
   * Multiplier applied to the combined standard error to establish the noise floor.
   * Default: 1.5.
   */
  noiseMultiplier?: number;
}

/**
 * Transparent evaluation result of comparing a baseline and candidate distribution.
 */
export interface ComparisonAssessmentResult {
  verdict: ComparisonVerdict;
  verdictReason: string;
  deltaMedianMs: number;
  deltaMedianPercent: number;
  noiseThresholdMs: number;
  isOverlapping: boolean;
  warnings: string[];
}

/**
 * Evaluates comparison uncertainty between baseline and candidate distributions.
 *
 * Architectural Principles (SoT Sec. 10.4):
 * - Does not claim statistical significance (avoids misleading p-value dogma on tiny non-normal N=5 samples).
 * - Does not rely on a naive variance comparison alone.
 * - Assesses median shift, percentage change, sample counts, and whether the observed delta
 *   is distinguishable from the combined run-to-run noise floor.
 * - Returns an explicit verdict consistent with `ComparisonVerdict`:
 *   `'improved'` | `'regressed'` | `'no-difference'` | `'inconclusive'` | `'invalid'`
 *
 * Decision Criteria:
 * 1. If either sample count is 0, return `'invalid'`.
 * 2. Calculate delta = candidate.median - baseline.median.
 * 3. Calculate pooled noise threshold based on combined standard error:
 *    SE_diff = \sqrt{ (s_base^2 / N_base) + (s_cand^2 / N_cand) }
 *    noiseThreshold = max(SE_diff * noiseMultiplier, 0.05ms)
 * 4. Check range overlap: [candidate.min, candidate.max] overlaps with [baseline.min, baseline.max].
 * 5. If |deltaPercent| <= equivalenceThresholdPct and noise is low: `'no-difference'`.
 * 6. If |deltaMedian| <= noiseThreshold and ranges overlap heavily: `'inconclusive'`.
 * 7. If candidate is faster (delta < -noiseThreshold): `'improved'`.
 * 8. If candidate is slower (delta > noiseThreshold): `'regressed'`.
 */
export function assessComparisonUncertainty(
  baseline: BenchmarkDistribution,
  candidate: BenchmarkDistribution,
  options: ComparisonAssessmentOptions = {},
): ComparisonAssessmentResult {
  const { equivalenceThresholdPct = 2.0, noiseMultiplier = 1.5 } = options;
  const warnings: string[] = [];

  // 1. Validation
  if (
    !baseline ||
    !candidate ||
    baseline.sampleCount === 0 ||
    candidate.sampleCount === 0 ||
    !Number.isFinite(baseline.medianMs) ||
    !Number.isFinite(candidate.medianMs)
  ) {
    return {
      verdict: 'invalid',
      verdictReason:
        'Comparison is invalid: baseline or candidate has zero valid measured samples.',
      deltaMedianMs: 0,
      deltaMedianPercent: 0,
      noiseThresholdMs: 0,
      isOverlapping: false,
      warnings: ['Invalid or empty distribution provided for comparison.'],
    };
  }

  // 2. Compute Medians & Deltas
  const deltaMedianMs = roundStat(candidate.medianMs - baseline.medianMs);
  const deltaMedianPercent =
    baseline.medianMs > 0 ? roundStat((deltaMedianMs / baseline.medianMs) * 100, 2) : 0;

  // 3. Compute Measurement Noise & Combined Standard Error
  const semBase =
    baseline.sampleCount > 1
      ? baseline.standardDeviationMs / Math.sqrt(baseline.sampleCount)
      : baseline.spreadMs / 2;
  const semCand =
    candidate.sampleCount > 1
      ? candidate.standardDeviationMs / Math.sqrt(candidate.sampleCount)
      : candidate.spreadMs / 2;

  const combinedStandardError = Math.sqrt(Math.pow(semBase, 2) + Math.pow(semCand, 2));

  // Minimum detectable difference threshold based on noise
  const noiseThresholdMs = roundStat(
    Math.max(combinedStandardError * noiseMultiplier, 0.05), // minimum 50 microseconds browser timer floor
    4,
  );

  // 4. Overlap Check
  const isOverlapping =
    Math.max(baseline.minMs, candidate.minMs) <= Math.min(baseline.maxMs, candidate.maxMs);

  // 5. Gather Environmental / Noise Warnings
  if (baseline.sampleCount < 5 || candidate.sampleCount < 5) {
    warnings.push(
      `Small sample size (baseline N=${baseline.sampleCount}, candidate N=${candidate.sampleCount}). Random system jitter may influence rankings.`,
    );
  }

  if (baseline.spreadMs > baseline.medianMs * 0.4) {
    warnings.push(
      `High baseline run-to-run variability detected (spread ${baseline.spreadMs}ms is ${(
        (baseline.spreadMs / baseline.medianMs) *
        100
      ).toFixed(1)}% of median).`,
    );
  }

  if (candidate.spreadMs > candidate.medianMs * 0.4) {
    warnings.push(
      `High candidate run-to-run variability detected (spread ${candidate.spreadMs}ms is ${(
        (candidate.spreadMs / candidate.medianMs) *
        100
      ).toFixed(1)}% of median).`,
    );
  }

  // Append upstream distribution warnings if present
  if (baseline.warnings) warnings.push(...baseline.warnings);
  if (candidate.warnings) warnings.push(...candidate.warnings);

  // Deduplicate warnings
  const uniqueWarnings = Array.from(new Set(warnings));

  // 6. Verdict Decision Matrix
  const absDeltaMs = Math.abs(deltaMedianMs);
  const absDeltaPct = Math.abs(deltaMedianPercent);

  // Case A: Negligible change within equivalence threshold
  if (absDeltaPct <= equivalenceThresholdPct && absDeltaMs <= noiseThresholdMs) {
    return {
      verdict: 'no-difference',
      verdictReason: `Candidate median duration (${candidate.medianMs}ms) is equivalent to baseline (${baseline.medianMs}ms) within +/-${equivalenceThresholdPct}% threshold.`,
      deltaMedianMs,
      deltaMedianPercent,
      noiseThresholdMs,
      isOverlapping,
      warnings: uniqueWarnings,
    };
  }

  // Case B: Difference is buried inside measurement noise / high run-to-run variability
  if (absDeltaMs <= noiseThresholdMs && isOverlapping) {
    return {
      verdict: 'inconclusive',
      verdictReason: `Observed median difference of ${deltaMedianMs > 0 ? '+' : ''}${deltaMedianMs}ms (${deltaMedianPercent > 0 ? '+' : ''}${deltaMedianPercent}%) is within measurement uncertainty (noise floor: ${noiseThresholdMs}ms). The distributions overlap substantially.`,
      deltaMedianMs,
      deltaMedianPercent,
      noiseThresholdMs,
      isOverlapping,
      warnings: uniqueWarnings,
    };
  }

  // Case C: Definite improvement (candidate faster than baseline)
  if (deltaMedianMs < 0) {
    return {
      verdict: 'improved',
      verdictReason: `Candidate reduced median duration by ${Math.abs(deltaMedianMs)}ms (${Math.abs(deltaMedianPercent)}% faster), exceeding the ${noiseThresholdMs}ms measurement noise threshold.`,
      deltaMedianMs,
      deltaMedianPercent,
      noiseThresholdMs,
      isOverlapping,
      warnings: uniqueWarnings,
    };
  }

  // Case D: Definite regression (candidate slower than baseline)
  return {
    verdict: 'regressed',
    verdictReason: `Candidate increased median duration by ${deltaMedianMs}ms (${deltaMedianPercent}% slower), exceeding the ${noiseThresholdMs}ms measurement noise threshold.`,
    deltaMedianMs,
    deltaMedianPercent,
    noiseThresholdMs,
    isOverlapping,
    warnings: uniqueWarnings,
  };
}
