import { describe, it, expect, beforeEach } from 'vitest';
import { generateSyntheticDataset, SYNTHETIC_PRESETS } from '../lib/dataset/synthetic';
import { parseDatasetRows } from '../lib/dataset/parser';
import { runDatasetComparisonSuite } from '../lib/benchmark/workloads/dataset-benchmark-suite';
import {
  saveSession,
  loadSession,
  saveBenchmarkResult,
  getBenchmarkResult,
} from '../lib/storage/session-store';
import { createMemoryStorage, setStorageAdapter } from '../lib/storage/db';
import { OfflineAIProvider } from '../lib/ai/providers';
import { PrivacyGateway } from '../lib/ai/privacy-gateway';
import type { WorkbenchSession } from '../types/storage';

describe('LOADOUT Version 2.0 — End-to-End Workbench Pipeline Lifecycle', () => {
  beforeEach(() => {
    setStorageAdapter(createMemoryStorage());
  });

  it('executes full pipeline: Intake -> Profile -> Benchmark -> Gate -> Persist -> AI Interpret', async () => {
    // 1. INTAKE: Generate sample dataset
    const preset = SYNTHETIC_PRESETS[0]!;
    const dataset = generateSyntheticDataset(preset);
    expect(dataset.name).toBe('events-10k.csv');
    expect(dataset.rawText.length).toBeGreaterThan(0);

    const parsed = parseDatasetRows(dataset, 100);

    // 2. BENCHMARK SUITE: Execute controlled baseline vs candidate run
    const benchmarkRecord = await runDatasetComparisonSuite({
      datasetName: dataset.name,
      rows: parsed.rows,
      columns: parsed.columns,
      benchmarkType: 'table-render',
      policy: {
        warmupIterations: 1,
        measuredIterations: 3,
        timeoutMsPerIteration: 3000,
        cooldownMsBetweenIterations: 5,
      },
    });

    // 3. CORRECTNESS GATE: Output validation
    expect(benchmarkRecord.correctness.status).toBe('passed');
    expect(benchmarkRecord.correctness.recordCountParity).toBe(true);
    expect(['improved', 'inconclusive', 'no-difference', 'regressed']).toContain(
      benchmarkRecord.verdict,
    );
    expect(benchmarkRecord.candidate.distribution.sampleCount).toBe(3);

    // 4. PERSISTENCE: Save benchmark result and active session
    await saveBenchmarkResult(benchmarkRecord);
    const savedRecord = await getBenchmarkResult(benchmarkRecord.id);
    expect(savedRecord?.id).toBe(benchmarkRecord.id);
    expect(savedRecord?.verdict).toBe(benchmarkRecord.verdict);

    const session: WorkbenchSession = {
      id: 'active_workbench_session',
      activeView: 'new-analysis',
      activeStep: 'report',
      persistedDataset: dataset,
      config: {
        goal: 'first-render',
        deviceTarget: 'desktop',
        maxMemoryMb: 50,
        localOnly: true,
      },
      activeBenchmarkRecord: benchmarkRecord,
      updatedAt: new Date().toISOString(),
    };
    await saveSession(session);

    // Verify session restoration
    const restoredSession = await loadSession();
    expect(restoredSession?.activeStep).toBe('report');
    expect(restoredSession?.activeBenchmarkRecord?.id).toBe(benchmarkRecord.id);

    // 5. PRIVACY GATEWAY: Sanitize context for AI analysis
    const gateway = new PrivacyGateway('offline');
    const sanitizedContext = gateway.sanitizeContext({
      activeView: 'new-analysis',
      activeStep: 'report',
      config: session.config,
      datasetSummary: {
        name: dataset.name,
        format: dataset.format,
        rowCount: dataset.rowCountEstimate ?? 1000,
        columnCount: 5,
        columns: ['id', 'title', 'price', 'category', 'stock'],
      },
      activeBenchmark: benchmarkRecord,
    });

    // Zero dataset rows allowed
    expect(sanitizedContext).not.toHaveProperty('rows');
    expect(sanitizedContext.benchmarkSummary?.workloadName).toBe(dataset.name);
    expect(sanitizedContext.benchmarkSummary?.verdict).toBe(benchmarkRecord.verdict);

    // 6. AI INTERPRETATION: Local Copilot evaluates verified benchmark
    const copilot = new OfflineAIProvider();
    const aiAnalysis = await copilot.generateResponse(
      'Interpret current benchmark performance and trade-offs',
      sanitizedContext,
    );

    expect(aiAnalysis.content).toContain('Benchmark Technical Evaluation');
    expect(aiAnalysis.content).toContain('VERDICT:');
    expect(aiAnalysis.content).toContain('Statistical Confidence Notice');
    expect(aiAnalysis.citations?.length).toBeGreaterThan(0);
    expect(aiAnalysis.suggestedActions?.length).toBeGreaterThan(0);
  });
});
