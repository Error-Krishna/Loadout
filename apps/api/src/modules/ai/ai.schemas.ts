import { z } from 'zod';

export const sanitizedAiContextSchema = z
  .object({
    activeView: z.string(),
    activeStep: z.string().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    datasetSummary: z
      .object({
        name: z.string(),
        format: z.string(),
        rowCount: z.number(),
        columnCount: z.number(),
        columns: z.array(z.string()),
      })
      .optional(),
    benchmarkSummary: z
      .object({
        workloadName: z.string(),
        verdict: z.string(),
        verdictReason: z.string(),
        delta: z.object({
          medianDurationMs: z.number(),
          medianDurationChangePct: z.number(),
          domNodesDelta: z.number(),
          domNodesChangePct: z.number(),
        }),
        baseline: z.object({
          variantLabel: z.string(),
          medianMs: z.number(),
          meanMs: z.number(),
          sampleCount: z.number(),
          domNodes: z.number(),
        }),
        candidate: z.object({
          variantLabel: z.string(),
          medianMs: z.number(),
          meanMs: z.number(),
          sampleCount: z.number(),
          domNodes: z.number(),
        }),
        correctness: z.object({
          status: z.string(),
          recordCountParity: z.boolean(),
          schemaParity: z.boolean(),
          nullSemanticsPreserved: z.boolean(),
        }),
        warnings: z.array(z.string()),
      })
      .optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    // Strict assertion: Reject if raw row data or un-sanitized fields were injected
    const str = JSON.stringify(val);
    if (str.includes('"parsedRows"') || str.includes('"rawRows"') || str.includes('"records"')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Raw dataset records detected in context. Only sanitized metadata is permitted.',
      });
    }
  });

export const aiCompletionRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'Prompt cannot be empty')
    .max(8000, 'Prompt exceeds maximum length'),
  context: sanitizedAiContextSchema.optional(),
  citations: z
    .array(
      z.object({
        sourceId: z.string(),
        title: z.string(),
        section: z.string(),
        url: z.string().optional(),
        excerpt: z.string(),
      }),
    )
    .optional(),
});

export type AiCompletionRequest = z.infer<typeof aiCompletionRequestSchema>;

export const aiCompletionResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    content: z.string(),
    provider: z.enum(['groq', 'offline']),
    model: z.string().optional(),
    citations: z
      .array(
        z.object({
          sourceId: z.string(),
          title: z.string(),
          section: z.string(),
          url: z.string().optional(),
          excerpt: z.string(),
        }),
      )
      .optional(),
    suggestedActions: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          actionType: z.string(),
          payload: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .optional(),
    fallbackReason: z.string().optional(),
    retryAfterSeconds: z.number().optional(),
  }),
});

export type AiCompletionResponse = z.infer<typeof aiCompletionResponseSchema>;
