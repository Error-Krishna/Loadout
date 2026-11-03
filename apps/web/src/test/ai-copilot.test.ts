import { describe, it, expect } from 'vitest';
import { PrivacyGateway } from '../lib/ai/privacy-gateway';
import { queryKnowledgeBase, createCitations } from '../lib/ai/knowledge';
import { OfflineAIProvider, createAIProvider } from '../lib/ai/providers';
import type { WorkbenchAIContext } from '../types/ai';
import type { BenchmarkComparisonRecord } from '../types/benchmark';

describe('AI Foundation, Privacy Gateway & RAG Copilot (Phases 6-10)', () => {
  describe('Privacy Gateway', () => {
    it('sanitizes context by preserving structural metadata and stripping raw rows', () => {
      const gateway = new PrivacyGateway('offline');

      const rawContext: WorkbenchAIContext = {
        activeView: 'new-analysis',
        activeStep: 'compare',
        config: {
          goal: 'first-render',
          deviceTarget: 'desktop',
          maxMemoryMb: 50,
          localOnly: true,
        },
        datasetSummary: {
          name: 'sensitive_users.csv',
          format: 'csv',
          rowCount: 25000,
          columnCount: 4,
          columns: ['id', 'email', 'ssn', 'salary'],
        },
      };

      const sanitized = gateway.sanitizeContext(rawContext);

      expect(sanitized.activeView).toBe('new-analysis');
      expect(sanitized.datasetSummary?.rowCount).toBe(25000);
      expect(sanitized.datasetSummary?.columns).toEqual(['id', 'email', 'ssn', 'salary']);
      // Ensure no raw row items are present
      expect(sanitized).not.toHaveProperty('rows');
      expect(sanitized).not.toHaveProperty('sampleRows');
    });

    it('blocks outbound network dispatch in default offline Private Mode', () => {
      const gateway = new PrivacyGateway('offline');
      expect(() => gateway.assertNetworkDispatchAllowed()).toThrow(
        /Privacy Boundary Violation: External network dispatch is forbidden/,
      );
    });

    it('permits network dispatch only when explicitly set to cloud-opt-in mode', () => {
      const gateway = new PrivacyGateway('cloud-opt-in');
      expect(() => gateway.assertNetworkDispatchAllowed()).not.toThrow();
    });

    it('generates an accurate disclosure summary of metadata to be shared', () => {
      const gateway = new PrivacyGateway('offline');
      const sanitized = gateway.sanitizeContext({
        activeView: 'new-analysis',
        config: {
          goal: 'first-render',
          deviceTarget: 'desktop',
          maxMemoryMb: 50,
          localOnly: true,
        },
        datasetSummary: {
          name: 'inventory.csv',
          format: 'csv',
          rowCount: 10000,
          columnCount: 3,
          columns: ['sku', 'price', 'quantity'],
        },
      });

      const disclosure = gateway.getDisclosureSummary(sanitized);
      expect(disclosure).toContain('View: new-analysis');
      expect(disclosure).toContain('10000 rows');
      expect(disclosure).toContain('Values strictly redacted');
    });
  });

  describe('Curated RAG Knowledge Base', () => {
    it('retrieves relevant knowledge chunks for performance queries', () => {
      const results = queryKnowledgeBase('DOM virtualization TanStack Virtual', 3);
      expect(results.length).toBeGreaterThan(0);
      const top = results[0]!;
      expect(top.chunk.title).toContain('Virtualization');
      expect(top.chunk.tags).toContain('virtualization');
    });

    it('retrieves Web Worker structured cloning knowledge', () => {
      const results = queryKnowledgeBase('web worker structured cloning overhead postMessage', 2);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.chunk.title).toContain('Worker');
    });

    it('returns empty array for empty or whitespace-only queries', () => {
      expect(queryKnowledgeBase('')).toEqual([]);
      expect(queryKnowledgeBase('   ')).toEqual([]);
    });

    it('creates verifiable citation objects with sourceId, title, and section', () => {
      const results = queryKnowledgeBase('memory leak detached DOM nodes', 1);
      const citations = createCitations(results);

      expect(citations.length).toBe(1);
      expect(citations[0]?.sourceId).toBe('kb_mem_02');
      expect(citations[0]?.title).toBe('Detached DOM Tree Retention');
      expect(citations[0]?.section).toBe('Memory Leaks');
    });
  });

  describe('Offline AI Performance Copilot & Benchmark Interpreter', () => {
    const dummyBenchmarkRecord: BenchmarkComparisonRecord = {
      id: 'rec_benchmark_test',
      workloadId: 'dataset-table-render',
      workloadName: 'customers-25k.csv',
      workloadFingerprint: 'fp_abc123',
      createdAt: '2026-11-03T12:00:00.000Z',
      environment: {
        userAgent: 'Chrome/Desktop Monotonic Benchmark Clock',
        platform: 'macOS',
        browserEngine: 'Blink',
        jsRuntime: 'V8',
        capturedAt: '2026-11-03T12:00:00.000Z',
      },
      policy: {
        warmupIterations: 2,
        measuredIterations: 5,
        timeoutMsPerIteration: 5000,
        cooldownMsBetweenIterations: 16,
      },
      baseline: {
        variantId: 'table-naive',
        variantLabel: 'Baseline (Naive)',
        distribution: {
          sampleCount: 5,
          warmupCount: 2,
          medianMs: 440,
          meanMs: 442,
          minMs: 430,
          maxMs: 455,
          spreadMs: 25,
          standardDeviationMs: 8.5,
          trials: [],
        },
        domNodeCount: { value: 200000, provenance: 'measured', method: 'DOM element count' },
      },
      candidate: {
        variantId: 'table-virtualized',
        variantLabel: 'Candidate (Virtualized)',
        distribution: {
          sampleCount: 5,
          warmupCount: 2,
          medianMs: 12,
          meanMs: 12.4,
          minMs: 11,
          maxMs: 14,
          spreadMs: 3,
          standardDeviationMs: 0.9,
          trials: [],
        },
        domNodeCount: { value: 40, provenance: 'measured', method: 'DOM element count' },
      },
      correctness: {
        status: 'passed',
        recordCountParity: true,
        schemaParity: true,
        nullSemanticsPreserved: true,
      },
      verdict: 'improved',
      verdictReason: 'Candidate demonstrated verified 36x speedup with intact semantics.',
      delta: {
        medianDurationMs: -428,
        medianDurationChangePct: -97.3,
        domNodesDelta: -199960,
        domNodesChangePct: -99.98,
      },
      warnings: ['Small sample size: N=5'],
    };

    it('rigorously interprets active benchmark record with exact metrics', async () => {
      const provider = new OfflineAIProvider();
      const gateway = new PrivacyGateway('offline');
      const sanitized = gateway.sanitizeContext({
        activeView: 'performance-lab',
        config: {
          goal: 'first-render',
          deviceTarget: 'desktop',
          maxMemoryMb: 50,
          localOnly: true,
        },
        activeBenchmark: dummyBenchmarkRecord,
      });

      const response = await provider.generateResponse('Interpret current benchmark results', sanitized);

      expect(response.content).toContain('Benchmark Technical Evaluation');
      expect(response.content).toContain('440 ms');
      expect(response.content).toContain('12 ms');
      expect(response.content).toContain('CONFIRMED SPEEDUP');
      // Verifies small sample warning
      expect(response.content).toContain('Statistical Confidence Notice');
      // Verifies trade-offs
      expect(response.content).toContain('Ctrl+F');
      expect(response.citations?.length).toBeGreaterThan(0);
      expect(response.suggestedActions?.length).toBeGreaterThan(0);
    });

    it('invalidates optimization analysis if correctness gate failed', async () => {
      const corruptedRecord: BenchmarkComparisonRecord = {
        ...dummyBenchmarkRecord,
        verdict: 'invalid',
        correctness: {
          status: 'failed',
          recordCountParity: false,
          schemaParity: false,
          nullSemanticsPreserved: false,
          divergenceDetails: ['Record count mismatch: expected 25000, got 24000'],
        },
      };

      const provider = new OfflineAIProvider();
      const gateway = new PrivacyGateway('offline');
      const sanitized = gateway.sanitizeContext({
        activeView: 'performance-lab',
        config: {
          goal: 'first-render',
          deviceTarget: 'desktop',
          maxMemoryMb: 50,
          localOnly: true,
        },
        activeBenchmark: corruptedRecord,
      });

      const response = await provider.generateResponse('Explain benchmark results', sanitized);

      expect(response.content).toContain('INVALIDATED OPTIMIZATION');
      expect(response.content).toContain('failed the semantic Correctness Gate');
    });

    it('generates a structured controlled experiment plan when requested', async () => {
      const provider = new OfflineAIProvider();
      const gateway = new PrivacyGateway('offline');
      const sanitized = gateway.sanitizeContext({
        activeView: 'new-analysis',
        config: {
          goal: 'first-render',
          deviceTarget: 'desktop',
          maxMemoryMb: 50,
          localOnly: true,
        },
      });

      const response = await provider.generateResponse('Plan an optimization experiment for large tables', sanitized);

      expect(response.content).toContain('Controlled Experiment Plan');
      expect(response.content).toContain('Baseline Variant');
      expect(response.content).toContain('Candidate Variant');
      expect(response.content).toContain('Success Criteria');
      expect(response.suggestedActions?.[0]?.actionType).toBe('run-experiment');
    });
  });

  describe('AI Provider Factory', () => {
    it('creates OfflineAIProvider when mode is offline even if API key is provided', () => {
      const provider = createAIProvider('offline', 'openai', 'sk-mock-key');
      expect(provider.isLocal).toBe(true);
      expect(provider.id).toBe('offline');
    });

    it('creates OpenAIProvider when mode is cloud-opt-in and apiKey is provided', () => {
      const provider = createAIProvider('cloud-opt-in', 'openai', 'sk-test-key-123');
      expect(provider.isLocal).toBe(false);
      expect(provider.id).toBe('openai');
    });

    it('creates GeminiProvider when mode is cloud-opt-in and provider is gemini', () => {
      const provider = createAIProvider('cloud-opt-in', 'gemini', 'gemini-key-123');
      expect(provider.isLocal).toBe(false);
      expect(provider.id).toBe('gemini');
    });
  });
});
