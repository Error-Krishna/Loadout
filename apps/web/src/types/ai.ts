/**
 * LOADOUT Version 2.0 — AI System Contracts
 *
 * "The engineering engine measures. AI interprets."
 *
 * Defines contracts for AI providers, privacy gateway, RAG knowledge base,
 * contextual copilot, experiment planner, and benchmark interpretation.
 */

import type { BenchmarkComparisonRecord, BenchmarkPolicy } from './benchmark.ts';
import type { AnalysisConfiguration } from './dataset.ts';

export type AIMode = 'offline' | 'cloud-opt-in';

export type AIProviderType = 'offline' | 'openai' | 'gemini';

export interface AICitation {
  sourceId: string;
  title: string;
  section: string;
  url?: string;
  excerpt: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: AICitation[];
  suggestedActions?: AISuggestedAction[];
  createdAt: string;
}

export interface AISuggestedAction {
  id: string;
  label: string;
  actionType: 'run-experiment' | 'switch-view' | 'apply-technique' | 'export-report';
  payload?: Record<string, unknown>;
}

export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey?: string;
  model?: string;
  endpoint?: string;
  mode: AIMode;
}

export interface WorkbenchAIContext {
  activeView: string;
  activeStep?: string;
  config: AnalysisConfiguration;
  datasetSummary?: {
    name: string;
    format: string;
    rowCount: number;
    columnCount: number;
    columns: string[];
  };
  activeBenchmark?: BenchmarkComparisonRecord | null;
}

export interface SanitizedAIContext {
  activeView: string;
  activeStep?: string;
  config: AnalysisConfiguration;
  datasetSummary?: {
    name: string;
    format: string;
    rowCount: number;
    columnCount: number;
    columns: string[];
  };
  benchmarkSummary?: {
    workloadName: string;
    verdict: string;
    verdictReason: string;
    delta: {
      medianDurationMs: number;
      medianDurationChangePct: number;
      domNodesDelta: number;
      domNodesChangePct: number;
    };
    baseline: {
      variantLabel: string;
      medianMs: number;
      meanMs: number;
      sampleCount: number;
      domNodes: number;
    };
    candidate: {
      variantLabel: string;
      medianMs: number;
      meanMs: number;
      sampleCount: number;
      domNodes: number;
    };
    correctness: {
      status: string;
      recordCountParity: boolean;
      schemaParity: boolean;
      nullSemanticsPreserved: boolean;
    };
    warnings: string[];
  };
}

export interface OptimizationExperimentPlan {
  id: string;
  title: string;
  hypothesis: string;
  rationale: string;
  baselineVariant: {
    label: string;
    technique: string;
  };
  candidateVariant: {
    label: string;
    technique: string;
  };
  recommendedPolicy: BenchmarkPolicy;
  expectedTradeoffs: string[];
  requiresUserApproval: boolean;
}

export interface KnowledgeDocChunk {
  id: string;
  docId: string;
  title: string;
  section: string;
  tags: string[];
  content: string;
  url?: string;
}
