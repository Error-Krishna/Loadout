/**
 * LOADOUT Version 2.0 — AI Provider Implementations
 *
 * Provides:
 * 1. OfflineAIProvider: Purely local heuristic performance engineering engine (Zero network egress).
 * 2. OpenAIProvider: Optional cloud integration with sanitized prompt payloads.
 * 3. GeminiProvider: Optional Google Gemini integration with sanitized prompt payloads.
 */

import type {
  AIProviderType,
  SanitizedAIContext,
  AICitation,
  AISuggestedAction,
} from '../../../types/ai.ts';
import { queryKnowledgeBase, createCitations } from '../knowledge/index.ts';

export interface AIProvider {
  id: AIProviderType;
  name: string;
  isLocal: boolean;
  generateResponse(
    userPrompt: string,
    context: SanitizedAIContext,
  ): Promise<{
    content: string;
    citations?: AICitation[];
    suggestedActions?: AISuggestedAction[];
  }>;
}

/**
 * Purely local, zero-network performance engineering assistant.
 * Analyzes benchmark results, performs RAG retrieval, and generates optimization advice.
 */
export class OfflineAIProvider implements AIProvider {
  id: AIProviderType = 'offline';
  name = 'LOADOUT Local Heuristic Copilot (Zero Egress)';
  isLocal = true;

