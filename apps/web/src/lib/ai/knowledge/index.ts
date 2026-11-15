/**
 * LOADOUT Version 2.0 — Curated Engineering RAG Knowledge Base
 *
 * Contains peer-reviewed performance engineering knowledge chunks with verifiable citations.
 * Supports fast in-browser BM25/keyword retrieval with zero network transmission.
 */

import type { KnowledgeDocChunk, AICitation } from '../../../types/ai.ts';

export const CURATED_KNOWLEDGE_CHUNKS: KnowledgeDocChunk[] = [
  {
    id: 'kb_virt_01',
    docId: 'dom-virtualization',
    title: 'DOM Virtualization & Windowing',
    section: 'Core Architecture',
    tags: ['virtualization', 'dom', 'tanstack-virtual', 'tables', 'rendering', 'scroll'],
    content:
      'DOM virtualization (windowing) only renders items currently visible inside the viewport plus a small buffer (overscan). Instead of mounting 25,000 DOM rows (which causes severe style recalculation and layout thrashing), the workbench mounts ~30-50 nodes in O(1) constant time, reducing memory and render latency by over 95%.',
    url: 'https://tanstack.com/virtual/latest',
  },
  {
    id: 'kb_virt_02',
    docId: 'dom-virtualization',
    title: 'Virtualization Trade-Offs & Gotchas',
    section: 'Engineering Trade-Offs',
    tags: ['virtualization', 'tradeoffs', 'search', 'ctrl-f', 'accessibility', 'keyboard'],
    content:
      'Virtualization introduces three critical trade-offs: 1. Native browser Ctrl+F search only finds mounted DOM elements; full-text search requires an in-app search input with scroll-to-index. 2. Variable dynamic row heights require measureElement ref callbacks rather than fixed height assumptions. 3. Keyboard focus preservation requires managing focus state as items mount and unmount.',
    url: 'https://tanstack.com/virtual/latest/docs/guide/introduction',
  },
  {
    id: 'kb_worker_01',
    docId: 'web-workers',
    title: 'Web Workers & Structured Cloning Overhead',
    section: 'Worker Architecture',
    tags: ['workers', 'web-worker', 'threading', 'filter', 'search', 'postmessage'],
    content:
      'Offloading heavy dataset filtering to a Web Worker keeps the UI thread at 60 FPS. However, sending large dataset objects across postMessage incurs structured cloning serialization overhead on the main thread. To achieve zero-overhead queries, initialize the worker with the dataset once on "init", and dispatch lightweight search strings on "filter".',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers',
  },
  {
    id: 'kb_worker_02',
    docId: 'web-workers',
    title: 'Transferable Objects in Web Workers',
    section: 'Zero-Copy Transfers',
    tags: ['workers', 'arraybuffer', 'transferable', 'zero-copy', 'memory'],
    content:
      'For binary data (such as raw file slices or typed arrays), transferring ArrayBuffer ownership across postMessage achieves true zero-copy communication without memory duplication or structured cloning pause time.',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects',
  },
  {
    id: 'kb_mem_01',
    docId: 'memory-and-gc',
    title: 'V8 Heap Allocation & Garbage Collection Pauses',
    section: 'Memory Management',
    tags: ['memory', 'v8', 'gc', 'garbage-collection', 'heap', 'leaks'],
    content:
      'Large object allocations trigger frequent V8 major garbage collection cycles (Mark-Sweep-Compact), freezing the main thread for 10-80ms. Keeping heap allocations within a bounded 50MB ceiling and reusing object shapes avoids major GC latency spikes.',
    url: 'https://v8.dev/blog/trash-talk',
  },
  {
    id: 'kb_mem_02',
    docId: 'memory-and-gc',
    title: 'Detached DOM Tree Retention',
    section: 'Memory Leaks',
    tags: ['memory', 'dom', 'detached-nodes', 'event-listeners', 'leak'],
    content:
      'Detached DOM nodes occur when elements removed from the document tree are still referenced by JavaScript closures, event handlers, or caches. Always clean up event listeners, abort controllers, and object URLs (URL.revokeObjectURL) upon unmount.',
    url: 'https://developer.chrome.com/docs/devtools/memory-problems',
  },
  {
    id: 'kb_stream_01',
    docId: 'streaming-backpressure',
    title: 'Visual Coalescing vs Transactional Auditing',
    section: 'Stream Ingestion',
    tags: ['streaming', 'coalescing', 'batching', 'backpressure', 'telemetry', 'gauges'],
    content:
      'For live monitoring dashboards and sensor feeds, intermediate value updates occurring within the same 16ms animation frame are imperceptible to human vision. Coalescing updates to the latest reading per key is visually lossless and slashes React render cascades by 90%+. For financial or audit streams, visual coalescing is unsafe; bounded ring buffers with sequence ordering must be used.',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/Streams_API',
  },
  {
    id: 'kb_stream_02',
    docId: 'streaming-backpressure',
    title: 'Bounded Backpressure Queue Design',
    section: 'Backpressure Mechanisms',
    tags: ['streaming', 'bounded-queue', 'drop-policy', 'backpressure', 'overflow'],
    content:
      'When high-velocity socket events exceed consumer processing capacity, unbound memory queues cause inevitable tab crashes. A bounded queue (e.g. 200 items) enforces explicit drop accounting (dropping oldest items or rejecting incoming bursts) to guarantee memory stability.',
    url: 'https://web.dev/articles/streams',
  },
  {
    id: 'kb_bench_01',
    docId: 'benchmarking-rigor',
    title: 'Statistical Reliability & Warmup Cycles',
    section: 'Controlled Measurement',
    tags: ['benchmark', 'warmup', 'statistics', 'v8', 'jit', 'turbofan', 'variance'],
    content:
      'Modern JavaScript engines (V8, JavaScriptCore) rely on tiered JIT compilation. Initial iterations run via bytecode interpreters (Ignition) and trigger deoptimizations. Always execute 2+ warmup runs outside the timed interval to allow TurboFan optimization to stabilize before recording measured trials.',
    url: 'https://v8.dev/docs/turbofan',
  },
  {
    id: 'kb_bench_02',
    docId: 'benchmarking-rigor',
    title: 'Sample Size & Tail-Latency Integrity',
    section: 'Tail Latency Caveats',
    tags: ['benchmark', 'p95', 'p99', 'sample-size', 'confidence', 'outliers', 'iqr'],
    content:
      'Five iterations are sufficient for detecting major median improvements (>3x speedup), but are mathematically insufficient for strong P95 or P99 tail-latency claims. A minimum of N=30 measured iterations is required for statistically sound tail latency analysis. Always flag small sample sizes to avoid deceptive precision.',
    url: 'https://en.wikipedia.org/wiki/Sample_size_determination',
  },
  {
    id: 'kb_bench_03',
    docId: 'benchmarking-rigor',
    title: 'The Correctness Gate Principle',
    section: 'Output Verification',
    tags: ['benchmark', 'correctness', 'validation', 'parity', 'hashing'],
    content:
      'A candidate implementation that executes 10x faster but drops records, corrupts types, or violates null semantics is an engineering regression, not an optimization. Benchmark verdicts must verify correctness before certifying improvements. If correctness fails, the benchmark verdict is invalidated.',
    url: 'https://github.com/Error-Krishna/Loadout',
  },
];

