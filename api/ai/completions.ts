export const config = {
  runtime: 'edge',
};

interface AiBenchmarkSummary {
  workloadName: string;
  verdict: 'improved' | 'regressed' | 'inconclusive' | 'no-difference' | 'invalid';
  baseline: { medianMs: number; domNodes: number };
  candidate: { medianMs: number; domNodes: number; sampleCount: number };
  delta: {
    medianDurationMs: number;
    medianDurationChangePct: number;
    domNodesDelta: number;
    domNodesChangePct: number;
  };
  correctness: {
    passed: boolean;
    status: 'passed' | 'failed' | 'not-run';
    divergenceSummary?: string;
  };
}

interface AiCompletionPayload {
  prompt?: string;
  context?: {
    benchmarkSummary?: AiBenchmarkSummary;
    currentView?: string;
    datasetProfile?: {
      rowCount: number;
      columnCount: number;
      estimatedSizeMb: number;
    };
  };
  citations?: Array<{
    id: string;
    title: string;
    section: string;
    url: string;
  }>;
}

function sanitizePrompt(prompt: string): string {
  return prompt
    .replace(/<\|im_start\|>|<\|im_end\|>/gi, '')
    .replace(/\[INST\]|\[\/INST\]/gi, '')
    .replace(/<<SYS>>|<\/SYS>>/gi, '')
    .trim();
}

function generateOfflineFallbackContent(
  prompt: string,
  context?: AiCompletionPayload['context'],
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

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: AiCompletionPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INVALID_JSON', message: 'Malformed JSON payload' },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { prompt, context, citations } = body;
  if (!prompt || typeof prompt !== 'string') {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Field "prompt" is required and must be a string',
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const sanitized = sanitizePrompt(prompt);
  const groqApiKey = process.env.GROQ_API_KEY;
  const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const groqEndpoint =
    process.env.GROQ_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions';

  // If no Groq API key is configured in environment, return heuristic offline fallback
  if (!groqApiKey) {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          content: generateOfflineFallbackContent(sanitized, context),
          provider: 'offline',
          citations: citations ?? [],
          fallbackReason:
            'GROQ_API_KEY is not configured in Vercel environment variables. Defaulted to local offline heuristics.',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
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
      model: groqModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessageContent },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    };

    const response = await fetch(groqEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify(groqPayload),
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 429) {
      return new Response(
        JSON.stringify({
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
          },
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            content: generateOfflineFallbackContent(sanitized, context),
            provider: 'offline',
            citations: citations ?? [],
            fallbackReason: `Groq upstream responded with status ${response.status}. Defaulted to offline fallback.`,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const data = await response.json();
    const content =
      data?.choices?.[0]?.message?.content ?? generateOfflineFallbackContent(sanitized, context);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          content,
          provider: 'groq',
          model: groqModel,
          citations: citations ?? [],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          content: generateOfflineFallbackContent(sanitized, context),
          provider: 'offline',
          citations: citations ?? [],
          fallbackReason: 'Network error communicating with Groq. Defaulted to offline fallback.',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
