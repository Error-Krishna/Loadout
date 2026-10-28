import { useState } from 'react';
import type { LoadedDataset, ChecklistItem } from '../../types/dataset';

interface DatasetImplementationGuideProps {
  dataset: LoadedDataset;
  onProceedToReport: () => void;
  onBackToCompare: () => void;
}

type GuideTab = 'virtualization' | 'chunking' | 'worker';

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'max-payload',
    category: 'performance',
    label: 'Stress-tested with peak production payload',
    description:
      'Verified scrolling and filtering under 25,000+ items without memory leak or frame stutter.',
  },
  {
    id: 'keyboard-nav',
    category: 'accessibility',
    label: 'Keyboard accessibility & focus preservation',
    description:
      'Ensure tab navigation remains predictable when rows mount and unmount dynamically.',
  },
  {
    id: 'search-filter',
    category: 'correctness',
    label: 'External search bar provided for Ctrl+F parity',
    description:
      'Since unrendered virtual rows cannot be searched by browser Ctrl+F, provide an in-app query input.',
  },
  {
    id: 'unmount-cleanup',
    category: 'correctness',
    label: 'Lifecycle cleanup on route navigation',
    description:
      'Confirm scroll listeners, workers, and idle timers release memory when leaving the view.',
  },
];

const CODE_TEMPLATES: Record<
  GuideTab,
  {
    title: string;
    subtitle: string;
    filename: string;
    installCmd: string;
    code: string;
    gotchas: { label: string; title: string; desc: string; color: string }[];
  }
