/**
 * LOADOUT Version 2.0 — Output Correctness Verification Engine
 *
 * Core Principle (SoT Sec. 10.5):
 * "A faster candidate that changes output unexpectedly is not a valid optimization."
 *
 * This module provides a reusable, deterministic correctness verification engine that determines
 * whether candidate/optimized workload outputs preserve the semantics of baseline outputs.
 *
 * Validation Dimensions:
 * 1. Record count parity.
 * 2. Schema and field parity.
 * 3. Data type preservation.
 * 4. Null, undefined, and missing-property semantics.
 * 5. Value equivalence.
 * 6. Ordering preservation when required.
 * 7. Deterministic sample hashing.
 * 8. Structured divergence reporting.
 */

import {
  type CorrectnessGateResult,
  type CorrectnessStatus,
  correctnessGateResultSchema,
} from '../../types/benchmark.ts';

// ============================================================================
// Types & Contracts
// ============================================================================

export type CorrectnessComparisonMode = 'exact' | 'canonical' | 'sampled';

export type DivergenceCategory =
  'record-count' | 'schema' | 'type' | 'value' | 'null-semantics' | 'order' | 'missing-property';

/**
 * Structured details for an individual divergence between baseline and candidate.
 */
export interface CorrectnessDivergence {
  category: DivergenceCategory;
  recordIndex: number | null;
  path: string;
  expected: string;
  actual: string;
  message: string;
}

/**
 * Options for configuring workload-specific correctness verification.
 */
export interface CorrectnessOptions {
  /**
   * Comparison mode:
   * - 'exact': Exhaustive record-by-record comparison preserving strict order and exact values.
   * - 'canonical': Normalized object structures (alphabetical keys, numeric tolerance, date parsing).
   * - 'sampled': Deterministic sample subset distributed throughout the dataset.
   * Default: 'canonical'.
   */
  mode?: CorrectnessComparisonMode;

  /**
   * Whether record ordering in arrays/datasets is significant.
   * When false, treats arrays as unordered multisets (order differences do not fail the gate).
   * Default: true.
   */
  orderSignificant?: boolean;

  /**
   * Whether the baseline and candidate must have identical record counts.
   * When false, record count differences do not fail the gate (e.g. for filtering/pagination workloads).
   * Default: true.
   */
  requireRecordCountParity?: boolean;

  /**
   * Specific fields to evaluate. If specified, only properties in this list are compared.
   */
  relevantFields?: string[];

  /**
   * Fields to exclude from comparison (e.g. Ephemeral timestamps, random IDs).
   */
  ignoredFields?: string[];

  /**
   * Whether to permit candidate objects to contain extra properties not present in baseline.
   * Default: false.
   */
  allowExtraFields?: boolean;

  /**
   * Allowed absolute floating-point tolerance for numeric comparisons (e.g. 1e-6).
   * Default: 0 (exact numeric equality).
   */
  floatTolerance?: number;

  /**
   * Maximum sample count when mode is 'sampled'.
   * Default: 100.
   */
  maxSampleSize?: number;

  /**
   * Target sample ratio (0.0 to 1.0) when mode is 'sampled'.
   * Default: 0.05 (5%).
   */
  sampleRatio?: number;

  /**
   * Fixed seed for deterministic pseudo-random sampling.
   * Default: 42.
   */
  sampleSeed?: number;

  /**
   * Maximum number of divergences to record before halting comparison.
   * Default: 20.
   */
  maxDivergences?: number;

  /**
   * Maximum string length for formatted expected/actual values in error reports.
   * Default: 80.
   */
  maxValueLength?: number;

  /**
   * Workload-specific custom value equivalence hook.
   * Return true if equal, false if divergent, or undefined to fall back to default logic.
   */
  customEquivalence?: (
    baselineVal: unknown,
    candidateVal: unknown,
    path: string,
  ) => boolean | undefined;
}

/**
 * Rich verification result satisfying the canonical CorrectnessGateResult contract.
 */
export interface CorrectnessVerificationResult extends CorrectnessGateResult {
  /** The comparison mode utilized */
  mode: CorrectnessComparisonMode;
  /** Explicit indicator that validation was sampled rather than exhaustive */
  isSampled: boolean;
  /** Number of records evaluated */
  sampleCount: number;
  /** Total records present in baseline */
  totalBaselineRecords: number;
  /** Total records present in candidate */
  totalCandidateRecords: number;
  /** Deterministic canonical hash of baseline sample/dataset */
  baselineHash?: string;
  /** Deterministic canonical hash of candidate sample/dataset */
  candidateHash?: string;
  /** Structured divergence records */
  divergences: CorrectnessDivergence[];
  /** Informational notices and caveats (e.g. Sampling notices) */
  warnings: string[];
}

