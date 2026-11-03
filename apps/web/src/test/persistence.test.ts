import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryStorage, setStorageAdapter } from '../lib/storage/db';
import {
  saveSession,
  loadSession,
  saveBenchmarkResult,
  getBenchmarkResult,
  getAllBenchmarkResults,
  saveReport,
  getReport,
  getAllReports,
  deleteReport,
  saveSettings,
  loadSettings,
  exportWorkbenchData,
  importWorkbenchData,
  purgeAllWorkbenchData,
} from '../lib/storage/session-store';
import type { WorkbenchSession, WorkbenchSettings, ExportBundle } from '../types/storage';
import type { BenchmarkComparisonRecord } from '../types/benchmark';
import type { ExperimentReport } from '../types/dataset';

describe('Phase Three: Local Persistence & Storage Engine', () => {
  beforeEach(() => {
    // Reset to an isolated clean memory store for each test
    const memoryAdapter = createMemoryStorage();
    setStorageAdapter(memoryAdapter);
  });

  describe('Session Storage & Restore', () => {
    it('saves and restores the active workbench session', async () => {
      const initial = await loadSession();
      expect(initial).toBeNull();

      const session: WorkbenchSession = {
        id: 'active_workbench_session',
        activeView: 'new-analysis',
        activeStep: 'compare',
        persistedDataset: {
          name: 'users-10k.csv',
          format: 'csv',
          sizeBytes: 102400,
          rawText: 'id,name\n1,Alice',
          isSynthetic: false,
          rowCountEstimate: 10000,
        },
        config: {
          goal: 'first-render',
          deviceTarget: 'desktop',
          maxMemoryMb: 50,
          localOnly: true,
        },
        activeBenchmarkRecord: null,
        updatedAt: new Date().toISOString(),
      };

      await saveSession(session);
      const restored = await loadSession();

      expect(restored).not.toBeNull();
      expect(restored?.activeStep).toBe('compare');
      expect(restored?.persistedDataset?.name).toBe('users-10k.csv');
      expect(restored?.persistedDataset?.rowCountEstimate).toBe(10000);
    });

    it('isolates stored session objects against external mutation', async () => {
      const session: WorkbenchSession = {
        id: 'active_workbench_session',
        activeView: 'new-analysis',
        activeStep: 'profile',
        persistedDataset: null,
        config: {
          goal: 'first-render',
          deviceTarget: 'desktop',
          maxMemoryMb: 50,
          localOnly: true,
        },
        activeBenchmarkRecord: null,
        updatedAt: new Date().toISOString(),
      };

      await saveSession(session);
      const loaded = await loadSession();
      expect(loaded).toBeDefined();

      // Mutate loaded object
      if (loaded) {
        loaded.activeStep = 'report';
      }

      // Re-fetching should still yield original stored value
      const reloaded = await loadSession();
      expect(reloaded?.activeStep).toBe('profile');
    });
  });

  describe('Benchmark Results Persistence', () => {
    it('saves, retrieves, and sorts benchmark comparison records', async () => {
      const dummyRecord1: BenchmarkComparisonRecord = {
        id: 'rec_benchmark_1',
        workloadId: 'dataset-table-render',
        workloadName: 'users.csv',
        workloadFingerprint: 'fingerprint_123',
        createdAt: '2026-11-01T10:00:00.000Z',
        environment: {
          userAgent: 'test-agent',
          platform: 'macOS',
          hardwareConcurrency: 4,
          browserEngine: 'Blink',
          jsRuntime: 'V8',
          capturedAt: '2026-11-01T10:00:00.000Z',
        },
        policy: {
          warmupIterations: 2,
          measuredIterations: 5,
          timeoutMsPerIteration: 5000,
          cooldownMsBetweenIterations: 16,
        },
        baseline: {
          variantId: 'table-naive',
          variantLabel: 'Baseline Naive',
          distribution: {
            sampleCount: 5,
            warmupCount: 2,
            medianMs: 450,
            meanMs: 450,
            minMs: 440,
            maxMs: 460,
            spreadMs: 20,
            standardDeviationMs: 7.9,
            trials: [],
          },
          domNodeCount: { value: 10000, provenance: 'measured', method: 'DOM element count' },
        },
        candidate: {
          variantId: 'table-virtualized',
          variantLabel: 'Candidate Virtualized',
          distribution: {
            sampleCount: 5,
            warmupCount: 2,
            medianMs: 15,
            meanMs: 15,
            minMs: 14,
            maxMs: 16,
            spreadMs: 2,
            standardDeviationMs: 0.7,
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
        verdictReason: 'Candidate demonstrated 30x speedup with verified output.',
        delta: {
          medianDurationMs: -435,
          medianDurationChangePct: -96.7,
          domNodesDelta: -9960,
          domNodesChangePct: -99.6,
        },
        warnings: [],
      };

      const dummyRecord2: BenchmarkComparisonRecord = {
        ...dummyRecord1,
        id: 'rec_benchmark_2',
        createdAt: '2026-11-02T12:00:00.000Z',
      };

      await saveBenchmarkResult(dummyRecord1);
      await saveBenchmarkResult(dummyRecord2);

      const single = await getBenchmarkResult('rec_benchmark_1');
      expect(single?.id).toBe('rec_benchmark_1');
      expect(single?.verdict).toBe('improved');

      const all = await getAllBenchmarkResults();
      expect(all).toHaveLength(2);
      // Sorted reverse chronological (rec_benchmark_2 is newer)
      expect(all[0]?.id).toBe('rec_benchmark_2');
      expect(all[1]?.id).toBe('rec_benchmark_1');
    });
  });

  describe('Experiment Reports Persistence', () => {
    it('supports full CRUD lifecycle for experiment reports', async () => {
      const report: ExperimentReport = {
        id: 'rep_test_001',
        timestamp: '2026-11-03T10:00:00.000Z',
        workloadName: 'telemetry_stream.ndjson',
        workloadFormat: 'ndjson',
        rowCount: 50000,
        columnCount: 8,
        environment: {
          userAgent: 'Test Agent',
          platform: 'macOS',
          date: '2026-11-03',
        },
        baselineMetrics: {
          domNodes: 50000,
          renderTimeMs: 800,
          memoryEstimateMb: 25,
        },
        candidateMetrics: {
          domNodes: 60,
          renderTimeMs: 12,
          technique: 'Windowing + Web Worker',
        },
        improvementPct: {
          domReduction: 99.8,
          timeReduction: 98.5,
        },
        verifiedTradeoffs: ['Tradeoff 1', 'Tradeoff 2'],
      };

      await saveReport(report);

      const fetched = await getReport('rep_test_001');
      expect(fetched).toBeDefined();
      expect(fetched?.workloadName).toBe('telemetry_stream.ndjson');

      const all = await getAllReports();
      expect(all).toHaveLength(1);

      await deleteReport('rep_test_001');
      const afterDelete = await getReport('rep_test_001');
      expect(afterDelete).toBeUndefined();
    });
  });

  describe('Settings & Preferences', () => {
    it('returns default settings if none saved', async () => {
      const settings = await loadSettings();
      expect(settings.workerLimit).toBe(4);
      expect(settings.domCap).toBe(5000);
      expect(settings.aiMode).toBe('disabled');
    });

    it('persists and retrieves updated settings', async () => {
      const customSettings: WorkbenchSettings = {
        workerLimit: 8,
        domCap: 10000,
        memoryWarningMb: 100,
        telemetryOptIn: true,
        aiMode: 'local',
      };

      await saveSettings(customSettings);
      const loaded = await loadSettings();

      expect(loaded.workerLimit).toBe(8);
      expect(loaded.domCap).toBe(10000);
      expect(loaded.telemetryOptIn).toBe(true);
      expect(loaded.aiMode).toBe('local');
    });
  });

  describe('Export, Import & Reset', () => {
    it('exports all workbench data to a portable bundle and restores it', async () => {
      // 1. Seed some data
      const session: WorkbenchSession = {
        id: 'active_workbench_session',
        activeView: 'workloads',
        activeStep: 'input',
        persistedDataset: null,
        config: {
          goal: 'first-render',
          deviceTarget: 'mobile-constrained',
          maxMemoryMb: 30,
          localOnly: true,
        },
        activeBenchmarkRecord: null,
        updatedAt: '2026-11-03T11:00:00.000Z',
      };
      await saveSession(session);

      const report: ExperimentReport = {
        id: 'rep_export_test',
        timestamp: '2026-11-03T11:00:00.000Z',
        workloadName: 'test.csv',
        workloadFormat: 'csv',
        rowCount: 100,
        columnCount: 2,
        environment: {
          userAgent: 'Agent',
          platform: 'macOS',
          date: '2026-11-03',
        },
        baselineMetrics: { domNodes: 100, renderTimeMs: 10, memoryEstimateMb: 1 },
        candidateMetrics: { domNodes: 10, renderTimeMs: 2, technique: 'Virtual' },
        improvementPct: { domReduction: 90, timeReduction: 80 },
        verifiedTradeoffs: [],
      };
      await saveReport(report);

      // 2. Export
      const bundle = await exportWorkbenchData();
      expect(bundle.version).toBe(1);
      expect(bundle.sessions).toHaveLength(1);
      expect(bundle.reports).toHaveLength(1);

      // 3. Purge storage
      await purgeAllWorkbenchData();
      expect(await loadSession()).toBeNull();
      expect(await getAllReports()).toHaveLength(0);

      // 4. Import bundle
      const summary = await importWorkbenchData(bundle);
      expect(summary.sessionsImported).toBe(1);
      expect(summary.reportsImported).toBe(1);

      // 5. Verify restored data
      const restoredSession = await loadSession();
      expect(restoredSession?.activeView).toBe('workloads');

      const restoredReport = await getReport('rep_export_test');
      expect(restoredReport?.workloadName).toBe('test.csv');
    });

    it('rejects invalid or unsupported export bundles on import', async () => {
      const badBundle = {
        version: 99,
        exportedAt: '',
        platform: '',
        sessions: [],
        benchmarkResults: [],
        reports: [],
        settings: {} as WorkbenchSettings,
      } as unknown as ExportBundle;

      await expect(importWorkbenchData(badBundle)).rejects.toThrow(
        /Unsupported or corrupt export bundle/,
      );
    });
  });
});
