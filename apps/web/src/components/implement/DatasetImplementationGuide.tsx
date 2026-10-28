import { useState } from 'react';
import type { LoadedDataset, ChecklistItem } from '../../types/dataset';

interface DatasetImplementationGuideProps {
  dataset: LoadedDataset;
  onProceedToReport: () => void;
  onBackToCompare: () => void;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'max-payload',
    category: 'performance',
    label: 'Stress-tested with peak production payload',
    description:
      'Verified table scrolling under 25,000+ items without memory leak or frame stutter.',
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
      'Since unrendered rows cannot be searched by browser Ctrl+F, provide an in-app query input.',
  },
  {
    id: 'unmount-cleanup',
    category: 'correctness',
    label: 'Lifecycle cleanup on route navigation',
    description:
      'Confirm scroll listeners and virtualizer caches release memory when leaving the view.',
  },
];

const CODE_SAMPLE = `import { useRef } from 'react';
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
    estimateSize: () => 36, // default row height (px)
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
              className="flex items-center border-b border-slate-200 dark:border-slate-800"
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
}`;

export default function DatasetImplementationGuide({
  dataset,
  onProceedToReport,
  onBackToCompare,
}: DatasetImplementationGuideProps) {
  const [copied, setCopied] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  function handleCopy() {
    navigator.clipboard.writeText(CODE_SAMPLE);
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
          <h2 className="text-lg font-bold text-slate-100">TanStack Virtual Integration</h2>
          <p className="text-xs text-slate-400 font-mono">
            Workload: {dataset.name} • Target Candidate: Row Virtualization
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

      {/* Package Installation Banner */}
      <div className="p-4 rounded-lg border border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-mono text-slate-400">Prerequisite Dependency</span>
          <p className="text-sm font-mono text-cyan-300 font-semibold mt-0.5">
            pnpm add @tanstack/react-virtual
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText('pnpm add @tanstack/react-virtual');
          }}
          className="px-3 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
        >
          Copy Command
        </button>
      </div>

      {/* Copy-Pasteable Component Code Block */}
      <div className="border border-slate-800 bg-slate-950 rounded-lg overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-2.5 bg-slate-900 flex items-center justify-between">
          <span className="text-xs font-mono text-slate-300">
            src/components/VirtualTable.tsx (Production Template)
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1 text-xs font-mono rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 transition-colors"
          >
            {copied ? '✓ Copied to Clipboard!' : 'Copy React Component'}
          </button>
        </div>
        <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-[380px]">
          <code>{CODE_SAMPLE}</code>
        </pre>
      </div>

      {/* Real-World Gotchas & Caveats Matrix */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
          Critical Implementation Caveats & Trade-offs
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-2">
            <span className="text-xs font-mono font-bold text-amber-400 uppercase">
              1. Browser Ctrl+F
            </span>
            <h4 className="font-semibold text-sm text-slate-200">Off-Screen Searching</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Because offscreen rows are not in the DOM, native browser search won't find them. You
              must provide an explicit in-app search input that filters data before virtualization.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-2">
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
              2. Dynamic Heights
            </span>
            <h4 className="font-semibold text-sm text-slate-200">Variable Row Content</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              If table cells wrap dynamically, pass{' '}
              <code className="text-cyan-300">ref={'{rowVirtualizer.measureElement}'}</code> to each
              row element so height calculations update dynamically.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-2">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase">
              3. Keyboard Focus
            </span>
            <h4 className="font-semibold text-sm text-slate-200">Focus Preservation</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              When a user tabs through rows, scrolling can unmount the focused element. Maintain the
              active focused row index in state to scroll the row into view automatically.
            </p>
          </div>
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
              Confirm these quality gates before deploying virtualized tables to production.
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