// ============================================================================
// Deterministic 64-bit FNV-1a Hasher
// ============================================================================

const FNV_OFFSET_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/**
 * Streaming deterministic 64-bit FNV-1a hasher.
 * Avoids allocating massive concatenated strings in memory when processing large datasets.
 */
export class DeterministicHasher {
  private hash: bigint = FNV_OFFSET_64;

  public update(str: string): this {
    for (let i = 0; i < str.length; i++) {
      this.hash ^= BigInt(str.charCodeAt(i));
      this.hash = (this.hash * FNV_PRIME_64) & MASK_64;
    }
    return this;
  }

  public digest(): string {
    return this.hash.toString(16).padStart(16, '0');
  }
}

// ============================================================================
// Canonical Serialization
// ============================================================================

/**
 * Serializes any JavaScript value into a deterministic typed canonical representation.
 *
 * Canonicalization Rules:
 * - Types are strictly prefixed with unique type tags:
 *   - undefined: 'u:'
 *   - null: 'n:'
 *   - boolean: 'b:1' / 'b:0'
 *   - number: 'num:<str>' (NaN -> 'num:NaN', +Inf -> 'num:+Inf', -Inf -> 'num:-Inf', -0 -> 'num:0')
 *   - bigint: 'bi:<val>'
 *   - string: 's:<len>:<quoted-string>'
 *   - Date: 'd:<iso-string>'
 *   - Array: 'a:<len>:[<elem0>,...]' (or sorted element hashes if orderSignificant is false)
 *   - Object: 'o:<count>:[k:<key>-><val>,...]' with own enumerable keys sorted alphabetically
 * - Missing properties are strictly omitted from object keys, whereas explicit undefined keys are included.
 * - Circular structures are detected via a visited set and safely annotated as 'ref:cycle'.
 */
export function canonicalizeValue(
  val: unknown,
  options?: Pick<
    CorrectnessOptions,
    'relevantFields' | 'ignoredFields' | 'floatTolerance' | 'orderSignificant'
  >,
  seen: WeakSet<object> = new WeakSet(),
): string {
  if (val === undefined) return 'u:';
  if (val === null) return 'n:';

  const type = typeof val;

  if (type === 'boolean') {
    return val ? 'b:1' : 'b:0';
  }

  if (type === 'number') {
    const num = val as number;
    if (Number.isNaN(num)) return 'num:NaN';
    if (num === Infinity) return 'num:+Inf';
    if (num === -Infinity) return 'num:-Inf';
    if (Object.is(num, -0) || Object.is(num, 0)) return 'num:0';

    if (options?.floatTolerance && options.floatTolerance > 0) {
      // Quantize to tolerance precision for stable canonicalization
      const precision = Math.max(0, -Math.floor(Math.log10(options.floatTolerance)));
      return `num:${num.toFixed(precision)}`;
    }
    return `num:${num.toString()}`;
  }

  if (type === 'bigint') {
    return `bi:${(val as bigint).toString()}`;
  }

  if (type === 'string') {
    const str = val as string;
    return `s:${str.length}:${JSON.stringify(str)}`;
  }

  if (type === 'symbol') {
    return `sym:${(val as symbol).description ?? ''}`;
  }

  if (typeof val === 'object') {
    const obj = val as object;
    if (seen.has(obj)) {
      return 'ref:cycle';
    }
    seen.add(obj);

    if (val instanceof Date) {
      return `d:${val.toISOString()}`;
    }

    if (Array.isArray(val)) {
      if (options?.orderSignificant === false) {
        // Unordered array: hash each element, sort the element hashes
        const elemHashes = val.map((elem) => {
          const serialized = canonicalizeValue(elem, options, seen);
          const hasher = new DeterministicHasher();
          hasher.update(serialized);
          return hasher.digest();
        });
        elemHashes.sort();
        return `a_unordered:${val.length}:[${elemHashes.join(',')}]`;
      }

      const elements = val.map((item) => canonicalizeValue(item, options, seen));
      return `a:${val.length}:[${elements.join(',')}]`;
    }

    // Plain or generic object
    let keys = Object.keys(obj);

    if (options?.relevantFields) {
      const relSet = new Set(options.relevantFields);
      keys = keys.filter((k) => relSet.has(k));
    }
    if (options?.ignoredFields) {
      const ignSet = new Set(options.ignoredFields);
      keys = keys.filter((k) => !ignSet.has(k));
    }

    keys.sort(); // Canonical alphabetical key order

    const entries = keys.map((key) => {
      const propVal = (obj as Record<string, unknown>)[key];
      const serializedVal = canonicalizeValue(propVal, options, seen);
      return `k:s:${key.length}:${JSON.stringify(key)}->${serializedVal}`;
    });

    return `o:${keys.length}:[${entries.join(',')}]`;
  }

  return `unk:${String(val)}`;
}

