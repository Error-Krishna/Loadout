/**
 * LOADOUT Version 2.0 — Storage and Persistence Contracts
 *
 * Defines contracts for IndexedDB persistence, session restore,
 * benchmark history, reports, and portable data bundles.
 */

import type { WorkbenchView, AnalysisStep } from './navigation.ts';
import type { AnalysisConfiguration, ExperimentReport, LoadedDataset } from './dataset.ts';
import type { BenchmarkComparisonRecord } from './benchmark.ts';
import { z } from 'zod';

export interface WorkbenchSession {
  id: string; // e.g. 'active_workbench_session'
  activeView: WorkbenchView;
  activeStep: AnalysisStep;
  persistedDataset: LoadedDataset | null;
  config: AnalysisConfiguration;
  activeBenchmarkRecord: BenchmarkComparisonRecord | null;
  updatedAt: string;
}

export interface WorkbenchSettings {
  workerLimit: number;
  domCap: number;
  memoryWarningMb: number;
  telemetryOptIn: boolean;
  aiMode: 'disabled' | 'local' | 'cloud';
  updatedAt?: string;
}

export const DEFAULT_WORKBENCH_SETTINGS: WorkbenchSettings = {
  workerLimit: 4,
  domCap: 5000,
  memoryWarningMb: 50,
  telemetryOptIn: false,
  aiMode: 'disabled',
};

export interface ExportBundle {
  version: 1;
  exportedAt: string;
  platform: string;
  sessions: WorkbenchSession[];
  benchmarkResults: BenchmarkComparisonRecord[];
  reports: ExperimentReport[];
  settings: WorkbenchSettings;
}

export const exportBundleSchema = z.object({
  version: z.literal(1, { message: 'Unsupported bundle version. Only version 1 is supported.' }),
  exportedAt: z.string(),
  platform: z.string().optional(),
  sessions: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  benchmarkResults: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  reports: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  settings: z
    .object({
      workerLimit: z.number().int().min(1).default(4),
      domCap: z.number().int().min(500).default(5000),
      memoryWarningMb: z.number().int().min(10).default(50),
      telemetryOptIn: z.boolean().default(false),
      aiMode: z.enum(['disabled', 'local', 'cloud']).default('disabled'),
      updatedAt: z.string().optional(),
    })
    .optional(),
});

export interface ImportSummary {
  sessionsImported: number;
  benchmarkResultsImported: number;
  reportsImported: number;
  settingsImported: number;
}
