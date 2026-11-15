import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
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

  describe('Live execution of dataset-filter.worker.ts message handler', () => {
    let postedMessages: FilterWorkerOutboundMessage[] = [];

    beforeAll(async () => {
      postedMessages = [];
      (self as unknown as { postMessage: (msg: FilterWorkerOutboundMessage) => void }).postMessage =
        (msg: FilterWorkerOutboundMessage) => {
          postedMessages.push(msg);
        };
      // Load the worker script which sets self.onmessage
      await import('../workers/dataset-filter.worker');
    });

    beforeEach(() => {
      postedMessages = [];
    });

    it('processes init message, caches dataset, and posts ready message', () => {
      const event = new MessageEvent('message', {
        data: {
          type: 'init',
          datasetId: 'dataset-live-1',
          rows: sampleRows,
          columns,
        },
      });

      self.onmessage!(event);

      expect(postedMessages).toHaveLength(1);
      expect(postedMessages[0]).toEqual({
        type: 'ready',
        datasetId: 'dataset-live-1',
        rowCount: 3,
      });
    });

    it('processes filter query using cached rows and returns matching indices', () => {
      const event = new MessageEvent('message', {
        data: {
          type: 'filter',
          id: 501,
          query: 'engineer',
        },
      });

      self.onmessage!(event);

      expect(postedMessages).toHaveLength(1);
      const res = postedMessages[0] as {
        type: 'filtered';
        id: number;
        filteredIndices: number[];
        durationMs: number;
      };
      expect(res.type).toBe('filtered');
      expect(res.id).toBe(501);
      expect(res.filteredIndices).toEqual([0, 2]); // Alice & Charlie
      expect(typeof res.durationMs).toBe('number');
    });

    it('clears worker cache when clear message is posted', () => {
      const clearEvent = new MessageEvent('message', {
        data: { type: 'clear' },
      });
      self.onmessage!(clearEvent);

      // Subsequent query returns empty because cache was cleared
      const filterEvent = new MessageEvent('message', {
        data: { type: 'filter', id: 502, query: 'engineer' },
      });
      self.onmessage!(filterEvent);

      const res = postedMessages[0] as { type: 'filtered'; filteredIndices: number[] };
      expect(res.filteredIndices).toEqual([]);
    });

    it('handles legacy filter message payload with rows directly', () => {
      const legacyEvent = new MessageEvent('message', {
        data: {
          id: 999,
          query: 'manager',
          rows: sampleRows,
          columns,
        },
      });

      self.onmessage!(legacyEvent);

      expect(postedMessages).toHaveLength(1);
      const res = postedMessages[0] as { id: number; filteredIndices: number[] };
      expect(res.id).toBe(999);
      expect(res.filteredIndices).toEqual([1]); // Bob Jones
    });
  });
});
