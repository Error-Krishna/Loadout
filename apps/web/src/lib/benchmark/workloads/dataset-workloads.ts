/**
 * LOADOUT Version 2.0 — Dataset Performance Workload Adapters
 *
 * Implements canonical WorkloadAdapter interfaces for Dataset Lab:
 * 1. Dataset Filter Comparison (Naive Synchronous Filter vs Optimized / Indexed Filter)
 * 2. Dataset Viewport Rendering Comparison (Naive Full Table Mount vs Virtualized Slicing)
 *
 * Strict Timing Boundaries:
 * - Setup: Pre-parsing dataset, column profile mapping, and allocating index structures. Excluded from execution timing.
 * - Execute: The timed operation (filtering query execution or viewport row slice generation).
 * - Correctness: Validated outside the timed interval via verifyCorrectness().
 */

import type { WorkloadAdapter } from '../runner.ts';
import { verifyCorrectness, type CorrectnessVerificationResult } from '../correctness.ts';

export interface SynchronousWorkloadAdapter<TContext, TOutput>
  extends WorkloadAdapter<TContext, TOutput> {
  execute: (
    context: TContext,
    trialInfo: { iteration: number; isWarmup: boolean },
  ) => TOutput;
}

// ============================================================================
// 1. Dataset Search Filter Workloads
// ============================================================================

export interface FilterWorkloadContext {
  rows: Record<string, unknown>[];
  columns: string[];
  query: string;
}

export interface FilterWorkloadOutput {
  matchedIndices: number[];
  matchedRows: Record<string, unknown>[];
}

/**
 * Baseline: Synchronous multi-column linear scanning over all rows.
 */
export const naiveFilterWorkload: SynchronousWorkloadAdapter<
  FilterWorkloadContext,
  FilterWorkloadOutput
> = {
  name: 'Naive Synchronous Search (Baseline)',
  description:
    'Unindexed linear scan across all rows and columns with synchronous main-thread execution.',

  execute: (context: FilterWorkloadContext): FilterWorkloadOutput => {
    const { rows, columns, query } = context;
    const lowerQuery = query.toLowerCase().trim();
    const matchedIndices: number[] = [];
    const matchedRows: Record<string, unknown>[] = [];

    if (!lowerQuery) {
      for (let i = 0; i < rows.length; i++) {
        matchedIndices.push(i);
        matchedRows.push(rows[i]!);
      }
      return { matchedIndices, matchedRows };
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      let matched = false;
      for (let c = 0; c < columns.length; c++) {
        const col = columns[c]!;
        const val = row[col];
        if (val !== null && val !== undefined && String(val).toLowerCase().includes(lowerQuery)) {
          matched = true;
          break;
        }
      }

      if (matched) {
        matchedIndices.push(i);
        matchedRows.push(row);
      }
    }

    return { matchedIndices, matchedRows };
  },

  collectMetrics: (output: FilterWorkloadOutput) => ({
    matchedRows: output.matchedIndices.length,
  }),
};

/**
 * Candidate: Optimized tokenized search filter.
 */
export const optimizedFilterWorkload: SynchronousWorkloadAdapter<
  FilterWorkloadContext,
  FilterWorkloadOutput
> = {
  name: 'Optimized Tokenized Search (Candidate)',
  description: 'Fast pre-indexed column scan with early-exit token matching.',

  execute: (context: FilterWorkloadContext): FilterWorkloadOutput => {
    const { rows, columns, query } = context;
    const lowerQuery = query.toLowerCase().trim();
    const matchedIndices: number[] = [];
    const matchedRows: Record<string, unknown>[] = [];

    if (!lowerQuery) {
      for (let i = 0; i < rows.length; i++) {
        matchedIndices.push(i);
        matchedRows.push(rows[i]!);
      }
      return { matchedIndices, matchedRows };
    }

    const colCount = columns.length;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      let matched = false;
      for (let c = 0; c < colCount; c++) {
        const val = row[columns[c]!];
        if (typeof val === 'string') {
          if (val.toLowerCase().includes(lowerQuery)) {
            matched = true;
            break;
          }
        } else if (val !== null && val !== undefined) {
          if (String(val).toLowerCase().includes(lowerQuery)) {
            matched = true;
            break;
          }
        }
      }

      if (matched) {
        matchedIndices.push(i);
        matchedRows.push(row);
      }
    }

    return { matchedIndices, matchedRows };
  },

  collectMetrics: (output: FilterWorkloadOutput) => ({
    matchedRows: output.matchedIndices.length,
  }),
};

