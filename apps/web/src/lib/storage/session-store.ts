/**
 * LOADOUT Version 2.0 — Session and Persistence Operations
 *
 * Implements high-level storage workflows:
 * - Active session autosave & restore across reloads.
 * - Historical benchmark results storage with canonical metadata.
 * - Experiment report management (CRUD, export, import).
 * - User safety settings persistence.
 * - Single-click portable data export (JSON bundle) and import with validation.
 */

import { getStorage } from './db.ts';
import type {
  WorkbenchSession,
  WorkbenchSettings,
  ExportBundle,
  ImportSummary,
} from '../../types/storage.ts';
import { DEFAULT_WORKBENCH_SETTINGS, exportBundleSchema } from '../../types/storage.ts';
import type { ExperimentReport } from '../../types/dataset.ts';
import type { BenchmarkComparisonRecord } from '../../types/benchmark.ts';

const ACTIVE_SESSION_ID = 'active_workbench_session';
const SETTINGS_KEY = 'user_workbench_settings';

/**
 * Saves the active workbench session to storage.
 */
export async function saveSession(session: WorkbenchSession): Promise<void> {
  const storage = getStorage();
  const sessionToSave: WorkbenchSession = {
    ...session,
    id: session.id || ACTIVE_SESSION_ID,
    updatedAt: new Date().toISOString(),
  };
  await storage.put('sessions', sessionToSave.id, sessionToSave);
}

/**
 * Loads the active workbench session from storage.
 */
export async function loadSession(id = ACTIVE_SESSION_ID): Promise<WorkbenchSession | null> {
  const storage = getStorage();
  const session = await storage.get<WorkbenchSession>('sessions', id);
  return session ?? null;
}

/**
 * Persists a canonical benchmark comparison record.
 */
export async function saveBenchmarkResult(record: BenchmarkComparisonRecord): Promise<void> {
  const storage = getStorage();
  await storage.put('benchmarkResults', record.id, record);
}

/**
 * Retrieves a benchmark comparison record by its unique identifier.
 */
export async function getBenchmarkResult(
  id: string,
): Promise<BenchmarkComparisonRecord | undefined> {
  const storage = getStorage();
  return await storage.get<BenchmarkComparisonRecord>('benchmarkResults', id);
}

/**
 * Loads all stored benchmark comparison records sorted in reverse chronological order.
 */
export async function getAllBenchmarkResults(): Promise<BenchmarkComparisonRecord[]> {
  const storage = getStorage();
  const results = await storage.getAll<BenchmarkComparisonRecord>('benchmarkResults');
  return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Persists an experiment report.
 */
export async function saveReport(report: ExperimentReport): Promise<void> {
  const storage = getStorage();
  await storage.put('reports', report.id, report);
}

/**
 * Retrieves a single experiment report by ID.
 */
export async function getReport(id: string): Promise<ExperimentReport | undefined> {
  const storage = getStorage();
  return await storage.get<ExperimentReport>('reports', id);
}

/**
 * Loads all saved experiment reports sorted by newest first.
 */
export async function getAllReports(): Promise<ExperimentReport[]> {
  const storage = getStorage();
  const reports = await storage.getAll<ExperimentReport>('reports');
  return reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Deletes an experiment report by ID.
 */
export async function deleteReport(id: string): Promise<void> {
  const storage = getStorage();
  await storage.delete('reports', id);
}

/**
 * Saves user settings and preferences.
 */
export async function saveSettings(settings: WorkbenchSettings): Promise<void> {
  const storage = getStorage();
  const updated: WorkbenchSettings = {
    ...settings,
    updatedAt: new Date().toISOString(),
  };
  await storage.put('settings', SETTINGS_KEY, updated);
}

/**
 * Loads saved user settings with fallback to sensible defaults.
 */
export async function loadSettings(): Promise<WorkbenchSettings> {
  const storage = getStorage();
  const settings = await storage.get<WorkbenchSettings>('settings', SETTINGS_KEY);
  if (!settings) {
    return { ...DEFAULT_WORKBENCH_SETTINGS };
  }
  return {
    ...DEFAULT_WORKBENCH_SETTINGS,
    ...settings,
  };
}

/**
 * Packages all stored workbench data into a portable export bundle.
 */
export async function exportWorkbenchData(): Promise<ExportBundle> {
  const storage = getStorage();
  const sessions = await storage.getAll<WorkbenchSession>('sessions');
  const benchmarkResults = await storage.getAll<BenchmarkComparisonRecord>('benchmarkResults');
  const reports = await storage.getAll<ExperimentReport>('reports');
  const settings = await loadSettings();

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    platform: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Environment',
    sessions,
    benchmarkResults,
    reports,
    settings,
  };
}

/**
 * Imports an external data bundle into local storage with Zod schema validation.
 */
export async function importWorkbenchData(bundle: ExportBundle): Promise<ImportSummary> {
  const parseResult = exportBundleSchema.safeParse(bundle);
  if (!parseResult.success) {
    throw new Error(
      `Unsupported or corrupt export bundle format: ${parseResult.error.issues[0]?.message ?? 'Schema mismatch'}`,
    );
  }

  const validBundle = parseResult.data;
  const storage = getStorage();
  let sessionsImported = 0;
  let benchmarkResultsImported = 0;
  let reportsImported = 0;
  let settingsImported = 0;

  if (Array.isArray(validBundle.sessions)) {
    for (const session of validBundle.sessions) {
      if (session && session.id && typeof session.id === 'string') {
        await storage.put('sessions', session.id, session);
        sessionsImported++;
      }
    }
  }

  if (Array.isArray(validBundle.benchmarkResults)) {
    for (const result of validBundle.benchmarkResults) {
      if (result && result.id && typeof result.id === 'string') {
        await storage.put('benchmarkResults', result.id, result);
        benchmarkResultsImported++;
      }
    }
  }

  if (Array.isArray(validBundle.reports)) {
    for (const report of validBundle.reports) {
      if (report && report.id && typeof report.id === 'string') {
        await storage.put('reports', report.id, report);
        reportsImported++;
      }
    }
  }

  if (validBundle.settings) {
    await saveSettings(validBundle.settings);
    settingsImported = 1;
  }

  return {
    sessionsImported,
    benchmarkResultsImported,
    reportsImported,
    settingsImported,
  };
}

/**
 * Clears all stored data from all stores.
 */
export async function purgeAllWorkbenchData(): Promise<void> {
  const storage = getStorage();
  await storage.clearAll();
}
