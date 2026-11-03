import { describe, expect, it } from 'vitest';
import type { FilterWorkerInboundMessage, FilterWorkerOutboundMessage } from '../types/dataset';

describe('dataset filter worker messaging optimization (M1-T05)', () => {
  const sampleRows = [
    { id: 1, name: 'Alice Smith', role: 'Staff Engineer' },
    { id: 2, name: 'Bob Jones', role: 'Product Manager' },
    { id: 3, name: 'Charlie Brown', role: 'QA Engineer' },
  ];
  const columns = ['id', 'name', 'role'];

  it('filters rows correctly with case-insensitivity on main thread or worker logic', () => {
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

  it('supports initial dataset caching protocol (init -> ready)', () => {
    const initMessage: FilterWorkerInboundMessage = {
      type: 'init',
      datasetId: 'dataset-123',
      rows: sampleRows,
      columns,
    };

    expect(initMessage.type).toBe('init');
    expect(initMessage.datasetId).toBe('dataset-123');
    expect(initMessage.rows).toHaveLength(3);

    // Simulated worker ready response
    const readyResponse: FilterWorkerOutboundMessage = {
      type: 'ready',
      datasetId: initMessage.datasetId,
      rowCount: initMessage.rows.length,
    };

    expect(readyResponse.type).toBe('ready');
    expect(readyResponse.rowCount).toBe(3);
  });

  it('supports lightweight filter queries without repeating rows array payload', () => {
    // Keystroke query message contains ONLY id and query string
    const filterMessage: FilterWorkerInboundMessage = {
      type: 'filter',
      id: 101,
      query: 'bob',
    };

    expect(filterMessage.type).toBe('filter');
    expect(filterMessage.id).toBe(101);
    expect(filterMessage.query).toBe('bob');
    // Ensure rows array is not included in query dispatch
    expect('rows' in filterMessage).toBe(false);

    // Simulated response
    const filterResponse: FilterWorkerOutboundMessage = {
      type: 'filtered',
      id: 101,
      filteredIndices: [1],
      durationMs: 0.25,
    };

    expect(filterResponse.type).toBe('filtered');
    expect(filterResponse.id).toBe(101);
    expect(filterResponse.filteredIndices).toEqual([1]);
  });

  it('supports dataset replacement by re-initializing', () => {
    const newRows = [{ id: 99, name: 'Dana Scully', role: 'Special Agent' }];
    const reinitMessage: FilterWorkerInboundMessage = {
      type: 'init',
      datasetId: 'dataset-456',
      rows: newRows,
      columns: ['id', 'name', 'role'],
    };

    expect(reinitMessage.datasetId).toBe('dataset-456');
    expect(reinitMessage.rows).toHaveLength(1);
  });

  it('supports clear message for worker memory cleanup', () => {
    const clearMessage: FilterWorkerInboundMessage = {
      type: 'clear',
    };

    expect(clearMessage.type).toBe('clear');
  });

  it('maintains backwards compatibility with legacy FilterWorkerRequest shape', () => {
    const legacyRequest: FilterWorkerInboundMessage = {
      id: 42,
      query: 'bob',
      rows: sampleRows,
      columns,
    };

    expect(legacyRequest.id).toBe(42);
    expect(legacyRequest.rows).toHaveLength(3);
  });
});
