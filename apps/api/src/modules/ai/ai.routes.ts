import { Router, type Request, type Response } from 'express';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { aiCompletionRequestSchema } from './ai.schemas.js';

export const aiRouter = Router();

/**
 * Mitigate prompt injection patterns by stripping control tokens and delimiter abuse.
 */
function sanitizePrompt(prompt: string): string {
  return prompt
    .replace(/<\|im_start\|>|<\|im_end\|>/gi, '')
    .replace(/\[INST\]|\[\/INST\]/gi, '')
    .replace(/<<SYS>>|<\/SYS>>/gi, '')
    .trim();
}

/**
 * Generate heuristic fallback text when Groq is unavailable or unconfigured.
 */
function generateOfflineFallbackContent(
  prompt: string,
  context?: import('./ai.schemas.js').AiCompletionRequest['context'],
): string {
  const p = prompt.toLowerCase();
  if (context?.benchmarkSummary) {
    const b = context.benchmarkSummary;
    const speedup = Math.abs(b.delta.medianDurationChangePct);
    const domSaved = Math.abs(b.delta.domNodesChangePct);
    const isFaster = b.verdict === 'improved';
    const isInvalid = b.verdict === 'invalid' || b.correctness.status === 'failed';

    let out = `### 🔬 Benchmark Technical Evaluation: \`${b.workloadName}\`\n\n`;
    if (isInvalid) {
      out += `> ⚠️ **VERDICT: INVALIDATED OPTIMIZATION**\n`;
      out += `> Correctness verification failed (${b.correctness.status}). Semantic integrity was compromised.\n\n`;
    } else if (isFaster) {
      out += `> ✅ **VERDICT: CONFIRMED SPEEDUP (${speedup.toFixed(1)}% faster)**\n\n`;
    } else {
      out += `> ℹ️ **VERDICT: ${b.verdict.toUpperCase()}**\n\n`;
    }
    out += `#### 📊 Measured Metrics:\n`;
    out += `- **Execution Time:** ${b.baseline.medianMs} ms → ${b.candidate.medianMs} ms (${b.delta.medianDurationMs > 0 ? '+' : ''}${b.delta.medianDurationMs.toFixed(1)} ms)\n`;
    out += `- **DOM Elements:** ${b.baseline.domNodes} nodes → ${b.candidate.domNodes} nodes (-${domSaved.toFixed(1)}%)\n`;
    out += `- **Sample Size:** ${b.candidate.sampleCount} iterations\n`;
    return out;
  }

  if (p.includes('plan') || p.includes('experiment')) {
    return (
      `### 📋 Controlled Experiment Plan\n\n` +
      `**Hypothesis:** Replacing unwindowed full-table DOM mounting with virtualized windowing bounds elements to ~40 nodes and reduces latency by >90% on large datasets.\n\n` +
      `- **Baseline:** Naive DOM rendering\n` +
      `- **Candidate:** Windowed virtualization\n` +
      `- **Policy:** 2 warmup, 5 measured iterations, 5000ms timeout`
    );
  }

  return (
    `### LOADOUT Performance Engineering Assistant\n\n` +
    `Evaluates web performance benchmarks, statistical distributions, memory trade-offs, and browser DOM rendering.\n` +
    `Operating in fallback mode.`
  );
}

aiRouter.post('/completions', async (req: Request, res: Response) => {
  const parseResult = aiCompletionRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid AI completion request',
        details: parseResult.error.issues,
      },
    });
    return;
  }

  const { prompt, context, citations } = parseResult.data;
  const sanitized = sanitizePrompt(prompt);

  // If no Groq API key is configured on server, return offline fallback immediately
  if (!env.GROQ_API_KEY) {
    logger.debug('No server GROQ_API_KEY configured; returning offline heuristic fallback');
    res.status(200).json({
      success: true,
      data: {
        content: generateOfflineFallbackContent(sanitized, context),
        provider: 'offline',
        citations: citations ?? [],
        fallbackReason:
          'GROQ_API_KEY is not configured on the server. Defaulted to local offline heuristics.',
      },
    });
    return;
  }

  try {
    const systemPrompt =
      'You are the Senior Performance Engineering Copilot for LOADOUT. ' +
      'You evaluate web performance benchmarks, statistical distributions, memory trade-offs, and browser DOM rendering. ' +
      'Never fabricate metrics; adhere strictly to verified performance contexts. ' +
      'Cite verified knowledge citations where relevant.';

    const userMessageContent = [
      `User Question:\n${sanitized}`,
      context ? `\nSanitized Context:\n${JSON.stringify(context, null, 2)}` : '',
      citations && citations.length > 0
        ? `\nRelevant Knowledge Citations:\n${JSON.stringify(citations, null, 2)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const groqPayload = {
      model: env.GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessageContent },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    };

    const response = await fetch(env.GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(groqPayload),
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      const retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : 60;
      logger.warn({ retryAfter: retryAfterSec }, 'Groq API rate limit encountered');

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Groq API rate limit exceeded. Please retry shortly.',
        },
        data: {
          content: generateOfflineFallbackContent(sanitized, context),
          provider: 'offline',
          citations: citations ?? [],
          fallbackReason: 'Rate limit exceeded. Defaulted to offline fallback.',
          retryAfterSeconds: isNaN(retryAfterSec) ? 60 : retryAfterSec,
        },
      });
      return;
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      logger.error({ status: response.status, body: errorBody }, 'Groq API non-200 response');
      res.status(200).json({
        success: true,
        data: {
          content: generateOfflineFallbackContent(sanitized, context),
          provider: 'offline',
          citations: citations ?? [],
          fallbackReason: `Groq request returned status ${response.status}`,
        },
      });
      return;
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content?.trim() ?? '';

    res.status(200).json({
      success: true,
      data: {
        content,
        provider: 'groq',
        model: env.GROQ_MODEL,
        citations: citations ?? [],
      },
    });
  } catch (err) {
    const errorMsg = (err as Error).message;
    logger.warn({ error: errorMsg }, 'Error contacting Groq API; falling back to offline provider');

    res.status(200).json({
      success: true,
      data: {
        content: generateOfflineFallbackContent(sanitized, context),
        provider: 'offline',
        citations: citations ?? [],
        fallbackReason: `Groq connection failed (${errorMsg}). Defaulted to offline fallback.`,
      },
    });
  }
});