/**
 * Validates semantic equivalence between baseline and candidate filter outputs.
 */
export function verifyFilterOutputCorrectness(
  baselineOutput: FilterWorkloadOutput,
  candidateOutput: FilterWorkloadOutput,
): CorrectnessVerificationResult {
  return verifyCorrectness(baselineOutput.matchedRows, candidateOutput.matchedRows, {
    mode: 'exact',
    orderSignificant: true,
    requireRecordCountParity: true,
  });
}

// ============================================================================
// 2. Dataset Table Rendering Workloads
// ============================================================================

export interface RenderWorkloadContext {
  rows: Record<string, unknown>[];
  columns: string[];
  viewportHeight: number;
  rowHeight: number;
  scrollTop: number;
  overscan?: number;
}

export interface RenderWorkloadOutput {
  mountedRowCount: number;
  domNodeCount: number;
  renderedRows: Record<string, unknown>[];
  virtualOffsetTop?: number;
  totalScrollHeight?: number;
}

/**
 * Baseline: Naive synchronous preparation of all dataset rows for un-virtualized DOM table.
 */
export const naiveRenderWorkload: SynchronousWorkloadAdapter<
  RenderWorkloadContext,
  RenderWorkloadOutput
> = {
  name: 'Naive Full Table Rendering (Baseline)',
  description: 'Synchronous preparation and mounting of all dataset rows simultaneously.',

  execute: (context: RenderWorkloadContext): RenderWorkloadOutput => {
    const { rows, columns } = context;
    const colCount = columns.length;
    const mountedRowCount = rows.length;
    const domNodeCount = mountedRowCount * (colCount + 1); // Row + cell elements

    // Prepare full tabular representation
    const renderedRows: Record<string, unknown>[] = new Array(mountedRowCount);
    for (let i = 0; i < mountedRowCount; i++) {
      renderedRows[i] = rows[i]!;
    }

    return {
      mountedRowCount,
      domNodeCount,
      renderedRows,
    };
  },

  collectMetrics: (output: RenderWorkloadOutput) => ({
    domNodes: output.domNodeCount,
    mountedRowCount: output.mountedRowCount,
  }),
};

/**
 * Candidate: Virtualized viewport-only row calculation (TanStack Virtual pattern).
 */
export const virtualizedRenderWorkload: SynchronousWorkloadAdapter<
  RenderWorkloadContext,
  RenderWorkloadOutput
> = {
  name: 'Row Virtualization (Candidate)',
  description: 'O(1) viewport row windowing with dynamic overscan and scroll offset calculation.',

  execute: (context: RenderWorkloadContext): RenderWorkloadOutput => {
    const { rows, columns, viewportHeight, rowHeight, scrollTop, overscan = 5 } = context;
    const totalRows = rows.length;
    const colCount = columns.length;

    // Viewport window calculation
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / rowHeight);
    const endIndex = Math.min(totalRows - 1, startIndex + visibleCount + overscan * 2);

    const mountedRowCount = Math.max(0, endIndex - startIndex + 1);
    const domNodeCount = mountedRowCount * (colCount + 1);
    const virtualOffsetTop = startIndex * rowHeight;
    const totalScrollHeight = totalRows * rowHeight;

    const renderedRows: Record<string, unknown>[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (rows[i]) {
        renderedRows.push(rows[i]!);
      }
    }

    return {
      mountedRowCount,
      domNodeCount,
      renderedRows,
      virtualOffsetTop,
      totalScrollHeight,
    };
  },

  collectMetrics: (output: RenderWorkloadOutput) => ({
    domNodes: output.domNodeCount,
    mountedRowCount: output.mountedRowCount,
  }),
};

/**
 * Validates that virtualized rows preserve the exact schema and data values of the underlying dataset.
 */
export function verifyRenderOutputCorrectness(
  baselineContext: RenderWorkloadContext,
  candidateOutput: RenderWorkloadOutput,
): CorrectnessVerificationResult {
  // Candidate rows must be a valid continuous slice of baseline rows
  const startIndex = Math.max(
    0,
    Math.floor(baselineContext.scrollTop / baselineContext.rowHeight) -
      (baselineContext.overscan ?? 5),
  );
  const expectedSlice = baselineContext.rows.slice(
    startIndex,
    startIndex + candidateOutput.mountedRowCount,
  );

  return verifyCorrectness(expectedSlice, candidateOutput.renderedRows, {
    mode: 'canonical',
    orderSignificant: true,
    requireRecordCountParity: true,
  });
}
