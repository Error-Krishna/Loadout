import { useState } from 'react';

export interface TechniqueItem {
  id: string;
  name: string;
  category: 'Rendering' | 'Compute' | 'Streams' | 'Assets' | 'Storage';
  tagline: string;
  complexity: 'Low' | 'Medium' | 'High';
  domImpact: string;
  cpuImpact: string;
  whenToUse: string[];
  whenToAvoid: string[];
  codeTemplate: string;
}

export const TECHNIQUES: TechniqueItem[] = [
  {
    id: 'tech-virtualization',
    name: 'DOM Virtualization (Windowing)',
    category: 'Rendering',
    tagline: 'Mounts only the subset of DOM elements visible inside the active viewport.',
    complexity: 'Medium',
    domImpact: 'O(1) Constant (~30 nodes)',
    cpuImpact: 'Minimal (<16ms 60 FPS)',
    whenToUse: [
      'Tables or lists exceeding 1,000 items',
      'Infinite scroll feeds with heavy cell components',
      'Fixed or bounded height scroll containers',
    ],
    whenToAvoid: [
      'Short lists (< 100 items) where virtualizer overhead exceeds benefit',
      'Documents requiring native browser Ctrl+F searchability or print stylesheets',
      'Content where row heights cannot be measured or estimated',
    ],
    codeTemplate: `import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

export function VirtualList({ items }) {
  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: \`\${virtualizer.getTotalSize()}px\`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((vRow) => (
          <div
            key={vRow.index}
            style={{
              position: 'absolute',
              top: 0,
              transform: \`translateY(\${vRow.start}px)\`,
              height: \`\${vRow.size}px\`,
            }}
          >
            {items[vRow.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}`,
  },
  {
    id: 'tech-chunking',
    name: 'Progressive Chunking (Time-Slicing)',
    category: 'Rendering',
    tagline: 'Mounts DOM nodes in sequential batches across idle frames via requestIdleCallback.',
    complexity: 'Low',
    domImpact: 'O(N) Eventual Full DOM',
    cpuImpact: 'Zero Frame Freezing (Time-sliced)',
    whenToUse: [
      'Medium lists (200 - 10,000 rows) needing native browser Ctrl+F search',
      'Components without fixed scroll container heights',
      'Zero-dependency requirement without external npm packages',
    ],
    whenToAvoid: [
      'Extreme payloads (> 30,000 items) where total DOM nodes crash memory',
      'Views where instant scroll to bottom is required immediately on mount',
    ],
    codeTemplate: `export function useProgressiveChunking(items, chunkSize = 100) {
  const [mounted, setMounted] = useState(() => Math.min(items.length, chunkSize));

  useEffect(() => {
    let current = Math.min(items.length, chunkSize);
    let handle;
    const schedule = window.requestIdleCallback || ((cb) => setTimeout(cb, 16));

    const step = () => {
      current = Math.min(current + chunkSize, items.length);
      setMounted(current);
      if (current < items.length) handle = schedule(step);
    };

    if (current < items.length) handle = schedule(step);
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(handle) : clearTimeout(handle));
  }, [items, chunkSize]);

  return items.slice(0, mounted);
}`,
  },
  {
    id: 'tech-worker',
    name: 'Web Worker Compute Offloading',
    category: 'Compute',
    tagline: 'Executes CPU-heavy data parsing and search filtering off the browser main thread.',
    complexity: 'Medium',
    domImpact: 'No direct DOM access',
    cpuImpact: '0ms Main Thread Lock',
    whenToUse: [
      'Multi-column search filtering over 10,000+ items',
      'Large CSV/JSON parsing (> 2 MB payloads)',
      'Heavy math, data aggregation, or cryptographic hashing',
    ],
    whenToAvoid: [
      'Frequent tiny computations where postMessage structured clone serialization overhead dominates',
      'Tasks tightly coupled to DOM elements or layout metrics',
    ],
    codeTemplate: `// worker.ts
self.onmessage = (e) => {
  const { id, query, rows } = e.data;
  const lower = query.toLowerCase();
  const matchedIndices = [];

  rows.forEach((r, idx) => {
    if (String(r.name).toLowerCase().includes(lower)) {
      matchedIndices.push(idx);
    }
  });

  // Transfer row indices only to avoid large clone memory cost
  self.postMessage({ id, matchedIndices });
};`,
  },
  {
    id: 'tech-stream-batching',
    name: 'Real-Time Event Batching',
    category: 'Streams',
    tagline: 'Buffers high-frequency socket events and commits updates in 60 FPS frame batches.',
    complexity: 'Low',
    domImpact: 'Slashing renders by 90%+',
    cpuImpact: 'Prevents event-loop starvation',
    whenToUse: [
      'WebSockets or SSE receiving > 50 messages/sec',
      'Financial ticker feeds, sensor telemetry, and live analytics dashboards',
    ],
    whenToAvoid: [
      'Low-frequency event streams (< 2 events/sec) where batching adds unnecessary latency',
    ],
    codeTemplate: `// Ingest buffer
const bufferRef = useRef([]);

function onSocketMessage(event) {
  bufferRef.current.push(event.data);
}

// Flush batch once per frame or 100ms
useEffect(() => {
  const id = setInterval(() => {
    if (bufferRef.current.length === 0) return;
    const batch = bufferRef.current.splice(0, bufferRef.current.length);
    setLiveState((prev) => applyBatchUpdates(prev, batch));
  }, 100);
  return () => clearInterval(id);
}, []);`,
  },
  {
    id: 'tech-visual-coalescing',
    name: 'Visual State Coalescing',
    category: 'Streams',
    tagline: 'Collapses redundant intermediate updates by key, retaining only latest state.',
    complexity: 'Low',
    domImpact: 'Bound to unique entity count',
    cpuImpact: 'Minimal O(Keys) updates',
    whenToUse: [
      'Real-time status dashboards (sensors, crypto tickers, vehicle fleet tracking)',
      'Live metric charts where intermediate sub-second values are unobservable',
    ],
    whenToAvoid: [
      'Financial transaction logs, chat message feeds, or audit ledgers where dropping messages is forbidden',
    ],
    codeTemplate: `const coalescedMap = new Map();

function onTelemetry(sensorId, value) {
  // Overwrites intermediate reading with latest
  coalescedMap.set(sensorId, value);
}

function flushToUI() {
  const snapshot = Object.fromEntries(coalescedMap);
  coalescedMap.clear();
  setSensors(snapshot);
}`,
  },
  {
    id: 'tech-modern-image',
    name: 'Next-Gen Image Encodings & <picture>',
    category: 'Assets',
    tagline: 'Serves modern WebP / AVIF formats with responsive srcset delivery.',
    complexity: 'Low',
    domImpact: 'Constant',
    cpuImpact: 'Async off-thread decode',
    whenToUse: [
      'Marketing galleries, hero banners, and e-commerce product catalogs',
      'Reducing bandwidth on mobile and metered cellular connections',
    ],
    whenToAvoid: [
      'Dynamic images generated in real-time where server conversion cost exceeds bandwidth win',
    ],
    codeTemplate: `<picture>
  <source type="image/avif" srcset="/img/hero-360.avif 360w, /img/hero-720.avif 720w" sizes="(max-width: 640px) 100vw, 720px" />
  <source type="image/webp" srcset="/img/hero-360.webp 360w, /img/hero-720.webp 720w" sizes="(max-width: 640px) 100vw, 720px" />
  <img src="/img/hero.jpg" alt="Hero" width="720" height="480" loading="lazy" decoding="async" style="aspect-ratio: 720/480; width: 100%; height: auto;" />
</picture>`,
  },
  {
    id: 'tech-indexeddb',
    name: 'IndexedDB Offline Caching',
    category: 'Storage',
    tagline: 'Stores structured records, large arrays, and binary blobs across sessions.',
    complexity: 'Medium',
    domImpact: 'Zero',
    cpuImpact: 'Async background I/O',
    whenToUse: [
      'Datasets exceeding 5 MB that should survive browser refreshes',
      'Local-first applications and offline-capable data explorers',
    ],
    whenToAvoid: ['Tiny UI preferences (< 10 KB) where localStorage is simpler and synchronous'],
    codeTemplate: `// Open versioned DB
const request = indexedDB.open('loadout_cache', 1);
request.onupgradeneeded = (e) => {
  const db = e.target.result;
  if (!db.objectStoreNames.contains('datasets')) {
    db.createObjectStore('datasets', { keyPath: 'id' });
  }
};`,
  },
];