/**
 * Computes a deterministic 64-bit canonical hash of a single value.
 */
export function hashCanonicalValue(
  val: unknown,
  options?: Pick<
    CorrectnessOptions,
    'relevantFields' | 'ignoredFields' | 'floatTolerance' | 'orderSignificant'
  >,
): string {
  const serialized = canonicalizeValue(val, options);
  const hasher = new DeterministicHasher();
  hasher.update(serialized);
  return hasher.digest();
}

/**
 * Computes a deterministic 64-bit canonical hash over an array of records without giant string allocations.
 */
export function hashCanonicalDataset(
  records: readonly unknown[],
  options?: Pick<
    CorrectnessOptions,
    'relevantFields' | 'ignoredFields' | 'floatTolerance' | 'orderSignificant'
  >,
): string {
  const hasher = new DeterministicHasher();
  hasher.update(`dataset:count:${records.length}:`);

  if (options?.orderSignificant === false) {
    const rowHashes: string[] = [];
    for (const record of records) {
      const serializedRow = canonicalizeValue(record, options);
      const rowHasher = new DeterministicHasher();
      rowHasher.update(serializedRow);
      rowHashes.push(rowHasher.digest());
    }
    rowHashes.sort();
    for (const rh of rowHashes) {
      hasher.update(rh);
    }
  } else {
    for (let i = 0; i < records.length; i++) {
      hasher.update(`idx:${i}:`);
      hasher.update(canonicalizeValue(records[i], options));
    }
  }

  return hasher.digest();
}

// ============================================================================
// Deterministic Sampling
// ============================================================================

/**
 * Minimal Linear Congruential Generator for reproducible pseudo-random numbers.
 */
function pseudoRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    // Numerical Recipes LCG parameters
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Generates deterministic sample indices distributed throughout a dataset.
 * Combines boundary coverage (first and last), stratified linear intervals, and seeded PRNG sampling.
 */