  async generateResponse(
    userPrompt: string,
    context: SanitizedAIContext,
  ): Promise<{
    content: string;
    citations?: AICitation[];
    suggestedActions?: AISuggestedAction[];
  }> {
    const promptLower = userPrompt.toLowerCase();

    // 1. Knowledge Base RAG Search
    const searchResults = queryKnowledgeBase(userPrompt, 3);
    const citations = createCitations(searchResults);

    // 2. Specific intent: Interpret Benchmark
    if (
      promptLower.includes('benchmark') ||
      promptLower.includes('interpret') ||
      promptLower.includes('result') ||
      promptLower.includes('performance')
    ) {
      if (context.benchmarkSummary) {
        const b = context.benchmarkSummary;
        const speedup = Math.abs(b.delta.medianDurationChangePct);
        const domSaved = Math.abs(b.delta.domNodesChangePct);
        const isFaster = b.verdict === 'improved';
        const isInvalid = b.verdict === 'invalid' || b.correctness.status === 'failed';

        let interpretation = `### 🔬 Benchmark Technical Evaluation: \`${b.workloadName}\`\n\n`;

        if (isInvalid) {
          interpretation += `> ⚠️ **VERDICT: INVALIDATED OPTIMIZATION**\n`;
          interpretation += `> The candidate variant failed the semantic Correctness Gate (status: \`${b.correctness.status}\`). Although it may have executed differently, output integrity was corrupted. Optimizations that compromise correctness cannot be deployed.\n\n`;
        } else if (isFaster) {
          interpretation += `> ✅ **VERDICT: CONFIRMED SPEEDUP (${speedup.toFixed(1)}% faster)**\n\n`;
        } else {
          interpretation += `> ℹ️ **VERDICT: ${b.verdict.toUpperCase()}**\n\n`;
        }

        interpretation += `#### 📊 Measured Metrics (Monotonic Clock):\n`;
        interpretation += `- **Execution Time (Median):** ${b.baseline.medianMs} ms [Baseline] → **${b.candidate.medianMs} ms** [Candidate] (**${b.delta.medianDurationMs > 0 ? '+' : ''}${b.delta.medianDurationMs.toFixed(1)} ms**)\n`;
        interpretation += `- **Mounted DOM Elements:** ${b.baseline.domNodes.toLocaleString()} nodes → **${b.candidate.domNodes.toLocaleString()} nodes** (**-${domSaved.toFixed(1)}% reduction**)\n`;
        interpretation += `- **Sample Size:** ${b.candidate.sampleCount} measured iterations (${b.baseline.sampleCount} baseline)\n`;
        interpretation += `- **Semantic Correctness:** ${b.correctness.status.toUpperCase()} (Record count: ${b.correctness.recordCountParity ? '✓' : '✗'}, Schema: ${b.correctness.schemaParity ? '✓' : '✗'})\n\n`;

        interpretation += `#### 🔍 Engineering Assessment:\n`;
        if (b.candidate.domNodes < 100 && b.baseline.domNodes > 500) {
          interpretation += `The candidate effectively shifts DOM scaling from $O(N)$ linear growth to $O(1)$ constant time by employing row windowing. This eliminates main-thread style recalculation thrashing during scroll events.\n\n`;
        }

        if (b.candidate.sampleCount < 30) {
          interpretation += `> ⚠️ **Statistical Confidence Notice:** This run used **${b.candidate.sampleCount} iterations**. While adequate for demonstrating a major median improvement, N=${b.candidate.sampleCount} is insufficient for rigorous P95/P99 tail-latency SLA claims (minimum N=30 recommended).\n\n`;
        }

        interpretation += `#### ⚖️ Verified Architectural Trade-Offs:\n`;
        interpretation += `- **Browser In-Page Search:** Native \`Ctrl+F\` only matches currently mounted DOM nodes. Implement an application-level search index or virtualized scroll-to-match.\n`;
        interpretation += `- **Dynamic Row Heights:** Dynamic variable content requires continuous \`measureElement\` ref tracking.\n`;

        return {
          content: interpretation,
          citations,
          suggestedActions: [
            {
              id: 'act_export_report',
              label: 'Export Benchmark Dossier to JSON',
              actionType: 'export-report',
            },
            {
              id: 'act_switch_implement',
              label: 'View Implementation Code Guide',
              actionType: 'switch-view',
              payload: { step: 'implement' },
            },
          ],
        };
      }
    }

    // 3. Specific intent: Plan Experiment
    if (
      promptLower.includes('plan') ||
      promptLower.includes('experiment') ||
      promptLower.includes('recommend') ||
      promptLower.includes('test')
    ) {
      let planText = `### 📋 Controlled Experiment Plan\n\n`;
      planText += `**Hypothesis:** Replacing unwindowed full-table DOM mounting with virtualized windowing will bound mounted elements to ~40 nodes and reduce first-render latency by >90% on datasets exceeding 5,000 rows.\n\n`;
      planText += `#### 🧪 Experiment Configuration:\n`;
      planText += `- **Baseline Variant:** Unwindowed Naive Table (all rows mapped directly to \`<tr>\` elements)\n`;
      planText += `- **Candidate Variant:** Windowed Virtual Table (\`@tanstack/react-virtual\` with 5-row overscan)\n`;
      planText += `- **Execution Policy:** 2 warmup iterations, 5 measured iterations, 5000ms iteration timeout\n`;
      planText += `- **Verification Gate:** Canonical correctness verification (record count, field types, null semantics)\n\n`;
      planText += `#### 🎯 Success Criteria:\n`;
      planText += `1. Candidate median render time < 25 ms\n`;
      planText += `2. Mounted DOM node count ≤ 60 nodes regardless of total dataset size\n`;
      planText += `3. Correctness gate status = \`passed\`\n`;

      return {
        content: planText,
        citations,
        suggestedActions: [
          {
            id: 'act_run_experiment',
            label: 'Authorize and Run Experiment in Performance Lab',
            actionType: 'run-experiment',
          },
        ],
      };
    }

    // 4. Default: RAG-augmented performance answer
    let responseText = '';
    if (searchResults.length > 0) {
      const top = searchResults[0]!.chunk;
      responseText += `### ${top.title}\n\n`;
      responseText += `${top.content}\n\n`;

      if (searchResults.length > 1) {
        responseText += `#### Related Performance Principles:\n`;
        for (let i = 1; i < searchResults.length; i++) {
          const c = searchResults[i]!.chunk;
          responseText += `- **${c.title} (${c.section}):** ${c.content.slice(0, 180)}...\n`;
        }
        responseText += `\n`;
      }
    } else {
      responseText = `LOADOUT Performance Copilot analyzes web application efficiency, DOM scaling, Web Worker threading, memory allocation, and statistical benchmark results.\n\n`;
      responseText += `You can ask me to:\n`;
      responseText += `- **"Interpret benchmark results"** to evaluate speedups, tail latency, and correctness.\n`;
      responseText += `- **"Plan an optimization experiment"** to configure baseline vs candidate trials.\n`;
      responseText += `- Inquire about TanStack Virtual, Web Worker structured cloning, or V8 memory ceilings.\n`;
    }

    return {
      content: responseText,
      citations,
    };
  }
}

