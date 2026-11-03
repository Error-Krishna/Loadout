import { describe, expect, it } from 'vitest';
import {
  DeterministicHasher,
  canonicalizeValue,
  generateDeterministicSampleIndices,
  hashCanonicalDataset,
  hashCanonicalValue,
  validateCorrectnessGateResult,
  verifyCorrectness,
} from '../lib/benchmark/correctness.ts';
import { correctnessGateResultSchema } from '../types/benchmark.ts';

describe('LOADOUT Correctness Verification Engine (M1-T03)', () => {
  // 1. Identical Arrays
  describe('Identical Datasets', () => {
    it('passes for identical arrays of records', () => {
      const baseline = [
        { id: 1, name: 'Alice', active: true, score: 98.5 },
        { id: 2, name: 'Bob', active: false, score: 72.0 },
      ];
      const candidate = [
        { id: 1, name: 'Alice', active: true, score: 98.5 },
        { id: 2, name: 'Bob', active: false, score: 72.0 },
      ];

      const result = verifyCorrectness(baseline, candidate);

      expect(result.status).toBe('passed');
      expect(result.recordCountParity).toBe(true);
      expect(result.schemaParity).toBe(true);
      expect(result.nullSemanticsPreserved).toBe(true);
      expect(result.orderPreserved).toBe(true);
      expect(result.sampleHashParity).toBe(true);
      expect(result.divergences).toHaveLength(0);
      expect(result.divergenceDetails).toBeUndefined();

      // Ensure output strictly satisfies canonical Zod schema
      expect(() => validateCorrectnessGateResult(result)).not.toThrow();
    });
  });

  // 2. Record Count Parity
  describe('Record Count Parity', () => {
    it('fails when candidate has fewer records than baseline', () => {
      const baseline = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const candidate = [{ id: 1 }, { id: 2 }];

      const result = verifyCorrectness(baseline, candidate);

      expect(result.status).toBe('failed');
      expect(result.recordCountParity).toBe(false);
      expect(result.divergences.some((d) => d.category === 'record-count')).toBe(true);
      expect(result.divergenceDetails?.[0]).toMatch(/record-count/);
    });

    it('fails when candidate has more records than baseline', () => {
      const baseline = [{ id: 1 }];
      const candidate = [{ id: 1 }, { id: 2 }];

      const result = verifyCorrectness(baseline, candidate);

      expect(result.status).toBe('failed');
      expect(result.recordCountParity).toBe(false);
    });

    it('permits count differences when requireRecordCountParity is false', () => {
      const baseline = [1, 2, 3, 4, 5];
      const candidate = [1, 2, 3];

      const result = verifyCorrectness(baseline, candidate, {
        requireRecordCountParity: false,
      });

      // recordCountParity is factually false, but does not cause gate failure
      expect(result.recordCountParity).toBe(false);
      expect(result.divergences.filter((d) => d.category === 'record-count')).toHaveLength(0);
      expect(result.status).toBe('passed');
    });
  });

  // 3. Schema & Field Parity
  describe('Schema and Field Parity', () => {
    it('detects missing fields in candidate records', () => {
      const baseline = [{ id: 1, username: 'alice', role: 'admin' }];
      const candidate = [{ id: 1, username: 'alice' }];

      const result = verifyCorrectness(baseline, candidate);

      expect(result.status).toBe('failed');
      expect(result.schemaParity).toBe(false);
      const div = result.divergences.find((d) => d.category === 'schema');
      expect(div).toBeDefined();
      expect(div?.path).toBe('[0].role');
      expect(div?.actual).toContain('missing');
    });

    it('detects unexpected extra fields in candidate records by default', () => {
      const baseline = [{ id: 1, username: 'alice' }];
      const candidate = [{ id: 1, username: 'alice', extraField: 'unexpected' }];

      const result = verifyCorrectness(baseline, candidate);

      expect(result.status).toBe('failed');
      expect(result.schemaParity).toBe(false);
      const div = result.divergences.find((d) => d.category === 'schema');
      expect(div).toBeDefined();
      expect(div?.path).toBe('[0].extraField');
      expect(div?.actual).toContain('unexpected extra field');
    });

    it('allows extra fields when allowExtraFields is explicitly true', () => {
      const baseline = [{ id: 1, username: 'alice' }];
      const candidate = [{ id: 1, username: 'alice', extraField: 'permitted' }];

      const result = verifyCorrectness(baseline, candidate, { allowExtraFields: true });

      expect(result.status).toBe('passed');
      expect(result.schemaParity).toBe(true);
    });

    it('filters evaluation when relevantFields is configured', () => {
      const baseline = [{ id: 1, username: 'alice', ignoredVal: 100 }];
      const candidate = [{ id: 1, username: 'alice', ignoredVal: 999 }];

      const result = verifyCorrectness(baseline, candidate, {
        relevantFields: ['id', 'username'],
      });

      expect(result.status).toBe('passed');
    });

    it('excludes evaluation when ignoredFields is configured', () => {
      const baseline = [{ id: 1, username: 'alice', timestamp: 1000 }];
      const candidate = [{ id: 1, username: 'alice', timestamp: 2000 }];

      const result = verifyCorrectness(baseline, candidate, {
        ignoredFields: ['timestamp'],
      });

      expect(result.status).toBe('passed');
    });
  });

  // 4. Null, Undefined, and Missing-Property Semantics
  describe('Null, Undefined, and Missing-Property Semantics', () => {
    it('distinguishes null from undefined', () => {
      const baseline = [{ id: 1, middleName: null }];
      const candidate = [{ id: 1, middleName: undefined }];

      const result = verifyCorrectness(baseline, candidate);

      expect(result.status).toBe('failed');
      expect(result.nullSemanticsPreserved).toBe(false);
      const div = result.divergences.find((d) => d.category === 'null-semantics');
      expect(div).toBeDefined();
      expect(div?.path).toBe('[0].middleName');
      expect(div?.expected).toBe('null');
      expect(div?.actual).toBe('undefined');
    });

    it('distinguishes explicit undefined from missing property', () => {
      // baseline has own property 'tag' set to undefined
      const baseline = [{ id: 1, tag: undefined }];
      // candidate does not have 'tag' property at all
      const candidate = [{ id: 1 }];

      expect('tag' in baseline[0]).toBe(true);
      expect('tag' in candidate[0]).toBe(false);

      const result = verifyCorrectness(baseline, candidate);

      expect(result.status).toBe('failed');
      expect(result.nullSemanticsPreserved).toBe(false);
      expect(result.schemaParity).toBe(false);
      const div = result.divergences.find((d) => d.category === 'missing-property');
      expect(div).toBeDefined();
      expect(div?.path).toBe('[0].tag');
    });

    it('distinguishes null from empty string and zero', () => {
      const b1 = [{ val: null }];
      const c1 = [{ val: '' }];
      expect(verifyCorrectness(b1, c1).nullSemanticsPreserved).toBe(false);

      const b2 = [{ val: null }];
      const c2 = [{ val: 0 }];
      expect(verifyCorrectness(b2, c2).nullSemanticsPreserved).toBe(false);
    });
  });

  // 5. Primitive Type Differences
  describe('Primitive Type Differences', () => {
    it('detects string vs number mismatches', () => {
      const baseline = [{ id: 42 }];
      const candidate = [{ id: '42' }];

      const result = verifyCorrectness(baseline, candidate);

      expect(result.status).toBe('failed');
      const div = result.divergences.find((d) => d.category === 'type');
      expect(div).toBeDefined();
      expect(div?.expected).toContain('type number');
      expect(div?.actual).toContain('type string');
    });

    it('detects boolean vs number mismatches', () => {
      const baseline = [{ active: true }];
      const candidate = [{ active: 1 }];

      const result = verifyCorrectness(baseline, candidate);

      expect(result.status).toBe('failed');
      expect(result.divergences.some((d) => d.category === 'type')).toBe(true);
    });

    it('detects Date vs string ISO timestamp mismatches', () => {
      const d = new Date('2026-11-03T00:00:00.000Z');
      const baseline = [{ date: d }];
      const candidate = [{ date: d.toISOString() }];

      const result = verifyCorrectness(baseline, candidate);

      expect(result.status).toBe('failed');
      expect(result.divergences.some((d) => d.category === 'type')).toBe(true);
    });
  });

  // 6. Changed Values
  describe('Changed Values', () => {
    it('detects modified scalar values at exact path', () => {
      const baseline = [{ user: { name: 'Alice', rank: 1 } }];
      const candidate = [{ user: { name: 'Alice', rank: 2 } }];

      const result = verifyCorrectness(baseline, candidate);

      expect(result.status).toBe('failed');
      const div = result.divergences.find((d) => d.category === 'value');
      expect(div).toBeDefined();
      expect(div?.path).toBe('[0].user.rank');
      expect(div?.expected).toBe('number (1)');
      expect(div?.actual).toBe('number (2)');
    });

    it('handles NaN semantic equivalence correctly', () => {
      const baseline = [{ value: NaN }];
      const candidate = [{ value: NaN }];

      const result = verifyCorrectness(baseline, candidate);

      expect(result.status).toBe('passed');
      expect(result.divergences).toHaveLength(0);
    });
  });

  // 7. Ordering Preservation
  describe('Array Ordering Semantics', () => {
    it('fails on reordered array when orderSignificant is true', () => {
      const baseline = [
        { id: 1, val: 'first' },
        { id: 2, val: 'second' },
      ];
      const candidate = [
        { id: 2, val: 'second' },
        { id: 1, val: 'first' },
      ];

      const result = verifyCorrectness(baseline, candidate, { orderSignificant: true });

      expect(result.status).toBe('failed');
      expect(result.sampleHashParity).toBe(false);
    });

    it('passes reordered arrays as unordered multisets when orderSignificant is false', () => {
      const baseline = [
        { id: 1, val: 'first' },
        { id: 2, val: 'second' },
      ];
      const candidate = [
        { id: 2, val: 'second' },
        { id: 1, val: 'first' },
      ];

      const result = verifyCorrectness(baseline, candidate, { orderSignificant: false });

      expect(result.status).toBe('passed');
      // orderPreserved factually records false because iteration order differed
      expect(result.orderPreserved).toBe(false);
      // But unordered multiset hashes match!
      expect(result.sampleHashParity).toBe(true);
      expect(result.divergences).toHaveLength(0);
    });

    it('fails when multiset item frequencies differ in unordered mode', () => {
      const baseline = ['apple', 'apple', 'banana'];
      const candidate = ['apple', 'banana', 'banana'];

      const result = verifyCorrectness(baseline, candidate, { orderSignificant: false });

      expect(result.status).toBe('failed');
      expect(result.divergences.some((d) => d.category === 'value')).toBe(true);
    });
  });

  // 8. Object Key Ordering (Canonical Mode)
  describe('Object Key Ordering', () => {
    it('considers objects with differently ordered keys equivalent in canonical mode', () => {
      const baseline = [{ z: 26, a: 1, m: 13 }];
      const candidate = [{ a: 1, m: 13, z: 26 }];

      const result = verifyCorrectness(baseline, candidate, { mode: 'canonical' });

      expect(result.status).toBe('passed');
      expect(result.schemaParity).toBe(true);
      expect(result.sampleHashParity).toBe(true);
      expect(result.divergences).toHaveLength(0);
    });
  });

  // 9. Nested Objects and Arrays
  describe('Nested Data Structures', () => {
    it('accurately identifies divergence deep within nested structures', () => {
      const baseline = [
        {
          id: 101,
          metadata: {
            tags: ['performance', 'optimization'],
            metrics: { p95: 12.4, p99: 15.6 },
          },
        },
      ];
      const candidate = [
        {
          id: 101,
          metadata: {
            tags: ['performance', 'optimization'],
            metrics: { p95: 12.4, p99: 19.9 },
          },
        },
      ];

      const result = verifyCorrectness(baseline, candidate);

      expect(result.status).toBe('failed');
      const div = result.divergences[0];
      expect(div.path).toBe('[0].metadata.metrics.p99');
      expect(div.expected).toBe('number (15.6)');
      expect(div.actual).toBe('number (19.9)');
    });
  });

  // 10. Empty Datasets
  describe('Empty Datasets', () => {
    it('passes cleanly for empty arrays', () => {
      const result = verifyCorrectness([], []);

      expect(result.status).toBe('passed');
      expect(result.recordCountParity).toBe(true);
      expect(result.schemaParity).toBe(true);
      expect(result.sampleHashParity).toBe(true);
      expect(result.sampleCount).toBe(0);
      expect(result.divergences).toHaveLength(0);
    });
  });

  // 11. Deterministic Hasher Stability & Sensitivity
  describe('Deterministic Hasher (FNV-1a 64-bit)', () => {
    it('supports streaming chunk-by-chunk updates with identical digest', () => {
      const hasher1 = new DeterministicHasher();
      hasher1.update('hello');
      hasher1.update('world');

      const hasher2 = new DeterministicHasher();
      hasher2.update('helloworld');

      expect(hasher1.digest()).toBe(hasher2.digest());
    });

    it('produces stable hashes across multiple invocations', () => {
      const data = [{ a: 1, b: 'test', c: [1, 2, 3] }];

      const hash1 = hashCanonicalDataset(data);
      const hash2 = hashCanonicalDataset(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{16}$/);
    });

    it('changes hash when any value changes', () => {
      const h1 = hashCanonicalDataset([{ id: 1, v: 'alpha' }]);
      const h2 = hashCanonicalDataset([{ id: 1, v: 'beta' }]);

      expect(h1).not.toBe(h2);
    });

    it('distinguishes explicit undefined from missing key in hashing', () => {
      const h1 = hashCanonicalValue({ x: undefined });
      const h2 = hashCanonicalValue({});

      expect(h1).not.toBe(h2);
    });

    it('distinguishes null from undefined in hashing', () => {
      const hNull = hashCanonicalValue({ x: null });
      const hUndef = hashCanonicalValue({ x: undefined });

      expect(hNull).not.toBe(hUndef);
    });

    it('distinguishes different primitive types in hashing', () => {
      const hNum = hashCanonicalValue({ val: 42 });
      const hStr = hashCanonicalValue({ val: '42' });

      expect(hNum).not.toBe(hStr);
    });
  });

  // 12. Floating Point Tolerance
  describe('Floating Point Tolerance', () => {
    it('permits floating point rounding differences within tolerance', () => {
      const baseline = [{ ratio: 0.1 + 0.2 }]; // 0.30000000000000004
      const candidate = [{ ratio: 0.3 }];

      // Strict equality fails
      const strictResult = verifyCorrectness(baseline, candidate, { floatTolerance: 0 });
      expect(strictResult.status).toBe('failed');

      // Tolerance of 1e-9 passes
      const tolResult = verifyCorrectness(baseline, candidate, { floatTolerance: 1e-9 });
      expect(tolResult.status).toBe('passed');
    });
  });

  // 13. Deterministic Sampled Mode
  describe('Deterministic Sampled Mode', () => {
    it('evaluates deterministic sample subset and reports sampled status', () => {
      const size = 500;
      const baseline = Array.from({ length: size }, (_, i) => ({
        id: i,
        val: `item-${i}`,
      }));
      const candidate = Array.from({ length: size }, (_, i) => ({
        id: i,
        val: `item-${i}`,
      }));

      const result = verifyCorrectness(baseline, candidate, {
        mode: 'sampled',
        sampleRatio: 0.05,
      });

      expect(result.status).toBe('passed');
      expect(result.isSampled).toBe(true);
      expect(result.mode).toBe('sampled');
      expect(result.sampleCount).toBeLessThan(size);
      expect(result.sampleCount).toBeGreaterThanOrEqual(10);
      expect(result.totalBaselineRecords).toBe(size);

      // Warning explicitly reports sampled nature
      expect(result.warnings.some((w) => w.includes('Verification was sampled'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('not exhaustive'))).toBe(true);
    });

    it('samples boundaries (first and last elements)', () => {
      const indices = generateDeterministicSampleIndices(100, 10, 42);

      expect(indices[0]).toBe(0);
      expect(indices[indices.length - 1]).toBe(99);
      expect(indices.length).toBe(10);
    });

    it('detects divergence when corrupted record falls on a sampled index', () => {
      const size = 100;
      const baseline = Array.from({ length: size }, (_, i) => ({ id: i }));
      const candidate = Array.from({ length: size }, (_, i) => ({ id: i }));

      // Corrupt boundary index 0 (always sampled)
      candidate[0] = { id: 999999 };

      const result = verifyCorrectness(baseline, candidate, { mode: 'sampled' });

      expect(result.status).toBe('failed');
      expect(result.divergences.some((d) => d.recordIndex === 0)).toBe(true);
    });
  });

  // 14. Custom Equivalence Hook
  describe('Custom Equivalence Hook', () => {
    it('allows workload adapters to define domain-specific equivalence', () => {
      const baseline = [{ code: 'abc' }];
      const candidate = [{ code: 'ABC' }];

      // Case-insensitive equivalence hook
      const result = verifyCorrectness(baseline, candidate, {
        customEquivalence: (b, c, path) => {
          if (path.endsWith('code') && typeof b === 'string' && typeof c === 'string') {
            return b.toLowerCase() === c.toLowerCase();
          }
          return undefined;
        },
      });

      expect(result.status).toBe('passed');
    });
  });

  // 15. Divergence Limiting and Value Truncation
  describe('Divergence Limiting and Formatting', () => {
    it('halts collecting divergences when maxDivergences is reached', () => {
      const baseline = Array.from({ length: 50 }, (_, i) => ({ val: i }));
      const candidate = Array.from({ length: 50 }, (_, i) => ({ val: i + 100 }));

      const result = verifyCorrectness(baseline, candidate, { maxDivergences: 5 });

      expect(result.divergences).toHaveLength(5);
      expect(result.warnings.some((w) => w.includes('Divergence limit reached'))).toBe(true);
    });

    it('truncates excessively long strings in divergence messages', () => {
      const hugeStringA = 'A'.repeat(500);
      const hugeStringB = 'B'.repeat(500);

      const result = verifyCorrectness([{ text: hugeStringA }], [{ text: hugeStringB }], {
        maxValueLength: 40,
      });

      expect(result.status).toBe('failed');
      const div = result.divergences[0];
      expect(div.expected.length).toBeLessThanOrEqual(40);
      expect(div.expected).toContain('..."');
    });
  });

  // 16. Circular References and Edge Inputs
  describe('Defensive Handling and Edge Inputs', () => {
    it('safely handles circular references without infinite recursion', () => {
      const objA: Record<string, unknown> = { id: 1 };
      objA.self = objA;

      const objB: Record<string, unknown> = { id: 1 };
      objB.self = objB;

      expect(() => canonicalizeValue(objA)).not.toThrow();
      const result = verifyCorrectness(objA, objB);
      expect(result.status).toBe('passed');
    });

    it('handles comparing array against non-array', () => {
      const result = verifyCorrectness([{ id: 1 }], 'not-an-array');

      expect(result.status).toBe('failed');
      expect(result.recordCountParity).toBe(false);
      expect(result.divergences.some((d) => d.category === 'type')).toBe(true);
    });

    it('handles single primitive comparisons', () => {
      expect(verifyCorrectness(42, 42).status).toBe('passed');
      expect(verifyCorrectness('hello', 'world').status).toBe('failed');
    });
  });

  // 17. Large Dataset Performance and Memory Check
  describe('Large Dataset Verification', () => {
    it('processes 20,000 records without throwing or leaking memory', () => {
      const count = 20_000;
      const baseline = Array.from({ length: count }, (_, i) => ({
        id: i,
        name: `row-${i}`,
        even: i % 2 === 0,
      }));
      const candidate = Array.from({ length: count }, (_, i) => ({
        id: i,
        name: `row-${i}`,
        even: i % 2 === 0,
      }));

      const start = performance.now();
      const result = verifyCorrectness(baseline, candidate, { mode: 'canonical' });
      const duration = performance.now() - start;

      expect(result.status).toBe('passed');
      expect(result.totalBaselineRecords).toBe(count);
      expect(result.totalCandidateRecords).toBe(count);
      expect(duration).toBeLessThan(2000); // Should finish well under 2 seconds
    });
  });

  // 18. Zod Schema Conformance
  describe('Contract and Schema Compatibility', () => {
    it('strictly satisfies correctnessGateResultSchema', () => {
      const result = verifyCorrectness([{ id: 1 }], [{ id: 1 }]);

      const parsed = correctnessGateResultSchema.parse(result);
      expect(parsed.status).toBe('passed');
      expect(parsed.recordCountParity).toBe(true);
      expect(parsed.schemaParity).toBe(true);
      expect(parsed.nullSemanticsPreserved).toBe(true);
      expect(parsed.sampleHashParity).toBe(true);
    });
  });
});