> = {
  virtualization: {
    title: 'DOM Virtualization (TanStack Virtual)',
    subtitle: 'Mounts only rows visible in the viewport, achieving constant O(1) DOM footprint.',
    filename: 'src/components/VirtualTable.tsx',
    installCmd: 'pnpm add @tanstack/react-virtual',
    code: `import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualTableProps<T> {
  data: T[];
  columns: { key: keyof T; header: string }[];
}

export function VirtualTable<T>({ data, columns }: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // 1. Initialize Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36, // default row height in px
    overscan: 5,             // buffer rows above/below viewport
  });

  return (
    <div
      ref={parentRef}
      style={{ height: '500px', overflow: 'auto', position: 'relative' }}
      tabIndex={0}
      aria-label="Virtualized Data Table"
    >
      <div
        style={{
          height: \`\${rowVirtualizer.getTotalSize()}px\`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = data[virtualRow.index];
          if (!row) return null;

          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: \`\${virtualRow.size}px\`,
                transform: \`translateY(\${virtualRow.start}px)\`,
              }}
              className="flex items-center border-b border-slate-800"
            >
              {columns.map((col) => (
                <div key={String(col.key)} className="flex-1 px-3 py-1.5 truncate">
                  {String(row[col.key] ?? '')}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}`,
    gotchas: [
      {
        label: '1. Browser Ctrl+F',
        title: 'Off-Screen Searching',
        desc: "Because unrendered rows are absent from the DOM, browser Ctrl+F won't find them. Provide an in-app query input.",
        color: 'text-amber-400',
      },
      {
        label: '2. Dynamic Heights',
        title: 'Variable Row Content',
        desc: 'If table cells wrap dynamically, pass ref={rowVirtualizer.measureElement} to each row element.',
        color: 'text-cyan-400',
      },
      {
        label: '3. Keyboard Focus',
        title: 'Focus Preservation',
        desc: 'When users tab through rows, scrolling can unmount the focused element. Maintain the active focused row index in state.',
        color: 'text-emerald-400',
      },
    ],
  },
  chunking: {
    title: 'Progressive Chunking (Time-Slicing)',
    subtitle:
      'Mounts rows non-blockingly across idle frames via requestIdleCallback. Preserves full DOM presence without UI lock.',
    filename: 'src/hooks/useProgressiveChunking.ts',
    installCmd: 'Native Browser API (Zero Dependencies)',
    code: `import { useState, useEffect, useMemo } from 'react';

interface UseProgressiveChunkingOptions {
  chunkSize?: number;
}

export function useProgressiveChunking<T>(items: T[], options?: UseProgressiveChunkingOptions) {
  const chunkSize = options?.chunkSize ?? 100;
  const [mountedCount, setMountedCount] = useState<number>(() => Math.min(items.length, chunkSize));

  useEffect(() => {
    let currentMounted = Math.min(items.length, chunkSize);
    let idleHandle: number;

    const schedule = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback
      : (cb: () => void) => window.setTimeout(cb, 16);

    const cancel = typeof window.cancelIdleCallback === 'function'
      ? window.cancelIdleCallback
      : (h: number) => window.clearTimeout(h);

    const step = () => {
      currentMounted = Math.min(currentMounted + chunkSize, items.length);
      setMountedCount(currentMounted);
      if (currentMounted < items.length) {
        idleHandle = schedule(step);
      }
    };

    if (currentMounted < items.length) {
      idleHandle = schedule(step);
    }

    return () => cancel(idleHandle);
  }, [items, chunkSize]);

  return useMemo(() => items.slice(0, mountedCount), [items, mountedCount]);
}`,
    gotchas: [
      {
        label: '1. Native Ctrl+F',
        title: 'Full DOM Searchability',
        desc: 'Unlike virtualization, all rows are eventually placed in the DOM, making them searchable by browser Ctrl+F and printable.',
        color: 'text-emerald-400',
      },
      {
        label: '2. Total DOM Footprint',
        title: 'Memory Accumulation',
        desc: 'Eventually all elements reside in the DOM. Recommended for datasets up to 10,000 items; use virtualization beyond that.',
        color: 'text-amber-400',
      },
      {
        label: '3. Cancellation on Prop Change',
        title: 'Stream Invalidation',
        desc: 'Always clear previous idle handles when items change mid-stream to avoid interleaving stale chunks.',
        color: 'text-cyan-400',
      },
    ],
  },
  worker: {
    title: 'Web Worker Search Offloading',
    subtitle:
      'Executes CPU-intensive multi-column search on a background thread with sequence ID request cancellation.',
    filename: 'src/workers/filter.worker.ts',
    installCmd: 'Vite Native Worker Bundling (Zero Dependencies)',
    code: `// 1. Worker Implementation (filter.worker.ts)
self.onmessage = (e: MessageEvent) => {
  const { id, query, rows, columns } = e.data;
  const start = performance.now();
  const lowerQuery = query.toLowerCase();
  const matchedIndices: number[] = [];

  rows.forEach((row: Record<string, unknown>, idx: number) => {
    for (let i = 0; i < columns.length; i++) {
      const val = row[columns[i]];
      if (val !== null && val !== undefined && String(val).toLowerCase().includes(lowerQuery)) {
        matchedIndices.push(idx);
        break;
      }
    }
  });

  // Transfer only matching row indices (minimizes structured clone overhead)
  self.postMessage({
    id,
    filteredIndices: matchedIndices,
    durationMs: Number((performance.now() - start).toFixed(2)),
  });
};

// 2. React Instantiation with Vite
const worker = new Worker(
  new URL('./filter.worker.ts', import.meta.url),
  { type: 'module' }
);`,
    gotchas: [
      {
        label: '1. Structured Clone',
        title: 'Transfer Overhead',
        desc: 'Do not transfer full row objects back over postMessage. Return only number[] indices to keep IPC latency < 1ms.',
        color: 'text-emerald-400',
      },
      {
        label: '2. Stale Results',
        title: 'Keystroke Race Conditions',
        desc: 'Assign an incrementing sequence ID to each request. Discard responses if their ID does not match the latest request.',
        color: 'text-cyan-400',
      },
      {
        label: '3. Lifecycle Termination',
        title: 'Worker Cleanup',
        desc: 'Always call worker.terminate() inside useEffect cleanup to avoid memory leaks when components unmount.',
        color: 'text-amber-400',
      },
    ],
  },
};