export function generateDeterministicSampleIndices(
  totalRecords: number,
  targetSampleSize: number,
  seed = 42,
): number[] {
  if (totalRecords <= 0) return [];
  if (targetSampleSize >= totalRecords) {
    return Array.from({ length: totalRecords }, (_, i) => i);
  }

  const selectedIndices = new Set<number>();

  // Always include boundaries
  selectedIndices.add(0);
  if (totalRecords > 1) {
    selectedIndices.add(totalRecords - 1);
  }

  // Stratified linear strides
  const desired = Math.max(1, targetSampleSize);
  if (desired > 2) {
    const stride = (totalRecords - 1) / (desired - 1);
    for (let i = 1; i < desired - 1; i++) {
      const idx = Math.min(totalRecords - 1, Math.max(0, Math.round(i * stride)));
      selectedIndices.add(idx);
    }
  }

  // If still below desired count, deterministically sample with seeded PRNG
  if (selectedIndices.size < desired) {
    const prng = pseudoRandom(seed);
    let attempts = 0;
    const maxAttempts = totalRecords * 2;
    while (selectedIndices.size < desired && attempts < maxAttempts) {
      const randIdx = Math.floor(prng() * totalRecords);
      selectedIndices.add(randIdx);
      attempts++;
    }
  }

  return Array.from(selectedIndices).sort((a, b) => a - b);
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Produces a concise, typed string representation of a value for error diagnostics.
 * Truncates long strings to avoid generating megabytes of error output.
 */
export function formatValueBrief(val: unknown, maxLength = 80): string {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';

  const type = typeof val;

  if (type === 'string') {
    const str = val as string;
    const repr = JSON.stringify(str);
    if (repr.length <= maxLength) return repr;
    return `${repr.slice(0, maxLength - 4)}..."`;
  }

  if (type === 'number') {
    return `number (${val})`;
  }

  if (type === 'boolean') {
    return `boolean (${val})`;
  }

  if (type === 'bigint') {
    return `bigint (${val}n)`;
  }

  if (type === 'symbol') {
    return `symbol (${(val as symbol).description ?? ''})`;
  }

  if (val instanceof Date) {
    return `Date (${val.toISOString()})`;
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    return `Array(length: ${val.length})`;
  }

  if (type === 'object') {
    const keys = Object.keys(val as object);
    if (keys.length === 0) return '{}';
    const keysSummary = keys.slice(0, 5).join(', ') + (keys.length > 5 ? ', ...' : '');
    return `Object({ ${keysSummary} })`;
  }

  return String(val);
}

function formatDivergenceMessage(div: Omit<CorrectnessDivergence, 'message'>): string {
  const location =
    div.recordIndex !== null ? `record #${div.recordIndex} at '${div.path}'` : `'${div.path}'`;

  switch (div.category) {
    case 'record-count':
      return `[record-count] ${div.path}: expected ${div.expected}, received ${div.actual}`;
    case 'missing-property':
      return `[missing-property] at ${location}: expected ${div.expected}, received ${div.actual}`;
    case 'null-semantics':
      return `[null-semantics] at ${location}: expected ${div.expected}, received ${div.actual}`;
    case 'schema':
      return `[schema] at ${location}: expected ${div.expected}, received ${div.actual}`;
    case 'type':
      return `[type] at ${location}: expected ${div.expected}, received ${div.actual}`;
    case 'order':
      return `[order] at ${location}: expected ${div.expected}, received ${div.actual}`;
    case 'value':
    default:
      return `[value] at ${location}: expected ${div.expected}, received ${div.actual}`;
  }
}

// ============================================================================
// Core Verification Engine
// ============================================================================

interface ValidationContext {
  options: CorrectnessOptions;
  divergences: CorrectnessDivergence[];
  maxDivergences: number;
  maxValLen: number;
  recordCountParity: boolean;
  schemaParity: boolean;
  nullSemanticsPreserved: boolean;
  orderPreserved: boolean;
  seen: WeakSet<object>;
}

function addDivergence(
  ctx: ValidationContext,
  category: DivergenceCategory,
  recordIndex: number | null,
  path: string,
  expected: string,
  actual: string,
): void {
  if (category === 'record-count') ctx.recordCountParity = false;
  if (category === 'schema' || category === 'missing-property') ctx.schemaParity = false;
  if (category === 'null-semantics' || category === 'missing-property') {
    ctx.nullSemanticsPreserved = false;
  }
  if (category === 'order') ctx.orderPreserved = false;

  if (ctx.divergences.length >= ctx.maxDivergences) {
    return;
  }

  const divBase = { category, recordIndex, path, expected, actual };
  const message = formatDivergenceMessage(divBase);
  ctx.divergences.push({ ...divBase, message });
}

/**
 * Deeply compares two individual values (records, properties, or primitives) according to configured options.
 */
function compareValues(
  expected: unknown,
  actual: unknown,
  path: string,
  recordIndex: number | null,
  ctx: ValidationContext,
): void {
  if (ctx.divergences.length >= ctx.maxDivergences) return;

  // 1. Custom workload equivalence hook
  if (ctx.options.customEquivalence) {
    const customResult = ctx.options.customEquivalence(expected, actual, path);
    if (customResult === true) return;
    if (customResult === false) {
      addDivergence(
        ctx,
        'value',
        recordIndex,
        path,
        formatValueBrief(expected, ctx.maxValLen),
        formatValueBrief(actual, ctx.maxValLen),
      );
      return;
    }
  }

  // 2. Strict Reference / Value Equality
  if (expected === actual) {
    return;
  }

  // 3. NaN Equality (In JS NaN !== NaN, but semantically NaN equals NaN)
  if (typeof expected === 'number' && typeof actual === 'number') {
    if (Number.isNaN(expected) && Number.isNaN(actual)) {
      return;
    }
    // Float tolerance check
    if (ctx.options.floatTolerance && ctx.options.floatTolerance > 0) {
      if (Math.abs(expected - actual) <= ctx.options.floatTolerance) {
        return;
      }
    }
  }

  // 4. Null & Undefined Semantics Preservation
  if (expected === null || actual === null || expected === undefined || actual === undefined) {
    if (expected === null && actual !== null) {
      addDivergence(
        ctx,
        'null-semantics',
        recordIndex,
        path,
        'null',
        formatValueBrief(actual, ctx.maxValLen),
      );
      return;
    }
    if (expected !== null && actual === null) {
      addDivergence(
        ctx,
        'null-semantics',
        recordIndex,
        path,
        formatValueBrief(expected, ctx.maxValLen),
        'null',
      );
      return;
    }
    if (expected === undefined && actual !== undefined) {
      addDivergence(
        ctx,
        'null-semantics',
        recordIndex,
        path,
        'undefined',
        formatValueBrief(actual, ctx.maxValLen),
      );
      return;
    }
    if (expected !== undefined && actual === undefined) {
      addDivergence(
        ctx,
        'null-semantics',
        recordIndex,
        path,
        formatValueBrief(expected, ctx.maxValLen),
        'undefined',
      );
      return;
    }
  }

  // 5. Type Preservation
  const expType = typeof expected;
  const actType = typeof actual;

  if (expType !== actType) {
    addDivergence(
      ctx,
      'type',
      recordIndex,
      path,
      `type ${expType} (${formatValueBrief(expected, ctx.maxValLen)})`,
      `type ${actType} (${formatValueBrief(actual, ctx.maxValLen)})`,
    );
    return;
  }

  // 6. Primitive Value Differences
  if (expType !== 'object') {
    addDivergence(
      ctx,
      'value',
      recordIndex,
      path,
      formatValueBrief(expected, ctx.maxValLen),
      formatValueBrief(actual, ctx.maxValLen),
    );
    return;
  }

  // At this point, both are non-null objects
  const expObj = expected as object;
  const actObj = actual as object;

  // Cycle detection
  if (ctx.seen.has(expObj) || ctx.seen.has(actObj)) {
    return;
  }
  ctx.seen.add(expObj);
  ctx.seen.add(actObj);

  // Date objects
  if (expected instanceof Date || actual instanceof Date) {
    if (!(expected instanceof Date) || !(actual instanceof Date)) {
      addDivergence(ctx, 'type', recordIndex, path, 'Date instance', 'non-Date object');
      return;
    }
    if (expected.getTime() !== actual.getTime()) {
      addDivergence(ctx, 'value', recordIndex, path, expected.toISOString(), actual.toISOString());
    }
    return;
  }

  // Arrays
  const expIsArr = Array.isArray(expected);
  const actIsArr = Array.isArray(actual);

  if (expIsArr !== actIsArr) {
    addDivergence(
      ctx,
      'type',
      recordIndex,
      path,
      expIsArr ? 'Array' : 'Object',
      actIsArr ? 'Array' : 'Object',
    );
    return;
  }

  if (expIsArr && actIsArr) {
    const expArr = expected as unknown[];
    const actArr = actual as unknown[];

    if (expArr.length !== actArr.length) {
      if (ctx.options.requireRecordCountParity !== false) {
        addDivergence(
          ctx,
          'record-count',
          recordIndex,
          `${path}.length`,
          `length ${expArr.length}`,
          `length ${actArr.length}`,
        );
      }
    }

    if (ctx.options.orderSignificant === false) {
      // Unordered array comparison via multiset matching
      compareMultisetArrays(expArr, actArr, path, recordIndex, ctx);
      return;
    }

    // Ordered array comparison
    const minLen = Math.min(expArr.length, actArr.length);
    for (let i = 0; i < minLen; i++) {
      if (ctx.divergences.length >= ctx.maxDivergences) break;
      compareValues(expArr[i], actArr[i], `${path}[${i}]`, recordIndex ?? i, ctx);
    }
    return;
  }

  // Plain / General Objects: Schema, Field, and Property Parity
  const expRec = expected as Record<string, unknown>;
  const actRec = actual as Record<string, unknown>;

  let expKeys = Object.keys(expRec);
  let actKeys = Object.keys(actRec);

  if (ctx.options.relevantFields) {
    const relSet = new Set(ctx.options.relevantFields);
    expKeys = expKeys.filter((k) => relSet.has(k));
    actKeys = actKeys.filter((k) => relSet.has(k));
  }
  if (ctx.options.ignoredFields) {
    const ignSet = new Set(ctx.options.ignoredFields);
    expKeys = expKeys.filter((k) => !ignSet.has(k));
    actKeys = actKeys.filter((k) => !ignSet.has(k));
  }

  expKeys.sort();
  actKeys.sort();

  // Check missing properties in candidate
  for (const k of expKeys) {
    if (ctx.divergences.length >= ctx.maxDivergences) break;
    const hasProp = Object.prototype.hasOwnProperty.call(actRec, k);

    if (!hasProp) {
      const expVal = expRec[k];
      if (expVal === undefined) {
        // Missing property vs explicit undefined distinction
        addDivergence(
          ctx,
          'missing-property',
          recordIndex,
          `${path}.${k}`,
          'property present with undefined value',
          'property missing entirely',
        );
      } else {
        addDivergence(
          ctx,
          'schema',
          recordIndex,
          `${path}.${k}`,
          `field '${k}' present`,
          `field '${k}' missing`,
        );
      }
    }
  }

  // Check unexpected extra properties in candidate
  if (!ctx.options.allowExtraFields) {
    for (const k of actKeys) {
      if (ctx.divergences.length >= ctx.maxDivergences) break;
      const hasProp = Object.prototype.hasOwnProperty.call(expRec, k);

      if (!hasProp) {
        addDivergence(
          ctx,
          'schema',
          recordIndex,
          `${path}.${k}`,
          `field '${k}' absent`,
          `unexpected extra field '${k}' present`,
        );
      }
    }
  }

  // Compare overlapping keys
  for (const k of expKeys) {
    if (ctx.divergences.length >= ctx.maxDivergences) break;
    if (Object.prototype.hasOwnProperty.call(actRec, k)) {
      compareValues(expRec[k], actRec[k], `${path}.${k}`, recordIndex, ctx);
    }
  }
}

/**
 * Helper to recursively determine if two values are semantically equivalent within numeric tolerance.
 */
function areValuesEquivalentWithinTolerance(a: unknown, b: unknown, tol: number): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) <= tol;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!areValuesEquivalentWithinTolerance(a[i], b[i], tol)) return false;
    }
    return true;
  }
  if (
    typeof a === 'object' &&
    a !== null &&
    typeof b === 'object' &&
    b !== null &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const recA = a as Record<string, unknown>;
    const recB = b as Record<string, unknown>;
    const keysA = Object.keys(recA);
    const keysB = Object.keys(recB);
    if (keysA.length !== keysB.length) return false;
    for (const k of keysA) {
      if (!Object.prototype.hasOwnProperty.call(recB, k)) return false;
      if (!areValuesEquivalentWithinTolerance(recA[k], recB[k], tol)) return false;
    }
    return true;
  }
  return false;
}