export default function TechniqueLibraryView() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeTechnique, setActiveTechnique] = useState<TechniqueItem>(TECHNIQUES[0]!);
  const [copied, setCopied] = useState(false);

  const categories = ['All', 'Rendering', 'Compute', 'Streams', 'Assets', 'Storage'];

  const filtered = TECHNIQUES.filter((t) => {
    const matchesCat = selectedCategory === 'All' || t.category === selectedCategory;
    const matchesQuery =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.tagline.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesQuery;
  });

  function handleCopy() {
    navigator.clipboard.writeText(activeTechnique.codeTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <div>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
            Knowledge Base • Architecture Catalog
          </span>
          <h2 className="text-lg font-bold text-slate-100">
            Frontend Optimization Technique Library
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            Proven optimization patterns, trade-off matrices, and production-ready implementation
            templates.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto font-mono text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded transition-colors ${
                selectedCategory === cat
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter techniques by name or concept..."
          className="w-full md:w-72 px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
        />
      </div>

      {/* 2-Column Catalog & Deep-Dive View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Technique Cards List */}
        <div className="lg:col-span-5 space-y-3">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTechnique(item)}
              className={`w-full p-4 rounded-lg border text-left transition-all ${
                activeTechnique.id === item.id
                  ? 'border-cyan-500/80 bg-gradient-to-r from-cyan-950/40 to-slate-900 ring-1 ring-cyan-500/30'
                  : 'border-slate-800 bg-[var(--color-surface)] hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                  {item.category}
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Complexity:{' '}
                  <strong className="text-slate-300 font-normal">{item.complexity}</strong>
                </span>
              </div>
              <h3 className="font-semibold text-sm text-slate-100">{item.name}</h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                {item.tagline}
              </p>
            </button>
          ))}

          {filtered.length === 0 && (
            <p className="text-center py-8 text-xs font-mono text-slate-500">
              No techniques match your filter criteria.
            </p>
          )}
        </div>

        {/* Right: Technique Deep-Dive Dossier */}
        <div className="lg:col-span-7 p-6 rounded-lg border border-slate-800 bg-[var(--color-surface)] space-y-5">
          <div className="border-b border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                {activeTechnique.category} Architecture Dossier
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Complexity: {activeTechnique.complexity}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-100 mt-1">{activeTechnique.name}</h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{activeTechnique.tagline}</p>

            <div className="grid grid-cols-2 gap-3 mt-4 text-xs font-mono">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] uppercase">DOM Overhead</span>
                <span className="text-emerald-400 font-bold">{activeTechnique.domImpact}</span>
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] uppercase">
                  Main Thread Impact
                </span>
                <span className="text-cyan-400 font-bold">{activeTechnique.cpuImpact}</span>
              </div>
            </div>
          </div>

          {/* When to use vs When to avoid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded border border-emerald-900/40 bg-emerald-950/10 space-y-2">
              <span className="font-mono text-emerald-400 font-bold uppercase text-[11px]">
                ✓ Ideal Fit Scenarios
              </span>
              <ul className="text-slate-300 space-y-1 list-disc pl-4">
                {activeTechnique.whenToUse.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded border border-amber-900/40 bg-amber-950/10 space-y-2">
              <span className="font-mono text-amber-400 font-bold uppercase text-[11px]">
                ⚠️ When to Avoid
              </span>
              <ul className="text-slate-300 space-y-1 list-disc pl-4">
                {activeTechnique.whenToAvoid.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Code Template */}
          <div className="border border-slate-800 bg-slate-950 rounded-lg overflow-hidden">
            <div className="border-b border-slate-800 px-4 py-2 bg-slate-900 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-semibold">
                Production Implementation Template
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy Code'}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-72">
              <code>{activeTechnique.codeTemplate}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
