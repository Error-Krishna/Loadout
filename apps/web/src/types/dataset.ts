export type DatasetFormat = 'csv' | 'json';

export interface LoadedDataset {
  name: string;
  sizeBytes: number;
  format: DatasetFormat;
  rawText: string;
  isSynthetic: boolean;
  rowCountEstimate?: number;
}

export interface SyntheticPreset {
  id: string;
  label: string;
  description: string;
  rowCount: number;
  format: DatasetFormat;
}

export interface IntakeValidationError {
  title: string;
  message: string;
}

export type InferredType = 'string' | 'number' | 'boolean' | 'date';

export interface ColumnProfile {
  name: string;
  type: InferredType;
  nullCount: number;
  sampleValues: (string | number | boolean | null)[];
}

export type DiagnosticSeverity = 'critical' | 'warning' | 'info';

export interface DiagnosticSignal {
  id: string;
  severity: DiagnosticSeverity;
  title: string;
  description: string;
  metric?: string;
  recommendedTechnique: string;
}

export interface DatasetProfile {
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
  previewRows: Record<string, unknown>[];
  rawSizeBytes: number;
  estimatedHeapBytes: number;
  estimatedDomNodes: number;
  diagnostics: DiagnosticSignal[];
}

export interface RenderBenchmarkMetrics {
  renderDurationMs: number;
  domNodeCount: number;
  visibleRowCount: number;
  totalRowCount: number;
}

export interface FilterWorkerRequest {
  id: number;
  query: string;
  rows: Record<string, unknown>[];
  columns: string[];
}

export interface FilterWorkerResponse {
  id: number;
  filteredIndices: number[];
  durationMs: number;
}

export interface FilterTelemetry {
  executionDurationMs: number;
  mainThreadLockMs: number;
  isWorker: boolean;
  matchesCount: number;
}

export type TableMode = 'baseline' | 'virtualized' | 'chunked';

export interface ProgressiveChunkTelemetry {
  mountedCount: number;
  totalCount: number;
  isComplete: boolean;
  yieldCycles: number;
  initialChunkDurationMs: number;
  totalDurationMs: number;
  chunkSize: number;
}

export type OptimizationGoal = 'first-render' | 'memory' | 'interaction' | 'balanced';
export type DeviceTarget = 'desktop' | 'mobile-constrained';

export interface AnalysisConfiguration {
  goal: OptimizationGoal;
  deviceTarget: DeviceTarget;
  maxMemoryMb: number;
  localOnly: boolean;
}

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  category: 'correctness' | 'accessibility' | 'performance';
}

export interface ExperimentReport {
  id: string;
  timestamp: string;
  workloadName: string;
  workloadFormat: DatasetFormat;
  rowCount: number;
  columnCount: number;
  environment: {
    userAgent: string;
    platform: string;
    date: string;
  };
  baselineMetrics: {
    domNodes: number;
    renderTimeMs: number;
    memoryEstimateMb: number;
  };
  candidateMetrics: {
    domNodes: number;
    renderTimeMs: number;
    technique: string;
  };
  improvementPct: {
    domReduction: number;
    timeReduction: number;
  };
  verifiedTradeoffs: string[];
}
