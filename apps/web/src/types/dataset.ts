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

export type FilterWorkerInboundMessage =
  | { type: 'init'; datasetId: string; rows: Record<string, unknown>[]; columns: string[] }
  | { type: 'filter'; id: number; query: string }
  | { type: 'clear' }
  | { type?: undefined; id: number; query: string; rows: Record<string, unknown>[]; columns: string[] };

export type FilterWorkerOutboundMessage =
  | { type: 'ready'; datasetId: string; rowCount: number }
  | { type: 'filtered'; id: number; filteredIndices: number[]; durationMs: number }
  | { type: 'error'; id?: number; message: string }
  | { type?: undefined; id: number; filteredIndices: number[]; durationMs: number };

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
  dispatchDurationMs?: number;
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

export interface RecommendationCard {
  id: string;
  technique: string;
  category: 'rendering' | 'compute' | 'storage' | 'network';
  fitRationale: string;
  evidence: string;
  score: number; // 0 - 100
  confidence: 'high' | 'medium' | 'low';
  benefits: string[];
  tradeoffs: string[];
  prerequisites: string[];
  complexity: 'low' | 'medium' | 'high';
  isTopPick: boolean;
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
  /** Optional linked canonical benchmark comparison record (Milestone 1) */
  benchmarkComparison?: import('./benchmark').BenchmarkComparisonRecord;
}

export * from './benchmark';
