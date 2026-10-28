import { useMemo, useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { LoadedDataset, TableMode } from '../../types/dataset';
import { parseDatasetRows } from '../../lib/dataset/parser';
import { useDatasetFilter } from '../../hooks/useDatasetFilter';
import { useProgressiveChunking } from '../../hooks/useProgressiveChunking';

interface DatasetCompareLabProps {
  dataset: LoadedDataset;
  onProceedToImplement: () => void;
  onBackToProfile: () => void;
}

export default function DatasetCompareLab({
  dataset,
  onProceedToImplement,
  onBackToProfile,
}: DatasetCompareLabProps) {
  const [mode, setMode] = useState<TableMode>('virtualized');
  const [baselineCap, setBaselineCap] = useState<number>(1000);
  const [chunkSize, setChunkSize] = useState<number>(100);
  const [renderDuration, setRenderDuration] = useState<number>(0);

  // Search & Filtering States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [useWorkerFilter, setUseWorkerFilter] = useState<boolean>(true);

  // 1. Parse initial rows based on active mode cap
  const { columns, rawRows, totalRows } = useMemo(() => {
    const limit = mode === 'baseline' ? baselineCap : undefined;
    const result = parseDatasetRows(dataset, limit);
    return {
      columns: result.columns,
      rawRows: result.rows,
      totalRows: dataset.rowCountEstimate ?? result.rows.length,
    };
  }, [dataset, mode, baselineCap]);

  // 2. Filter rows using Web Worker or Main Thread
  const { filteredRows, telemetry: filterTelemetry } = useDatasetFilter({
    rows: rawRows,
    columns,
    query: searchQuery,
    useWorker: useWorkerFilter,
  });

  // 3. Progressive chunking hook for time-sliced mounting
  const {
    chunkedItems,
    telemetry: chunkTelemetry,
    progressPercent,
  } = useProgressiveChunking({
    items: filteredRows,
    chunkSize,
    enabled: mode === 'chunked',
  });

  // 4. Virtualizer setup using filtered rows
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36, // 36px row height
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const visibleCount =
    mode === 'virtualized'
      ? virtualItems.length
      : mode === 'chunked'
        ? chunkedItems.length
        : filteredRows.length;
  const domNodeCount = visibleCount * (columns.length + 1);

  // 5. Measure render paint timing
  useEffect(() => {
    const start = performance.now();
    const rafId = requestAnimationFrame(() => {
      const duration = performance.now() - start;
      setRenderDuration(Number(duration.toFixed(2)));
    });
    return () => cancelAnimationFrame(rafId);
  }, [mode, baselineCap, dataset, filteredRows.length]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <div>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
            Step 04 • Performance Lab Comparison
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

      {/* Real-Time Interactive Search Bar */}
      <div className="p-4 rounded-lg border border-slate-800 bg-[var(--color-surface)] space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${rawRows.length.toLocaleString()} rows in real time...`}
              className="w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-400 focus:outline-none text-xs font-mono text-slate-100 placeholder-slate-500"
              aria-label="Filter dataset search query"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2 text-xs font-mono text-slate-500 hover:text-slate-300"
              >
                ✕ Clear
              </button>
            )}
          </div>

          {/* Worker vs Main Thread Filter Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono text-slate-400">Search Strategy:</span>
            <div className="flex rounded-md p-0.5 bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setUseWorkerFilter(false)}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                  !useWorkerFilter
                    ? 'bg-amber-950 text-amber-300 border border-amber-800 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Main Thread (Sync)
              </button>
              <button
                type="button"
                onClick={() => setUseWorkerFilter(true)}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                  useWorkerFilter
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Web Worker (Off-thread)
              </button>
            </div>
          </div>
        </div>

        {/* Search Compute Telemetry */}
        {searchQuery && (
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-2 border-t border-slate-800/80">
            <span>
              Matches:{' '}
              <strong className="text-cyan-400 font-normal">
                {filterTelemetry.matchesCount.toLocaleString()}
              </strong>{' '}
              / {rawRows.length.toLocaleString()}
            </span>
            <span>
              Search Compute Duration:{' '}
              <strong className="text-slate-200 font-normal">
                {filterTelemetry.executionDurationMs} ms
              </strong>
            </span>
            <span>
              Main-Thread Lock Time:{' '}
              <strong
                className={`font-semibold ${
                  filterTelemetry.mainThreadLockMs > 10 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {filterTelemetry.mainThreadLockMs} ms{' '}
                {filterTelemetry.isWorker ? '(0ms UI Lock)' : '(UI Frozen)'}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Mode Controls & Live Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Control Box */}
        <div className="p-4 rounded-lg border border-slate-800 bg-[var(--color-surface)] space-y-4">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            Rendering Strategy
          </span>

          <div className="flex rounded-md p-1 bg-slate-950 border border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => setMode('baseline')}
              className={`flex-1 py-1.5 text-xs font-mono rounded transition-colors ${
                mode === 'baseline'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Baseline
            </button>
            <button
              type="button"
              onClick={() => setMode('chunked')}
              className={`flex-1 py-1.5 text-xs font-mono rounded transition-colors ${
                mode === 'chunked'
                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Progressive
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
              Virtualized
            </button>
          </div>

          {mode === 'baseline' && (
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
                ⚠️ Bounded at 5,000 rows to prevent tab crash from synchronous mounting.
              </p>
            </div>
          )}

          {mode === 'chunked' && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Batch Size:</span>
                <span className="text-indigo-300 font-bold">{chunkSize} rows / idle frame</span>
              </div>
              <div className="flex gap-2">
                {[50, 100, 250].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setChunkSize(size)}
                    className={`flex-1 py-1 text-xs font-mono rounded ${
                      chunkSize === size
                        ? 'bg-indigo-900/60 text-indigo-200 border border-indigo-700 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                ⚡ Time-sliced batch mounting via requestIdleCallback. Preserves UI responsiveness
                without scroll container constraints.
              </p>
            </div>
          )}

          {mode === 'virtualized' && (
            <div className="pt-2 border-t border-slate-800">
              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                ✨ Virtualization mounts only viewport items. Scalable to 100,000+ rows with
                constant O(1) DOM footprint.
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
                    : mode === 'chunked'
                      ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                      : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                }`}
              >
                {mode === 'virtualized'
                  ? 'O(1) Constant'
                  : mode === 'chunked'
                    ? 'O(Batch) Streaming'
                    : 'O(N) Linear'}
              </span>
            </div>
            <p
              className={`text-3xl font-bold font-mono mt-2 ${
                mode === 'virtualized'
                  ? 'text-emerald-400'
                  : mode === 'chunked'
                    ? 'text-indigo-400'
                    : 'text-rose-400'
              }`}
            >
              {domNodeCount.toLocaleString()}
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {mode === 'virtualized'
              ? `Only ~${visibleCount} rows rendered in viewport.`
              : mode === 'chunked'
                ? `${chunkedItems.length.toLocaleString()} of ${filteredRows.length.toLocaleString()} rows mounted in DOM.`
                : `All ${filteredRows.length.toLocaleString()} rows mounted simultaneously.`}
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
                mode === 'virtualized'
                  ? 'text-cyan-400'
                  : mode === 'chunked'
                    ? 'text-indigo-400'
                    : 'text-amber-400'
              }`}
            >
              {mode === 'chunked' ? chunkTelemetry.initialChunkDurationMs : renderDuration} ms
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {mode === 'virtualized'
              ? 'Instantaneous mount (<16ms 60 FPS frame budget).'
              : mode === 'chunked'
                ? `First batch paint. Total hydration: ${chunkTelemetry.totalDurationMs} ms (${chunkTelemetry.yieldCycles} idle yields).`
                : 'Main-thread synchronous DOM mounting overhead.'}
          </p>
        </div>
      </div>

      {/* Interactive Table Viewport */}
      <div className="border border-slate-800 bg-[var(--color-surface)] rounded-lg overflow-hidden shadow-lg">
        <div className="border-b border-slate-800 px-4 py-2 bg-slate-900 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>
            Displaying{' '}
            {(mode === 'chunked' ? chunkedItems.length : filteredRows.length).toLocaleString()} rows
          </span>
          <span className="text-cyan-400">
            Scroll inside the viewport to test frame responsiveness
          </span>
        </div>

        {/* Progressive Streaming Banner */}
        {mode === 'chunked' && (
          <div className="px-4 py-2 bg-indigo-950/40 border-b border-indigo-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  chunkTelemetry.isComplete ? 'bg-emerald-400' : 'bg-indigo-400 animate-pulse'
                }`}
              />
              <span className="text-indigo-200">
                {chunkTelemetry.isComplete
                  ? `✓ All ${chunkTelemetry.mountedCount.toLocaleString()} rows mounted across ${chunkTelemetry.yieldCycles} idle frames (0ms UI freeze)`
                  : `⚡ Progressively mounting: ${chunkTelemetry.mountedCount.toLocaleString()} of ${filteredRows.length.toLocaleString()} rows (Chunk ${chunkTelemetry.yieldCycles + 1})`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-28 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full transition-all duration-150"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-indigo-300 font-bold">{progressPercent}%</span>
            </div>
          </div>
        )}

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
                const row = filteredRows[virtualRow.index];
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
            /* DOM Table Body (Naive or Progressive Chunked) */
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
                {(mode === 'chunked' ? chunkedItems : filteredRows).map((row, idx) => (
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
