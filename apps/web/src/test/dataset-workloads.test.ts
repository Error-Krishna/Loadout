import { describe, expect, it } from 'vitest';
import {
  naiveFilterWorkload,
  optimizedFilterWorkload,
  verifyFilterOutputCorrectness,
  naiveRenderWorkload,
  virtualizedRenderWorkload,
  verifyRenderOutputCorrectness,
} from '../lib/benchmark/workloads/dataset-workloads.ts';

describe('Dataset Workload Adapters (M1-T04)', () => {
  const sampleRows = [
    { id: 1, name: 'Alpha Corp', department: 'Engineering', revenue: 150000 },
    { id: 2, name: 'Beta LLC', department: 'Marketing', revenue: 95000 },
    { id: 3, name: 'Gamma Inc', department: 'Engineering', revenue: 220000 },
    { id: 4, name: 'Delta Co', department: 'Support', revenue: 60000 },
    { id: 5, name: 'Epsilon Ltd', department: 'Engineering', revenue: 180000 },
  ];
  const columns = ['id', 'name', 'department', 'revenue'];

  describe('Filter Workloads', () => {
    it('executes baseline and candidate filter workloads producing identical results', () => {
      const context = {
        rows: sampleRows,
        columns,
        query: 'engineering',
      };

      const baselineOutput = naiveFilterWorkload.execute(context, {
        iteration: 1,
        isWarmup: false,
      });
      const candidateOutput = optimizedFilterWorkload.execute(context, {
        iteration: 1,
        isWarmup: false,
      });

      expect(baselineOutput.matchedIndices).toEqual([0, 2, 4]);
      expect(candidateOutput.matchedIndices).toEqual([0, 2, 4]);

      // Verify semantic correctness gate outside timed interval
      const correctness = verifyFilterOutputCorrectness(baselineOutput, candidateOutput);
      expect(correctness.status).toBe('passed');
      expect(correctness.recordCountParity).toBe(true);
      expect(correctness.schemaParity).toBe(true);
    });

    it('collects metrics accurately', () => {
      const metrics = naiveFilterWorkload.collectMetrics?.(
        { matchedIndices: [0, 1], matchedRows: [] },
        { rows: [], columns: [], query: '' },
      );
      expect(metrics?.matchedRows).toBe(2);
    });
  });

  describe('Table Render Workloads', () => {
    it('executes full table baseline and virtualized candidate workloads', () => {
      const largeRows = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Row ${i}`,
        department: i % 2 === 0 ? 'Engineering' : 'Support',
        revenue: 10000 + i * 500,
      }));

      const context = {
        rows: largeRows,
        columns,
        viewportHeight: 100,
        rowHeight: 36,
        scrollTop: 0,
        overscan: 1,
      };

      const baselineOutput = naiveRenderWorkload.execute(context, {
        iteration: 1,
        isWarmup: false,
      });
      const candidateOutput = virtualizedRenderWorkload.execute(context, {
        iteration: 1,
        isWarmup: false,
      });

      // Baseline mounts all 100 rows
      expect(baselineOutput.mountedRowCount).toBe(100);
      expect(baselineOutput.domNodeCount).toBe(100 * 5); // 100 rows * (4 cols + 1)

      // Virtualized mounts only viewport slice + overscan (~5 rows)
      expect(candidateOutput.mountedRowCount).toBeLessThan(15);
      expect(candidateOutput.domNodeCount).toBeLessThan(baselineOutput.domNodeCount);

      // Verify that candidate rendered rows faithfully match expected dataset slice
      const correctness = verifyRenderOutputCorrectness(context, candidateOutput);
      expect(correctness.status).toBe('passed');
      expect(correctness.nullSemanticsPreserved).toBe(true);
    });
  });
});