/**
 * Tokenizes text into lowercase normalized terms.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

interface PreprocessedDocument {
  chunk: KnowledgeDocChunk;
  tokens: string[];
  tokenCounts: Map<string, number>;
  length: number;
}

// Pre-calculate document lengths and token frequencies for BM25
const PREPROCESSED_DOCS: PreprocessedDocument[] = CURATED_KNOWLEDGE_CHUNKS.map((chunk) => {
  // Title and tags are given additional term frequency weight (2x)
  const titleTokens = tokenize(chunk.title);
  const tagTokens = tokenize(chunk.tags.join(' '));
  const sectionTokens = tokenize(chunk.section);
  const contentTokens = tokenize(chunk.content);

  const weightedTokens: string[] = [
    ...titleTokens,
    ...titleTokens,
    ...tagTokens,
    ...tagTokens,
    ...sectionTokens,
    ...contentTokens,
  ];

  const tokenCounts = new Map<string, number>();
  for (const t of weightedTokens) {
    tokenCounts.set(t, (tokenCounts.get(t) ?? 0) + 1);
  }

  return {
    chunk,
    tokens: weightedTokens,
    tokenCounts,
    length: weightedTokens.length,
  };
});

const TOTAL_DOCS = PREPROCESSED_DOCS.length;
const AVG_DOC_LENGTH =
  TOTAL_DOCS > 0 ? PREPROCESSED_DOCS.reduce((acc, d) => acc + d.length, 0) / TOTAL_DOCS : 1;

/**
 * Calculates Robertson-Spärck Jones BM25 Inverse Document Frequency (IDF).
 * IDF(q) = ln( (N - n(q) + 0.5) / (n(q) + 0.5) + 1 )
 */
function calculateIdf(term: string): number {
  let docCount = 0;
  for (const doc of PREPROCESSED_DOCS) {
    if (doc.tokenCounts.has(term)) {
      docCount++;
    }
  }
  if (docCount === 0) return 0;
  return Math.log((TOTAL_DOCS - docCount + 0.5) / (docCount + 0.5) + 1);
}

/**
 * In-browser BM25 lexical retriever for the curated knowledge base.
 *
 * Mathematical Parameters:
 * - k1 = 1.2 (controls term frequency saturation)
 * - b = 0.75 (controls document length normalization penalty)
 */
export function queryKnowledgeBase(
  query: string,
  maxResults = 3,
  options: { k1?: number; b?: number } = {},
): { chunk: KnowledgeDocChunk; score: number }[] {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const { k1 = 1.2, b = 0.75 } = options;
  const queryTerms = tokenize(query);

  if (queryTerms.length === 0) {
    return [];
  }

  const scored = PREPROCESSED_DOCS.map((doc) => {
    let score = 0;

    for (const term of queryTerms) {
      const tf = doc.tokenCounts.get(term) ?? 0;
      if (tf > 0) {
        const idf = calculateIdf(term);
        // BM25 term score formula with document length normalization
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (doc.length / AVG_DOC_LENGTH));
        score += idf * (numerator / denominator);
      }
    }

    return { chunk: doc.chunk, score: Math.round(score * 1000) / 1000 };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * Converts knowledge chunks into citations.
 */
export function createCitations(
  results: { chunk: KnowledgeDocChunk; score: number }[],
): AICitation[] {
  return results.map(({ chunk }) => ({
    sourceId: chunk.id,
    title: chunk.title,
    section: chunk.section,
    url: chunk.url,
    excerpt: chunk.content.slice(0, 160) + '...',
  }));
}

/**
 * Validates citations against verified knowledge base chunk IDs, filtering out hallucinated references.
 */
export function validateCitations(
  citations: AICitation[],
  allowedChunkIds?: Set<string>,
): AICitation[] {
  const allowed = allowedChunkIds ?? new Set(CURATED_KNOWLEDGE_CHUNKS.map((c) => c.id));
  return citations.filter((c) => c && c.sourceId && allowed.has(c.sourceId));
}
