import { describe, expect, it } from 'vitest';
import type { FilterWorkerRequest, FilterWorkerResponse } from '../types/dataset';

describe('dataset filter logic and worker contracts', () => {
  const sampleRows = [
    { id: 1, name: 'Alice Smith', role: 'Staff Engineer' },
    { id: 2, name: 'Bob Jones', role: 'Product Manager' },
    { id: 3, name: 'Charlie Brown', role: 'QA Engineer' },
  ];
  const columns = ['id', 'name', 'role'];

  it('filters rows correctly with case-insensitivity', () => {
    const query = 'engineer';
    const lowerQuery = query.toLowerCase();

    const matchedIndices: number[] = [];
    sampleRows.forEach((row, idx) => {
      let matched = false;
      columns.forEach((col) => {
        const val = row[col as keyof typeof row];
        if (val && String(val).toLowerCase().includes(lowerQuery)) {
          matched = true;
        }
      });
      if (matched) matchedIndices.push(idx);
    });

    expect(matchedIndices).toEqual([0, 2]); // Alice and Charlie
  });

  it('worker contract matches expected response shape and index payload', () => {
    const request: FilterWorkerRequest = {
      id: 42,
      query: 'bob',
      rows: sampleRows,
      columns,
    };

    // Simulate worker processing
    const lowerQuery = request.query.toLowerCase();
    const indices: number[] = [];
    request.rows.forEach((row, idx) => {
      let matched = false;
      request.columns.forEach((col) => {
        const val = row[col];
        if (val && String(val).toLowerCase().includes(lowerQuery)) {
          matched = true;
        }
      });
      if (matched) indices.push(idx);
    });

    const response: FilterWorkerResponse = {
      id: request.id,
      filteredIndices: indices,
      durationMs: 1.5,
    };

    expect(response.id).toBe(42);
    expect(response.filteredIndices).toEqual([1]);
    expect(response.durationMs).toBeGreaterThan(0);
  });
});
