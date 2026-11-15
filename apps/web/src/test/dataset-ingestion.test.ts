import { describe, expect, it } from 'vitest';
import {
  parseCsvRecords,
  parseNdjsonRecords,
  parseJsonArrayRecords,
  streamParseFile,
} from '../lib/dataset/stream-parser.ts';

describe('Robust Dataset Ingestion Engine (Phase Two)', () => {
  // 1. RFC 4180 CSV Compliant Parsing
  describe('RFC 4180 CSV Parsing', () => {
    it('handles commas inside quoted fields accurately', () => {
      const csv = `id,name,address,age\n1,"Doe, John","New York, NY",35\n2,"Smith, Jane","Chicago, IL",28`;
      const res = parseCsvRecords(csv);

      expect(res.columns).toEqual(['id', 'name', 'address', 'age']);
      expect(res.rows).toHaveLength(2);
      expect(res.rows[0]).toEqual({
        id: 1,
        name: 'Doe, John',
        address: 'New York, NY',
        age: 35,
      });
      expect(res.rows[1]).toEqual({
        id: 2,
        name: 'Smith, Jane',
        address: 'Chicago, IL',
        age: 28,
      });
    });

    it('handles escaped double quotes ("") inside quoted fields', () => {
      const csv = `id,quote,author\n1,"He said, ""Hello World!""",Alice\n2,"She said, ""Goodbye!""",Bob`;
      const res = parseCsvRecords(csv);

      expect(res.rows[0]?.['quote']).toBe('He said, "Hello World!"');
      expect(res.rows[1]?.['quote']).toBe('She said, "Goodbye!"');
    });

    it('handles multiline values inside quotes preserving line breaks', () => {
      const csv = `id,description,status\n1,"First line\nSecond line\nThird line",active\n2,"Single line",inactive`;
      const res = parseCsvRecords(csv);

      expect(res.rows).toHaveLength(2);
      expect(res.rows[0]?.['description']).toBe('First line\nSecond line\nThird line');
      expect(res.rows[0]?.['status']).toBe('active');
    });

    it('handles CRLF (\\r\\n) and trailing newlines gracefully', () => {
      const csv = 'id,name\r\n1,Alice\r\n2,Bob\r\n';
      const res = parseCsvRecords(csv);

      expect(res.columns).toEqual(['id', 'name']);
      expect(res.rows).toHaveLength(2);
      expect(res.totalRows).toBe(2);
    });

    it('infers typed primitives (numbers, booleans, nulls)', () => {
      const csv = `id,active,rating,comment\n101,true,4.9,null\n102,false,-12.5,valid`;
      const res = parseCsvRecords(csv);

      expect(res.rows[0]).toEqual({
        id: 101,
        active: true,
        rating: 4.9,
        comment: null,
      });
      expect(res.rows[1]).toEqual({
        id: 102,
        active: false,
        rating: -12.5,
        comment: 'valid',
      });
    });

    it('handles empty CSV input safely', () => {
      expect(parseCsvRecords('')).toEqual({ columns: [], rows: [], totalRows: 0 });
      expect(parseCsvRecords('   \n  \n')).toEqual({ columns: [], rows: [], totalRows: 0 });
    });
  });

  // 2. NDJSON / JSONL Streaming Parsing
  describe('NDJSON / JSONL Ingestion', () => {
    it('parses newline-delimited JSON line by line', () => {
      const ndjson = `{"id": 1, "service": "auth", "latency": 12.4}\n{"id": 2, "service": "api", "latency": 45.1}\n{"id": 3, "service": "db", "latency": 8.0}\n`;
      const res = parseNdjsonRecords(ndjson);

      expect(res.columns).toContain('id');
      expect(res.columns).toContain('service');
      expect(res.columns).toContain('latency');
      expect(res.rows).toHaveLength(3);
      expect(res.rows[0]).toEqual({ id: 1, service: 'auth', latency: 12.4 });
    });

    it('recovers gracefully from malformed lines without throwing', () => {
      const ndjson = `{"id": 1, "status": "ok"}\nMALFORMED_JSON_LINE\n{"id": 2, "status": "ok"}\n`;
      const res = parseNdjsonRecords(ndjson);

      expect(res.rows).toHaveLength(2);
      expect(res.warnings.some((w) => w.includes('Malformed JSON line'))).toBe(true);
    });

    it('handles empty lines between records', () => {
      const ndjson = `{"id": 1}\n\n\n{"id": 2}\n`;
      const res = parseNdjsonRecords(ndjson);

      expect(res.rows).toHaveLength(2);
    });
  });

  // 3. JSON Array Parsing
  describe('Standard JSON Array Ingestion', () => {
    it('parses standard top-level JSON array', () => {
      const json = JSON.stringify([
        { id: 1, title: 'Item 1', count: 10 },
        { id: 2, title: 'Item 2', count: 20 },
      ]);
      const res = parseJsonArrayRecords(json);

      expect(res.columns).toEqual(['id', 'title', 'count']);
      expect(res.rows).toHaveLength(2);
    });

    it('rejects non-array root JSON with helpful error message', () => {
      const json = JSON.stringify({ message: 'not an array' });
      expect(() => parseJsonArrayRecords(json)).toThrow(/must be an array of records/);
    });
  });

  // 4. Chunked Stream Parsing, Cancellation & Backpressure
  describe('Chunked Stream Parser (streamParseFile)', () => {
    it('streams string input with real-time progress callbacks', async () => {
      const csv = `id,name,role\n1,Alice,Lead\n2,Bob,Senior\n3,Charlie,Staff`;
      const phases: string[] = [];

      const res = await streamParseFile(csv, 'csv', {
        onProgress: (p) => phases.push(p.phase),
      });

      expect(res.rows).toHaveLength(3);
      expect(res.columns).toEqual(['id', 'name', 'role']);
      expect(phases).toContain('parsing');
      expect(phases).toContain('completed');
    });

    it('supports immediate AbortSignal cancellation', async () => {
      const controller = new AbortController();
      controller.abort('User cancellation');

      await expect(
        streamParseFile('id,val\n1,100', 'csv', { signal: controller.signal }),
      ).rejects.toThrow(/cancelled/);
    });

    it('enforces maxRows ceiling safeguard on large files', async () => {
      const lines = ['id,value'];
      for (let i = 0; i < 500; i++) {
        lines.push(`${i},val_${i}`);
      }
      const largeCsv = lines.join('\n');

      const res = await streamParseFile(largeCsv, 'csv', { maxRows: 100 });

      expect(res.rows).toHaveLength(100);
      expect(res.totalRows).toBe(500);
      expect(res.isTruncated).toBe(true);
    });

    it('handles simulated Blob input chunked reading', async () => {
      const csvContent = `id,name,city\n1,Alice,Berlin\n2,Bob,Tokyo\n3,Carol,London`;
      const blob = new Blob([csvContent], { type: 'text/csv' });

      const progressSteps: number[] = [];
      const res = await streamParseFile(blob, 'csv', {
        chunkSizeBytes: 16, // Force multiple small chunks
        onProgress: (p) => progressSteps.push(p.percent),
      });

      expect(res.rows).toHaveLength(3);
      expect(progressSteps.length).toBeGreaterThanOrEqual(1);
      expect(progressSteps[progressSteps.length - 1]).toBe(100);
    });

    it('correctly parses CSV larger than 512 KB and preserves all records across chunk boundaries', async () => {
      // Build a CSV dataset strictly larger than 512 KB (e.g. ~600 KB)
      const lines = ['id,uuid,payload,score,active'];
      const targetRows = 6000;
      for (let i = 1; i <= targetRows; i++) {
        lines.push(
          `${i},usr_uuid_000000000000000000000000000_${i},sample_data_payload_long_string_content_${i},${(i * 1.5).toFixed(2)},true`,
        );
      }
      const largeCsv = lines.join('\n');
      const blob = new Blob([largeCsv], { type: 'text/csv' });
      expect(blob.size).toBeGreaterThan(512 * 1024); // Confirms > 512 KB

      const res = await streamParseFile(blob, 'csv', {
        chunkSizeBytes: 32 * 1024,
      });

      expect(res.totalRows).toBe(targetRows);
      expect(res.rows).toHaveLength(targetRows);
      // Verify first and last rows
      expect(res.rows[0]?.['id']).toBe(1);
      expect(res.rows[targetRows - 1]?.['id']).toBe(targetRows);
      expect(res.rows[targetRows - 1]?.['active']).toBe(true);
    });

    it('correctly handles quoted multiline fields and escaped quotes spanning across chunk boundaries', async () => {
      // Create a CSV with multiline field and escaped quote split across 16-byte chunks
      const csv =
        'id,summary,note\n1,"Line 1\nLine 2\nLine 3","He said ""Hello"" clearly"\n2,"Simple","End"';
      const blob = new Blob([csv], { type: 'text/csv' });

      const res = await streamParseFile(blob, 'csv', {
        chunkSizeBytes: 12, // Very small chunk size to guarantee slicing inside quotes and newlines
      });

      expect(res.rows).toHaveLength(2);
      expect(res.rows[0]?.['summary']).toBe('Line 1\nLine 2\nLine 3');
      expect(res.rows[0]?.['note']).toBe('He said "Hello" clearly');
      expect(res.rows[1]?.['summary']).toBe('Simple');
    });

    it('correctly parses NDJSON larger than 512 KB incrementally', async () => {
      const records: string[] = [];
      const targetRows = 6000;
      for (let i = 1; i <= targetRows; i++) {
        records.push(
          JSON.stringify({
            id: i,
            service: `service_node_cluster_${i % 10}`,
            payload: `telemetry_event_data_stream_payload_record_${i}`,
            latency: 12.5 + (i % 50),
            status: 200,
          }),
        );
      }
      const largeNdjson = records.join('\n') + '\n';
      const blob = new Blob([largeNdjson], { type: 'application/x-ndjson' });
      expect(blob.size).toBeGreaterThan(512 * 1024);

      const res = await streamParseFile(blob, 'ndjson', {
        chunkSizeBytes: 32 * 1024,
      });

      expect(res.totalRows).toBe(targetRows);
      expect(res.rows).toHaveLength(targetRows);
      expect(res.rows[0]?.['id']).toBe(1);
      expect(res.rows[targetRows - 1]?.['id']).toBe(targetRows);
    });
  });
});
