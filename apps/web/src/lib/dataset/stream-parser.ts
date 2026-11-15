/**
 * LOADOUT Version 2.1 — Robust Incremental Streaming Dataset Ingestion Engine
 *
 * Implements Genuinely Incremental Parsing:
 * - Streaming RFC 4180-compliant CSV parser: state machine preserves state across chunk boundaries
 *   (quoted fields, commas inside quotes, escaped quotes (""), and multiline values spanning chunks).
 * - Streaming NDJSON / JSONL line-by-line parser with chunk buffering and fault-tolerant error recovery.
 * - Zero full-file memory duplication: avoids concatenating 100MB chunks into monolithic strings.
 * - Microtask backpressure yields to maintain 60 FPS UI responsiveness.
 * - AbortSignal cancellation support at chunk boundaries.
 * - Real-time IngestionProgress reporting (bytes processed, rows parsed, percent).
 * - Bounded row ceiling safeguards with accurate total row counting.
 */

import type { DatasetFormat, StreamParserOptions } from '../../types/dataset.ts';

export interface ParseResult {
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  isTruncated: boolean;
  warnings: string[];
}

/**
 * Automatically infers typed numbers and booleans from CSV string tokens.
 */
export function parseInferredPrimitive(val: string): string | number | boolean | null {
  const trimmed = val.trim();
  if (trimmed === '') return '';
  if (trimmed === 'null' || trimmed === 'NULL') return null;
  if (trimmed === 'true' || trimmed === 'TRUE') return true;
  if (trimmed === 'false' || trimmed === 'FALSE') return false;

  // Numeric check (reject hex or leading zero codes like phone numbers / zip codes)
  if (
    /^-?\d+(\.\d+)?$/.test(trimmed) &&
    !(trimmed.length > 1 && trimmed.startsWith('0') && !trimmed.startsWith('0.'))
  ) {
    const num = Number(trimmed);
    if (!Number.isNaN(num)) return num;
  }

  return val;
}

/**
 * Incremental stateful RFC 4180 CSV parser that processes chunk-by-chunk
 * without accumulating raw file text into monolithic memory buffers.
 */
export class IncrementalCsvParser {
  private delimiter: string;
  private maxRows: number;
  public columns: string[] = [];
  public rows: Record<string, unknown>[] = [];
  public totalRows = 0;
  public warnings: string[] = [];

  private inQuotes = false;
  private currentField = '';
  private currentRecord: string[] = [];
  private isHeaderCaptured = false;
  private pendingQuoteAtChunkEnd = false;
  private pendingCrAtChunkEnd = false;

  constructor(delimiter = ',', maxRows = 100_000) {
    this.delimiter = delimiter;
    this.maxRows = maxRows;
  }

  public pushChunk(chunk: string): void {
    if (!chunk || chunk.length === 0) return;

    let i = 0;
    const len = chunk.length;

    // Handle quote at boundary of previous chunk
    if (this.pendingQuoteAtChunkEnd) {
      this.pendingQuoteAtChunkEnd = false;
      if (chunk[0] === '"') {
        // Was an escaped quote across boundary: ""
        this.currentField += '"';
        i = 1;
      } else {
        // Was a closing quote
        this.inQuotes = false;
      }
    }

    // Handle carriage return at boundary of previous chunk
    if (this.pendingCrAtChunkEnd) {
      this.pendingCrAtChunkEnd = false;
      if (chunk[0] === '\n') {
        i = 1;
      }
      this.emitCurrentRecord();
    }

    while (i < len) {
      const char = chunk[i]!;

      if (this.inQuotes) {
        if (char === '"') {
          // Check for escaped quote ""
          if (i + 1 < len) {
            if (chunk[i + 1] === '"') {
              this.currentField += '"';
              i += 2;
              continue;
            } else {
              // Closing quote
              this.inQuotes = false;
              i++;
              continue;
            }
          } else {
            // Quote at the very end of this chunk: defer resolution to next chunk
            this.pendingQuoteAtChunkEnd = true;
            break;
          }
        } else {
          // Preserved character inside quoted field (including comma, \n, \r)
          this.currentField += char;
          i++;
        }
      } else {
        if (char === '"') {
          this.inQuotes = true;
          i++;
        } else if (char === this.delimiter) {
          this.currentRecord.push(this.currentField);
          this.currentField = '';
          i++;
        } else if (char === '\r') {
          if (i + 1 < len) {
            if (chunk[i + 1] === '\n') {
              i += 2;
            } else {
              i++;
            }
            this.emitCurrentRecord();
          } else {
            // CR at end of chunk: defer resolution of CRLF to next chunk
            this.pendingCrAtChunkEnd = true;
            break;
          }
        } else if (char === '\n') {
          this.emitCurrentRecord();
          i++;
        } else {
          this.currentField += char;
          i++;
        }
      }
    }
  }