/**
 * Optional Cloud AI Provider for OpenAI-compatible endpoints.
 * Operates strictly with sanitized contexts when user provides an API key.
 */
export class OpenAIProvider implements AIProvider {
  id: AIProviderType = 'openai';
  name = 'OpenAI Compatible Provider (Sanitized Egress)';
  isLocal = false;
  private apiKey: string;
  private endpoint: string;
  private model: string;
  private offlineFallback: OfflineAIProvider;

  constructor(apiKey: string, endpoint = 'https://api.openai.com/v1/chat/completions', model = 'gpt-4o-mini') {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.model = model;
    this.offlineFallback = new OfflineAIProvider();
  }

  async generateResponse(
    userPrompt: string,
    context: SanitizedAIContext,
  ): Promise<{
    content: string;
    citations?: AICitation[];
    suggestedActions?: AISuggestedAction[];
  }> {
    if (!this.apiKey) {
      return this.offlineFallback.generateResponse(userPrompt, context);
    }

    try {
      const payload = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are the Senior Performance Engineering Copilot for LOADOUT. ' +
              'You evaluate web performance benchmarks, statistical distributions, and memory trade-offs. ' +
              'Never hallucinate metrics; cite exact numbers from the provided sanitized benchmark summary.',
          },
          {
            role: 'user',
            content: `User Question: ${userPrompt}\n\nSanitized Context: ${JSON.stringify(context, null, 2)}`,
          },
        ],
        temperature: 0.2,
      };

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`OpenAI request returned status ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? '';
      const citations = createCitations(queryKnowledgeBase(userPrompt, 2));

      return {
        content,
        citations,
      };
    } catch {
      // Gracefully fall back to local offline provider on network or key errors
      return this.offlineFallback.generateResponse(userPrompt, context);
    }
  }
}

/**
 * Optional Google Gemini Provider.
 * Operates strictly with sanitized contexts.
 */
export class GeminiProvider implements AIProvider {
  id: AIProviderType = 'gemini';
  name = 'Google Gemini Provider (Sanitized Egress)';
  isLocal = false;
  private apiKey: string;
  private offlineFallback: OfflineAIProvider;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.offlineFallback = new OfflineAIProvider();
  }

  async generateResponse(
    userPrompt: string,
    context: SanitizedAIContext,
  ): Promise<{
    content: string;
    citations?: AICitation[];
    suggestedActions?: AISuggestedAction[];
  }> {
    if (!this.apiKey) {
      return this.offlineFallback.generateResponse(userPrompt, context);
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              {
                text:
                  `You are LOADOUT's Senior Performance Copilot. Answer based strictly on this verified performance context:\n` +
                  `Context: ${JSON.stringify(context, null, 2)}\n\nUser Question: ${userPrompt}`,
              },
            ],
          },
        ],
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Gemini API returned status ${res.status}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const citations = createCitations(queryKnowledgeBase(userPrompt, 2));

      return {
        content: text,
        citations,
      };
    } catch {
      return this.offlineFallback.generateResponse(userPrompt, context);
    }
  }
}

/**
 * Creates the appropriate AIProvider based on user settings and active mode.
 */
export function createAIProvider(
  mode: 'offline' | 'cloud-opt-in',
  providerType: AIProviderType = 'offline',
  apiKey?: string,
): AIProvider {
  if (mode === 'offline' || !apiKey) {
    return new OfflineAIProvider();
  }

  if (providerType === 'gemini') {
    return new GeminiProvider(apiKey);
  }

  if (providerType === 'openai') {
    return new OpenAIProvider(apiKey);
  }

  return new OfflineAIProvider();
}
