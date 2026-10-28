import { useMemo, useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { LoadedDataset } from '../../types/dataset';
import { parseDatasetRows } from '../../lib/dataset/parser';

interface DatasetCompareLabProps {
  dataset: LoadedDataset;
  onProceedToImplement: () => void;
  onBackToProfile: () => void;
}

export type TableMode = 'baseline' | 'virtualized';

export default function DatasetCompareLab({
  dataset,
  onProceedToImplement,
  onBackToProfile,
}: DatasetCompareLabProps) {
  const [mode, setMode] = useState<TableMode>('virtualized');
  const [baselineCap, setBaselineCap] = useState<number>(1000);
  const [renderDuration, setRenderDuration] = useState<number>(0);

  // Parse rows based on active mode
  const { columns, rows, totalRows } = useMemo(() => {
    const limit = mode === 'baseline' ? baselineCap : undefined;
    const result = parseDatasetRows(dataset, limit);
    return {
      columns: result.columns,
      rows: result.rows,
      totalRows: dataset.rowCountEstimate ?? result.rows.length,
    };
  }, [dataset, mode, baselineCap]);

  // Virtualizer setup
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36, // 36px row height
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const visibleCount = mode === 'virtualized' ? virtualItems.length : rows.length;
  const domNodeCount = visibleCount * (columns.length + 1);

  // Measure render timing
  useEffect(() => {
    const start = performance.now();
    // Request animation frame to measure paint completion
    const rafId = requestAnimationFrame(() => {
      const duration = performance.now() - start;
      setRenderDuration(Number(duration.toFixed(2)));
    });
    return () => cancelAnimationFrame(rafId);
  }, [mode, baselineCap, dataset]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <div>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
            Performance Lab • Side-by-Side Comparison
          </span>
          <h2 className="text-lg font-bold text-slate-100">{dataset.name}</h2>
          <p className="text-xs text-slate-400 font-mono">
            Workload: {totalRows.toLocaleString()} total rows • {columns.length} columns
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToProfile}
            className="px-3 py-1.5 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            ← Back to Profile
          </button>
          <button
            type="button"
            onClick={onProceedToImplement}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors shadow-sm"
          >
            View Implementation Guide →
          </button>
        </div>
      </div>

      {/* Mode Controls & Live Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Control Box */}
        <div className="p-4 rounded-lg border border-slate-800 bg-[var(--color-surface)] space-y-4">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            Execution Strategy
          </span>

          <div className="flex rounded-md p-1 bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => setMode('baseline')}
              className={`flex-1 py-1.5 text-xs font-mono rounded transition-colors ${
                mode === 'baseline'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Baseline (Naive)
            </button>
            <button
              type="button"
              onClick={() => setMode('virtualized')}
              className={`flex-1 py-1.5 text-xs font-mono rounded transition-colors ${
                mode === 'virtualized'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Virtualized (60 FPS)
            </button>
          </div>

          {mode === 'baseline' ? (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Naive DOM Cap:</span>
                <span className="text-rose-400 font-bold">{baselineCap.toLocaleString()} rows</span>
              </div>
              <input
                type="range"
                min={200}
                max={5000}
                step={200}
                value={baselineCap}
                onChange={(e) => setBaselineCap(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 leading-tight">
                ⚠️ Bounded at 5,000 rows to prevent browser tab crash. Notice how render time and
                memory climb.
              </p>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-800">
              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                ✨ Virtualization mounts only viewport items. All {totalRows.toLocaleString()} rows
                remain accessible with O(1) DOM footprint.
              </p>
            </div>
          )}
        </div>

        {/* Telemetry Card 1: DOM Elements */}
        <div className="p-4 rounded-lg border border-slate-800 bg-[var(--color-surface)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400 uppercase">Mounted DOM Nodes</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                  mode === 'virtualized'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                    : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                }`}
              >
                {mode === 'virtualized' ? 'O(1) Constant' : 'O(N) Linear'}
              </span>
            </div>
            <p
              className={`text-3xl font-bold font-mono mt-2 ${
                mode === 'virtualized' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {domNodeCount.toLocaleString()}
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {mode === 'virtualized'
              ? `Only ~${visibleCount} rows rendered in viewport.`
              : `All ${rows.length.toLocaleString()} rows mounted simultaneously.`}
          </p>
        </div>

        {/* Telemetry Card 2: Initial Render Duration */}
        <div className="p-4 rounded-lg border border-slate-800 bg-[var(--color-surface)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400 uppercase">Render Duration</span>
              <span className="text-[10px] font-mono text-slate-500">performance.now()</span>
            </div>
            <p
              className={`text-3xl font-bold font-mono mt-2 ${
                mode === 'virtualized' ? 'text-cyan-400' : 'text-amber-400'
              }`}
            >
              {renderDuration} ms
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {mode === 'virtualized'
              ? 'Instantaneous mount (<16ms 60 FPS frame budget).'
              : 'Main-thread DOM mounting overhead.'}
          </p>
        </div>
      </div>

      {/* Interactive Table Viewport */}
      <div className="border border-slate-800 bg-[var(--color-surface)] rounded-lg overflow-hidden shadow-lg">
        <div className="border-b border-slate-800 px-4 py-2 bg-slate-900 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>
            Displaying {rows.length.toLocaleString()} of {totalRows.toLocaleString()} rows
          </span>
          <span className="text-cyan-400">
            Scroll inside the viewport to test frame responsiveness
          </span>
        </div>

        <div
          ref={parentRef}
          className="h-[480px] overflow-auto relative font-mono text-xs"
          tabIndex={0}
          aria-label="Dataset Interactive Benchmark Table"
        >
          {mode === 'virtualized' ? (
            /* Virtualized Table Body */
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {/* Sticky Header */}
              <div className="sticky top-0 z-10 flex bg-slate-900 border-b border-slate-800 font-semibold text-slate-300">
                <div className="w-16 px-3 py-2.5 shrink-0 border-r border-slate-800 text-slate-500">
                  #
                </div>
                {columns.map((col) => (
                  <div key={col} className="flex-1 min-w-[140px] px-3 py-2.5 truncate">
                    {col}
                  </div>
                ))}
              </div>

              {/* Render only visible virtual items */}
              {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index];
                if (!row) return null;
                return (
                  <div
                    key={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={`flex items-center border-b border-slate-800/60 ${
                      virtualRow.index % 2 === 0 ? 'bg-slate-950/30' : 'bg-transparent'
                    } hover:bg-slate-800/40`}
                  >
                    <div className="w-16 px-3 py-1.5 shrink-0 border-r border-slate-800/60 text-slate-500">
                      {virtualRow.index + 1}
                    </div>
                    {columns.map((col) => (
                      <div
                        key={col}
                        className="flex-1 min-w-[140px] px-3 py-1.5 truncate text-slate-300"
                      >
                        {String(row[col] ?? '')}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Naive Unvirtualized Table Body */
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-300">
                <tr>
                  <th className="w-16 px-3 py-2.5 border-r border-slate-800 text-slate-500">#</th>
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-2.5 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-800/40 ${
                      idx % 2 === 0 ? 'bg-slate-950/30' : 'bg-transparent'
                    }`}
                  >
                    <td className="w-16 px-3 py-1.5 border-r border-slate-800/60 text-slate-500">
                      {idx + 1}
                    </td>
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-1.5 text-slate-300 whitespace-nowrap">
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