  private emitCurrentRecord(): void {
    this.currentRecord.push(this.currentField);
    this.currentField = '';

    // Ignore empty trailing newline records
    if (this.currentRecord.length === 1 && this.currentRecord[0] === '' && this.isHeaderCaptured) {
      this.currentRecord = [];
      return;
    }

    if (!this.isHeaderCaptured) {
      this.columns = this.currentRecord.map((h, idx) => {
        const clean = h.trim();
        return clean.length > 0 ? clean : `column_${idx + 1}`;
      });
      this.isHeaderCaptured = true;
    } else {
      this.totalRows++;
      if (this.rows.length < this.maxRows) {
        const rowObj: Record<string, unknown> = {};
        for (let c = 0; c < this.columns.length; c++) {
          const colName = this.columns[c]!;
          const rawVal = this.currentRecord[c] !== undefined ? this.currentRecord[c]! : '';
          rowObj[colName] = parseInferredPrimitive(rawVal);
        }
        this.rows.push(rowObj);
      }
    }

    this.currentRecord = [];
  }

  public flush(): {
    columns: string[];
    rows: Record<string, unknown>[];
    totalRows: number;
    warnings: string[];
  } {
    if (this.pendingQuoteAtChunkEnd) {
      this.inQuotes = false;
      this.pendingQuoteAtChunkEnd = false;
    }

    if (this.currentField.length > 0 || this.currentRecord.length > 0) {
      this.emitCurrentRecord();
    }

    return {
      columns: this.columns,
      rows: this.rows,
      totalRows: this.totalRows,
      warnings: this.warnings,
    };
  }
}

/**
 * Incremental stateful NDJSON / JSONL parser.
 */
export class IncrementalNdjsonParser {
  private maxRows: number;
  public columns: string[] = [];
  public rows: Record<string, unknown>[] = [];
  public totalRows = 0;
  public warnings: string[] = [];

  private buffer = '';
  private columnSet = new Set<string>();
  private lineNumber = 0;

  constructor(maxRows = 100_000) {
    this.maxRows = maxRows;
  }

  public pushChunk(chunk: string): void {
    if (!chunk || chunk.length === 0) return;

    const combined = this.buffer + chunk;
    const lines = combined.split('\n');

    // Last element is uncompleted remainder for next chunk
    this.buffer = lines.pop() ?? '';

    for (let i = 0; i < lines.length; i++) {
      this.processLine(lines[i]!);
    }
  }

  private processLine(rawLine: string): void {
    this.lineNumber++;
    const line = rawLine.trim();
    if (line.length === 0) return;

    try {
      const parsed = JSON.parse(line);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        this.totalRows++;
        if (this.rows.length < this.maxRows) {
          const record = parsed as Record<string, unknown>;
          this.rows.push(record);
          for (const k of Object.keys(record)) {
            this.columnSet.add(k);
          }
        }
      } else {
        this.warnings.push(`Line ${this.lineNumber}: Skipped non-object JSON value.`);
      }
    } catch {
      this.warnings.push(`Line ${this.lineNumber}: Malformed JSON line.`);
    }
  }

  public flush(): {
    columns: string[];
    rows: Record<string, unknown>[];
    totalRows: number;
    warnings: string[];
  } {
    if (this.buffer.trim().length > 0) {
      this.processLine(this.buffer);
      this.buffer = '';
    }

    this.columns = Array.from(this.columnSet);

    return {
      columns: this.columns,
      rows: this.rows,
      totalRows: this.totalRows,
      warnings: this.warnings,
    };
  }
}

/**
 * Parses full in-memory CSV text synchronously.
 */
export function parseCsvRecords(
  text: string,
  delimiter = ',',
  maxRows?: number,
): { columns: string[]; rows: Record<string, unknown>[]; totalRows: number } {
  if (!text || text.trim().length === 0) {
    return { columns: [], rows: [], totalRows: 0 };
  }
  const parser = new IncrementalCsvParser(delimiter, maxRows ?? 1_000_000);
  parser.pushChunk(text);
  const res = parser.flush();
  return {
    columns: res.columns,
    rows: res.rows,
    totalRows: res.totalRows,
  };
}

/**
 * Parses full in-memory NDJSON / JSONL text synchronously.
 */
export function parseNdjsonRecords(
  text: string,
  maxRows?: number,
): { columns: string[]; rows: Record<string, unknown>[]; totalRows: number; warnings: string[] } {
  const parser = new IncrementalNdjsonParser(maxRows ?? 1_000_000);
  parser.pushChunk(text);
  return parser.flush();
}

/**
 * Parses standard top-level JSON array with schema detection.
 */
export function parseJsonArrayRecords(
  text: string,
  maxRows?: number,
): { columns: string[]; rows: Record<string, unknown>[]; totalRows: number } {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error('JSON dataset root must be an array of records.');
  }

  const totalRows = parsed.length;
  const targetRows = maxRows ? parsed.slice(0, maxRows) : parsed;
  const columnSet = new Set<string>();

  for (const item of targetRows) {
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      for (const k of Object.keys(item)) {
        columnSet.add(k);
      }
    }
  }

  return {
    columns: Array.from(columnSet),
    rows: targetRows as Record<string, unknown>[],
    totalRows,
  };
}

/**
 * Unified Incremental Streaming Parser for Files, Blobs, or raw Strings.
 *
 * Emits records incrementally chunk-by-chunk without joining entire files into memory.
 */