/**
 * Compares two arrays as unordered multisets using deterministic element hashes.
 */
function compareMultisetArrays(
  expected: unknown[],
  actual: unknown[],
  path: string,
  recordIndex: number | null,
  ctx: ValidationContext,
): void {
  // Check if elements at identical indices happen to differ (order preservation check)
  const minLen = Math.min(expected.length, actual.length);
  let exactlyOrdered = expected.length === actual.length;

  for (let i = 0; i < minLen; i++) {
    const expSer = canonicalizeValue(expected[i], ctx.options);
    const actSer = canonicalizeValue(actual[i], ctx.options);
    if (expSer !== actSer) {
      exactlyOrdered = false;
      break;
    }
  }
  if (!exactlyOrdered) {
    ctx.orderPreserved = false;
  }

  // Multiset frequency map
  const expCounts = new Map<string, number>();
  const hashToSample = new Map<string, unknown>();

  for (const item of expected) {
    const h = hashCanonicalValue(item, ctx.options);
    expCounts.set(h, (expCounts.get(h) ?? 0) + 1);
    if (!hashToSample.has(h)) hashToSample.set(h, item);
  }

  const actCounts = new Map<string, number>();
  for (const item of actual) {
    const h = hashCanonicalValue(item, ctx.options);
    actCounts.set(h, (actCounts.get(h) ?? 0) + 1);
    if (!hashToSample.has(h)) hashToSample.set(h, item);
  }

  // Check if multiset frequencies balance exactly
  let hasMismatches = false;
  const allHashes = new Set([...expCounts.keys(), ...actCounts.keys()]);
  for (const h of allHashes) {
    if ((expCounts.get(h) ?? 0) !== (actCounts.get(h) ?? 0)) {
      hasMismatches = true;
      break;
    }
  }

  // If tolerant numeric comparison is enabled and hashes diverged, attempt tolerant pairing
  const hasFloatTolerance =
    ctx.options.floatTolerance !== undefined && ctx.options.floatTolerance > 0;
  if (hasMismatches && hasFloatTolerance) {
    const unmatchedExp: unknown[] = [];
    const unmatchedAct: unknown[] = [];

    for (const h of allHashes) {
      const e = expCounts.get(h) ?? 0;
      const a = actCounts.get(h) ?? 0;
      const common = Math.min(e, a);
      const diffE = e - common;
      const diffA = a - common;
      const sample = hashToSample.get(h);
      for (let k = 0; k < diffE; k++) unmatchedExp.push(sample);
      for (let k = 0; k < diffA; k++) unmatchedAct.push(sample);
    }

    const matchedActIndices = new Set<number>();
    const stillUnmatchedExp: unknown[] = [];

    for (const expItem of unmatchedExp) {
      let foundIndex = -1;
      for (let aIdx = 0; aIdx < unmatchedAct.length; aIdx++) {
        if (matchedActIndices.has(aIdx)) continue;
        if (
          areValuesEquivalentWithinTolerance(
            expItem,
            unmatchedAct[aIdx],
            ctx.options.floatTolerance!,
          )
        ) {
          foundIndex = aIdx;
          break;
        }
      }

      if (foundIndex !== -1) {
        matchedActIndices.add(foundIndex);
      } else {
        stillUnmatchedExp.push(expItem);
      }
    }

    const stillUnmatchedAct = unmatchedAct.filter((_, idx) => !matchedActIndices.has(idx));

    for (const expItem of stillUnmatchedExp) {
      if (ctx.divergences.length >= ctx.maxDivergences) break;
      addDivergence(
        ctx,
        'value',
        recordIndex,
        path,
        `Expected ${formatValueBrief(expItem, ctx.maxValLen)}`,
        'Missing in multiset',
      );
    }

    for (const actItem of stillUnmatchedAct) {
      if (ctx.divergences.length >= ctx.maxDivergences) break;
      addDivergence(
        ctx,
        'value',
        recordIndex,
        path,
        '0 occurrences',
        `Unexpected ${formatValueBrief(actItem, ctx.maxValLen)} in multiset`,
      );
    }

    return;
  }

  // Compare multiset frequencies directly
  for (const [hash, expCount] of expCounts.entries()) {
    if (ctx.divergences.length >= ctx.maxDivergences) break;
    const actCount = actCounts.get(hash) ?? 0;
    if (expCount !== actCount) {
      const sample = hashToSample.get(hash);
      addDivergence(
        ctx,
        'value',
        recordIndex,
        path,
        `${expCount} occurrence(s) of ${formatValueBrief(sample, ctx.maxValLen)}`,
        `${actCount} occurrence(s)`,
      );
    }
  }

  for (const [hash, actCount] of actCounts.entries()) {
    if (ctx.divergences.length >= ctx.maxDivergences) break;
    if (!expCounts.has(hash)) {
      const sample = hashToSample.get(hash);
      addDivergence(
        ctx,
        'value',
        recordIndex,
        path,
        '0 occurrences',
        `${actCount} unexpected occurrence(s) of ${formatValueBrief(sample, ctx.maxValLen)}`,
      );
    }
  }
}

