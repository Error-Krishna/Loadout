/**
 * LOADOUT Version 2.0 — Privacy Gateway
 *
 * Implements strict zero-leakage security boundaries:
 * - Default Private Mode: 100% in-browser offline execution with zero network egress.
 * - Cloud Opt-In Mode: Dataset row content is permanently stripped/redacted.
 *   Only high-level schema metadata (column names, row counts) and canonical benchmark
 *   numbers (distribution medians, DOM counts, speedups) may leave the browser.
 * - Provides full prompt context inspection for transparent user verification.
 */

import type { WorkbenchAIContext, SanitizedAIContext, AIMode } from '../../types/ai.ts';

export class PrivacyGateway {
  private mode: AIMode = 'offline';

  constructor(mode: AIMode = 'offline') {
    this.mode = mode;
  }

  getMode(): AIMode {
    return this.mode;
  }

  setMode(mode: AIMode): void {
    this.mode = mode;
  }

  /**
   * Transforms raw workbench state into a sanitized context suitable for AI consumption.
   * Ensures that ZERO raw dataset rows, personal data, or cell contents are retained.
   */
  sanitizeContext(context: WorkbenchAIContext): SanitizedAIContext {
    const sanitized: SanitizedAIContext = {
      activeView: context.activeView,
      activeStep: context.activeStep,
      config: { ...context.config },
    };

    if (context.datasetSummary) {
      sanitized.datasetSummary = {
        name: context.datasetSummary.name,
        format: context.datasetSummary.format,
        rowCount: context.datasetSummary.rowCount,
        columnCount: context.datasetSummary.columnCount,
        // Only column names, no values
        columns: [...context.datasetSummary.columns],
      };
    }

    if (context.activeBenchmark) {
      const b = context.activeBenchmark;
      sanitized.benchmarkSummary = {
        workloadName: b.workloadName,
        verdict: b.verdict,
        verdictReason: b.verdictReason,
        delta: { ...b.delta },
        baseline: {
          variantLabel: b.baseline.variantLabel,
          medianMs: b.baseline.distribution.medianMs,
          meanMs: b.baseline.distribution.meanMs,
          sampleCount: b.baseline.distribution.sampleCount,
          domNodes: b.baseline.domNodeCount.value,
        },
        candidate: {
          variantLabel: b.candidate.variantLabel,
          medianMs: b.candidate.distribution.medianMs,
          meanMs: b.candidate.distribution.meanMs,
          sampleCount: b.candidate.distribution.sampleCount,
          domNodes: b.candidate.domNodeCount.value,
        },
        correctness: {
          status: b.correctness.status,
          recordCountParity: b.correctness.recordCountParity,
          schemaParity: b.correctness.schemaParity,
          nullSemanticsPreserved: b.correctness.nullSemanticsPreserved,
        },
        warnings: [...b.warnings],
      };
    }

    return sanitized;
  }

  /**
   * Asserts whether a network dispatch is permitted under the active privacy mode.
   * Throws an explicit error if external dispatch is attempted in offline mode.
   */
  assertNetworkDispatchAllowed(): void {
    if (this.mode === 'offline') {
      throw new Error(
        'Privacy Boundary Violation: External network dispatch is forbidden while in Private Mode. Enable Cloud Mode in settings to permit outbound completion requests.',
      );
    }
  }

  /**
   * Generates a human-readable disclosure of what metadata would be shared with an external AI provider.
   */
  getDisclosureSummary(sanitized: SanitizedAIContext): string {
    const parts: string[] = [];
    parts.push(`View: ${sanitized.activeView}`);
    if (sanitized.datasetSummary) {
      parts.push(
        `Dataset Schema: ${sanitized.datasetSummary.rowCount} rows, ${sanitized.datasetSummary.columns.length} columns (Values strictly redacted)`,
      );
    }
    if (sanitized.benchmarkSummary) {
      parts.push(
        `Benchmark Result: ${sanitized.benchmarkSummary.baseline.medianMs}ms -> ${sanitized.benchmarkSummary.candidate.medianMs}ms (${sanitized.benchmarkSummary.verdict})`,
      );
    }
    return parts.join(' | ');
  }
}

export const defaultPrivacyGateway = new PrivacyGateway('offline');