export async function streamParseFile(
  fileOrText: File | Blob | string,
  format: DatasetFormat,
  options: StreamParserOptions = {},
): Promise<ParseResult> {
  const chunkSizeBytes = options.chunkSizeBytes ?? 64 * 1024; // 64 KB
  const maxRows = options.maxRows ?? 100_000;
  const signal = options.signal;
  const onProgress = options.onProgress;
  const yieldIntervalMs = options.yieldIntervalMs ?? 16;
  const delimiter = options.delimiter ?? ',';

  // Handle in-memory string input directly
  if (typeof fileOrText === 'string') {
    if (signal?.aborted) {
      throw new Error('Dataset ingestion was cancelled.');
    }

    onProgress?.({
      bytesProcessed: fileOrText.length,
      totalBytes: fileOrText.length,
      percent: 50,
      rowsParsed: 0,
      phase: 'parsing',
    });

    let res: {
      columns: string[];
      rows: Record<string, unknown>[];
      totalRows: number;
      warnings?: string[];
    };
    if (format === 'csv') {
      res = parseCsvRecords(fileOrText, delimiter, maxRows);
    } else if (format === 'ndjson') {
      res = parseNdjsonRecords(fileOrText, maxRows);
    } else {
      res = parseJsonArrayRecords(fileOrText, maxRows);
    }

    onProgress?.({
      bytesProcessed: fileOrText.length,
      totalBytes: fileOrText.length,
      percent: 100,
      rowsParsed: res.rows.length,
      phase: 'completed',
    });

    return {
      columns: res.columns,
      rows: res.rows,
      totalRows: res.totalRows,
      isTruncated: res.totalRows > maxRows,
      warnings: res.warnings ?? [],
    };
  }

  // Handle File / Blob input incrementally chunk by chunk
  const totalBytes = fileOrText.size;
  let offset = 0;
  const textDecoder = new TextDecoder('utf-8');
  let lastYieldTime = performance.now();

  const csvParser = format === 'csv' ? new IncrementalCsvParser(delimiter, maxRows) : null;
  const ndjsonParser = format === 'ndjson' ? new IncrementalNdjsonParser(maxRows) : null;
  const jsonChunks: string[] = []; // Only accumulated if format is json array

  while (offset < totalBytes) {
    if (signal?.aborted) {
      throw new Error('Dataset ingestion was cancelled.');
    }

    const chunkBlob = fileOrText.slice(offset, offset + chunkSizeBytes);
    const isStreamEnd = offset + chunkSizeBytes >= totalBytes;
    let textSegment: string;

    if (typeof (chunkBlob as Blob & { text?: () => Promise<string> }).text === 'function') {
      textSegment = await chunkBlob.text();
    } else if (typeof chunkBlob.arrayBuffer === 'function') {
      const buffer = await chunkBlob.arrayBuffer();
      textSegment = textDecoder.decode(buffer, { stream: !isStreamEnd });
    } else {
      textSegment = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(chunkBlob);
      });
    }

    if (csvParser) {
      csvParser.pushChunk(textSegment);
    } else if (ndjsonParser) {
      ndjsonParser.pushChunk(textSegment);
    } else {
      jsonChunks.push(textSegment);
    }

    offset += chunkSizeBytes;
    const processed = Math.min(offset, totalBytes);
    const percent = Math.min(95, Math.round((processed / totalBytes) * 90));
    const currentRowsParsed = csvParser
      ? csvParser.rows.length
      : ndjsonParser
        ? ndjsonParser.rows.length
        : 0;

    onProgress?.({
      bytesProcessed: processed,
      totalBytes,
      percent,
      rowsParsed: currentRowsParsed,
      phase: 'reading',
    });

    // Backpressure yield to event loop
    if (performance.now() - lastYieldTime > yieldIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      lastYieldTime = performance.now();
    }
  }

  onProgress?.({
    bytesProcessed: totalBytes,
    totalBytes,
    percent: 95,
    rowsParsed: csvParser ? csvParser.rows.length : ndjsonParser ? ndjsonParser.rows.length : 0,
    phase: 'parsing',
  });

  let parsedData: {
    columns: string[];
    rows: Record<string, unknown>[];
    totalRows: number;
    warnings?: string[];
  };

  try {
    if (csvParser) {
      parsedData = csvParser.flush();
    } else if (ndjsonParser) {
      parsedData = ndjsonParser.flush();
    } else {
      parsedData = parseJsonArrayRecords(jsonChunks.join(''), maxRows);
    }
  } catch (err) {
    throw new Error(`Parsing failure: ${(err as Error).message}`, { cause: err });
  }

  onProgress?.({
    bytesProcessed: totalBytes,
    totalBytes,
    percent: 100,
    rowsParsed: parsedData.rows.length,
    phase: 'completed',
  });

  return {
    columns: parsedData.columns,
    rows: parsedData.rows,
    totalRows: parsedData.totalRows,
    isTruncated: parsedData.totalRows > maxRows,
    warnings: parsedData.warnings || [],
  };
}