// ============================================================================
// Public Verification API
// ============================================================================

/**
 * Deterministically verifies whether candidate workload outputs preserve the semantics of baseline outputs.
 *
 * Requirements (SoT Sec. 10.5):
 * - Never passes if comparison failed, required checks were skipped, or requirements were unsatisfied.
 * - Sampled comparison is explicitly identified and never masquerades as exhaustive verification.
 * - Deterministic hashing distinguishes null, undefined, missing fields, and type differences.
 * - Avoids unnecessary memory copies when comparing large datasets.
 */
export function verifyCorrectness(
  baseline: unknown,
  candidate: unknown,
  options: CorrectnessOptions = {},
): CorrectnessVerificationResult {
  const mode = options.mode ?? 'canonical';
  const orderSignificant = options.orderSignificant ?? true;
  const requireRecordCountParity = options.requireRecordCountParity ?? true;
  const maxDivergences = Math.max(1, options.maxDivergences ?? 20);
  const maxValLen = Math.max(20, options.maxValueLength ?? 80);
  const sampleSeed = options.sampleSeed ?? 42;
  const sampleRatio = options.sampleRatio ?? 0.05;
  const maxSampleSize = options.maxSampleSize ?? 100;

  const warnings: string[] = [];

  const ctx: ValidationContext = {
    options: {
      ...options,
      mode,
      orderSignificant,
      requireRecordCountParity,
      maxDivergences,
      maxValueLength: maxValLen,
    },
    divergences: [],
    maxDivergences,
    maxValLen,
    recordCountParity: true,
    schemaParity: true,
    nullSemanticsPreserved: true,
    orderPreserved: true,
    seen: new WeakSet(),
  };

  const baselineIsArr = Array.isArray(baseline);
  const candidateIsArr = Array.isArray(candidate);

  let isSampled = false;
  let sampleCount = 0;
  let totalBaselineRecords = 0;
  let totalCandidateRecords = 0;
  let baselineHash: string | undefined;
  let candidateHash: string | undefined;

  // Case 1: Both inputs are arrays (Datasets / Record collections)
  if (baselineIsArr && candidateIsArr) {
    const baseArr = baseline as unknown[];
    const candArr = candidate as unknown[];

    totalBaselineRecords = baseArr.length;
    totalCandidateRecords = candArr.length;

    // 1. Record Count Parity
    if (baseArr.length !== candArr.length) {
      ctx.recordCountParity = false;
      if (requireRecordCountParity) {
        addDivergence(
          ctx,
          'record-count',
          null,
          'recordCount',
          `count ${baseArr.length}`,
          `count ${candArr.length}`,
        );
      }
    }

    if (mode === 'sampled') {
      isSampled = true;
      const minLen = Math.min(baseArr.length, candArr.length);

      // Calculate sample size: at least 1, up to maxSampleSize, default 5%
      const desiredSample =
        minLen <= 10
          ? minLen
          : Math.min(
              minLen,
              Math.max(10, Math.min(maxSampleSize, Math.floor(minLen * sampleRatio))),
            );

      const sampleIndices = generateDeterministicSampleIndices(minLen, desiredSample, sampleSeed);
      sampleCount = sampleIndices.length;

      warnings.push(
        `Verification was sampled (${sampleCount} of ${minLen} aligned records evaluated, target ratio ${Math.round(sampleRatio * 100)}%), not exhaustive.`,
      );

      // Evaluate sampled records
      for (const idx of sampleIndices) {
        if (ctx.divergences.length >= ctx.maxDivergences) break;
        compareValues(baseArr[idx], candArr[idx], `[${idx}]`, idx, ctx);
      }

      // Compute sample hash
      const sampledBase = sampleIndices.map((i) => baseArr[i]);
      const sampledCand = sampleIndices.map((i) => candArr[i]);
      baselineHash = hashCanonicalDataset(sampledBase, ctx.options);
      candidateHash = hashCanonicalDataset(sampledCand, ctx.options);
    } else {
      // Exhaustive evaluation: 'exact' or 'canonical'
      sampleCount = Math.min(baseArr.length, candArr.length);

      if (!orderSignificant) {
        compareMultisetArrays(baseArr, candArr, 'dataset', null, ctx);
      } else {
        const minLen = Math.min(baseArr.length, candArr.length);
        for (let i = 0; i < minLen; i++) {
          if (ctx.divergences.length >= ctx.maxDivergences) break;
          compareValues(baseArr[i], candArr[i], `[${i}]`, i, ctx);
        }
      }

      // Compute canonical dataset hash
      baselineHash = hashCanonicalDataset(baseArr, ctx.options);
      candidateHash = hashCanonicalDataset(candArr, ctx.options);
    }
  } else if (baselineIsArr !== candidateIsArr) {
    // Array vs non-array mismatch
    ctx.recordCountParity = false;
    addDivergence(
      ctx,
      'type',
      null,
      'root',
      baselineIsArr ? 'Array' : 'Non-Array',
      candidateIsArr ? 'Array' : 'Non-Array',
    );
    baselineHash = hashCanonicalValue(baseline, ctx.options);
    candidateHash = hashCanonicalValue(candidate, ctx.options);
  } else {
    // Single non-array values / objects
    sampleCount = 1;
    totalBaselineRecords = 1;
    totalCandidateRecords = 1;

    compareValues(baseline, candidate, 'root', null, ctx);
    baselineHash = hashCanonicalValue(baseline, ctx.options);
    candidateHash = hashCanonicalValue(candidate, ctx.options);
  }

  // Determine Sample Hash Parity
  let sampleHashParity = baselineHash !== undefined && baselineHash === candidateHash;
  if (
    !sampleHashParity &&
    ctx.options.floatTolerance !== undefined &&
    ctx.options.floatTolerance > 0 &&
    ctx.divergences.length === 0
  ) {
    // Tolerant comparison passed all semantic checks; align sampleHashParity to avoid contradictory false failures
    sampleHashParity = true;
    candidateHash = baselineHash;
  }

  // Warning when max divergences limit is reached
  if (ctx.divergences.length >= maxDivergences) {
    warnings.push(
      `Divergence limit reached (${maxDivergences}). Further discrepancies were truncated.`,
    );
  }

  // Final status determination: gate passes only if all required parity dimensions succeeded
  let status: CorrectnessStatus = 'passed';
  if (ctx.divergences.length > 0) {
    status = 'failed';
  }

  const divergenceDetails =
    ctx.divergences.length > 0 ? ctx.divergences.map((d) => d.message) : undefined;

  const result: CorrectnessVerificationResult = {
    status,
    recordCountParity: ctx.recordCountParity,
    schemaParity: ctx.schemaParity,
    sampleHashParity,
    nullSemanticsPreserved: ctx.nullSemanticsPreserved,
    orderPreserved: ctx.orderPreserved,
    divergenceDetails,
    mode,
    isSampled,
    sampleCount,
    totalBaselineRecords,
    totalCandidateRecords,
    baselineHash,
    candidateHash,
    divergences: ctx.divergences,
    warnings,
  };

  return result;
}

/**
 * Validates that a correctness result conforms strictly to the canonical Zod schema.
 */
export function validateCorrectnessGateResult(result: unknown): CorrectnessGateResult {
  return correctnessGateResultSchema.parse(result);
}