export default function DatasetImplementationGuide({
  dataset,
  onProceedToReport,
  onBackToCompare,
}: DatasetImplementationGuideProps) {
  const [activeTab, setActiveTab] = useState<GuideTab>('virtualization');
  const [copied, setCopied] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const currentTemplate = CODE_TEMPLATES[activeTab];

  function handleCopy() {
    navigator.clipboard.writeText(currentTemplate.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleCheck(id: string) {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const completedCount = Object.values(checkedItems).filter(Boolean).length;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <div>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
            Step 05 • Implementation Guide & Gotchas
          </span>
          <h2 className="text-lg font-bold text-slate-100">{currentTemplate.title}</h2>
          <p className="text-xs text-slate-400 font-mono">
            Workload: {dataset.name} • {currentTemplate.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToCompare}
            className="px-3 py-1.5 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            ← Back to Compare
          </button>
          <button
            type="button"
            onClick={onProceedToReport}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors shadow-sm"
          >
            Generate Experiment Report →
          </button>
        </div>
      </div>

      {/* Optimization Strategy Tabs */}
      <div className="flex rounded-lg p-1 bg-slate-950 border border-slate-800 gap-1 font-mono text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('virtualization')}
          className={`flex-1 py-2 px-3 rounded transition-colors text-center ${
            activeTab === 'virtualization'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          1. DOM Virtualization
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('chunking')}
          className={`flex-1 py-2 px-3 rounded transition-colors text-center ${
            activeTab === 'chunking'
              ? 'bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          2. Progressive Chunking
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('worker')}
          className={`flex-1 py-2 px-3 rounded transition-colors text-center ${
            activeTab === 'worker'
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          3. Web Worker Search
        </button>
      </div>

      {/* Package Installation Banner */}
      <div className="p-4 rounded-lg border border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-mono text-slate-400">Dependency Requirement</span>
          <p className="text-sm font-mono text-cyan-300 font-semibold mt-0.5">
            {currentTemplate.installCmd}
          </p>
        </div>
        {currentTemplate.installCmd.startsWith('pnpm') && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(currentTemplate.installCmd);
            }}
            className="px-3 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
          >
            Copy Command
          </button>
        )}
      </div>

      {/* Copy-Pasteable Component Code Block */}
      <div className="border border-slate-800 bg-slate-950 rounded-lg overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-2.5 bg-slate-900 flex items-center justify-between">
          <span className="text-xs font-mono text-slate-300">
            {currentTemplate.filename} (Production Template)
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1 text-xs font-mono rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 transition-colors"
          >
            {copied ? '✓ Copied to Clipboard!' : 'Copy Code Template'}
          </button>
        </div>
        <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-[380px]">
          <code>{currentTemplate.code}</code>
        </pre>
      </div>

      {/* Real-World Gotchas & Caveats Matrix */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
          Critical Implementation Caveats & Trade-offs
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {currentTemplate.gotchas.map((gotcha) => (
            <div
              key={gotcha.label}
              className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-2"
            >
              <span className={`text-xs font-mono font-bold uppercase ${gotcha.color}`}>
                {gotcha.label}
              </span>
              <h4 className="font-semibold text-sm text-slate-200">{gotcha.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{gotcha.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-Production Verification Checklist */}
      <div className="p-5 rounded-lg border border-slate-800 bg-[var(--color-surface)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Pre-Production Verification Checklist
            </h3>
            <p className="text-xs text-slate-400">
              Confirm these quality gates before deploying dataset optimizations to production.
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-cyan-400">
            {completedCount} / {CHECKLIST_ITEMS.length} Verified
          </span>
        </div>

        <div className="space-y-3">
          {CHECKLIST_ITEMS.map((item) => {
            const isChecked = !!checkedItems[item.id];
            return (
              <label
                key={item.id}
                className="flex items-start gap-3 p-3 rounded border border-slate-800/80 bg-slate-950/40 hover:bg-slate-900/50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleCheck(item.id)}
                  className="mt-1 w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 bg-slate-900"
                />
                <div>
                  <span
                    className={`text-xs font-medium ${
                      isChecked ? 'text-emerald-400 line-through' : 'text-slate-200'
                    }`}
                  >
                    {item.label}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
