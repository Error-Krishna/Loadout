/**
 * LOADOUT Version 2.0 — Storage and Persistence Contracts
 *
 * Defines contracts for IndexedDB persistence, session restore,
 * benchmark history, reports, and portable data bundles.
 */

import type { WorkbenchView, AnalysisStep } from './navigation.ts';
import type { AnalysisConfiguration, ExperimentReport, LoadedDataset } from './dataset.ts';
import type { BenchmarkComparisonRecord } from './benchmark.ts';

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
  aiApiKey?: string;
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

export interface ImportSummary {
  sessionsImported: number;
  benchmarkResultsImported: number;
  reportsImported: number;
  settingsImported: number;
}
