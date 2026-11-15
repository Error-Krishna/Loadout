import { describe, expect, it } from 'vitest';
import { aiCompletionRequestSchema, sanitizedAiContextSchema } from './ai.schemas.js';

describe('AI Schemas & Privacy Validation', () => {
  it('validates a correct sanitized AI completion request', () => {
    const valid = {
      prompt: 'Interpret benchmark results',
      context: {
        activeView: 'benchmarks',
        datasetSummary: {
          name: 'test.csv',
          format: 'csv',
          rowCount: 100,
          columnCount: 3,
          columns: ['id', 'name', 'value'],
        },
      },
      citations: [
        {
          sourceId: 'doc1',
          title: 'Virtualization',
          section: 'Intro',
          excerpt: 'Windowing minimizes DOM nodes',
        },
      ],
    };

    const res = aiCompletionRequestSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it('rejects empty prompts', () => {
    const res = aiCompletionRequestSchema.safeParse({ prompt: '   ' });
    expect(res.success).toBe(false);
  });

  it('rejects context containing raw dataset rows (privacy breach protection)', () => {
    const leakyContext = {
      activeView: 'benchmarks',
      datasetSummary: {
        name: 'test.csv',
        format: 'csv',
        rowCount: 100,
        columnCount: 3,
        columns: ['id', 'name', 'value'],
      },
      rawRows: [{ id: 1, name: 'Alice' }],
    };

    const res = sanitizedAiContextSchema.safeParse(leakyContext);
    expect(res.success).toBe(false);
  });

  it('rejects parsedRows in context', () => {
    const leakyContext = {
      activeView: 'benchmarks',
      parsedRows: [{ id: 1, name: 'Secret' }],
    };

    const res = sanitizedAiContextSchema.safeParse(leakyContext);
    expect(res.success).toBe(false);
  });
});
