import { useMemo, useState } from 'react';
import type { LoadedDataset } from '../../types/dataset';
import { profileDataset } from '../../lib/dataset/profiler';

interface DatasetProfileViewProps {
  dataset: LoadedDataset;
  onProceedToCompare: () => void;
  onChangeDataset: () => void;
}

export default function DatasetProfileView({
  dataset,
  onProceedToCompare,
  onChangeDataset,
}: DatasetProfileViewProps) {
  const profile = useMemo(() => profileDataset(dataset), [dataset]);
  const [activeTab, setActiveTab] = useState<'schema' | 'preview'>('schema');

  const heapMb = (profile.estimatedHeapBytes / (1024 * 1024)).toFixed(1);
  const rawKb = (profile.rawSizeBytes / 1024).toFixed(1);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <div>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
            Workload Profiled • {dataset.format.toUpperCase()}
          </span>
          <h2 className="text-lg font-bold text-slate-100">{dataset.name}</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onChangeDataset}
            className="px-3 py-1.5 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Change Dataset
          </button>
          <button
            type="button"
            onClick={onProceedToCompare}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            Compare Optimizations →
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40">
          <span className="text-xs font-mono text-slate-400">Total Rows</span>
          <p className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            {profile.rowCount.toLocaleString()}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40">
          <span className="text-xs font-mono text-slate-400">Columns</span>
          <p className="text-2xl font-bold font-mono text-slate-100 mt-1">{profile.columnCount}</p>
        </div>
        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40">
          <span className="text-xs font-mono text-slate-400">Raw Size</span>
          <p className="text-2xl font-bold font-mono text-slate-100 mt-1">{rawKb} KB</p>
        </div>
        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">In-Memory Heap</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
              Estimated
            </span>
          </div>
          <p className="text-2xl font-bold font-mono text-amber-400 mt-1">~{heapMb} MB</p>
        </div>
      </div>

      {/* Diagnostics / Bottleneck Warnings */}
      {profile.diagnostics.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Detected Performance Bottlenecks ({profile.diagnostics.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {profile.diagnostics.map((diag) => (
              <div
                key={diag.id}
                className={`p-4 rounded-lg border text-sm space-y-2 ${
                  diag.severity === 'critical'
                    ? 'bg-rose-950/20 border-rose-800/50 text-rose-200'
                    : 'bg-amber-950/20 border-amber-800/50 text-amber-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      diag.severity === 'critical'
                        ? 'bg-rose-900/60 text-rose-300'
                        : 'bg-amber-900/60 text-amber-300'
                    }`}
                  >
                    {diag.severity}
                  </span>
                  {diag.metric && (
                    <span className="text-xs font-mono opacity-80">{diag.metric}</span>
                  )}
                </div>
                <h4 className="font-semibold text-slate-100">{diag.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{diag.description}</p>
                <div className="pt-2 border-t border-slate-800/60 text-xs font-mono text-cyan-400">
                  Target Candidate: {diag.recommendedTechnique}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabbed View: Schema vs Row Preview */}
      <div className="border border-slate-800 bg-[var(--color-surface)] rounded-lg overflow-hidden">
        <div className="border-b border-slate-800 px-4 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('schema')}
              className={`px-3 py-2 text-xs font-mono font-medium border-b-2 transition-colors ${
                activeTab === 'schema'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Schema Breakdown ({profile.columns.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-2 text-xs font-mono font-medium border-b-2 transition-colors ${
                activeTab === 'preview'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Row Preview (First 10)
            </button>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Client-side inspection • Zero network latency
          </span>
        </div>

        {/* Tab 1: Schema Breakdown Table */}
        {activeTab === 'schema' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2.5">Column Name</th>
                  <th className="px-4 py-2.5">Inferred Type</th>
                  <th className="px-4 py-2.5">Null Rate</th>
                  <th className="px-4 py-2.5">Sample Values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {profile.columns.map((col) => (
                  <tr key={col.name} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-slate-200 font-semibold">{col.name}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded text-[11px] bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                        {col.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {col.nullCount > 0 ? `${col.nullCount} nulls` : '0 nulls (100% complete)'}
                    </td>
                    <td className="px-4 py-2 text-slate-400 truncate max-w-xs">
                      {col.sampleValues.join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Row Preview Table */}
        {activeTab === 'preview' && (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-mono border-b border-slate-800 sticky top-0">
                <tr>
                  {profile.columns.map((col) => (
                    <th key={col.name} className="px-4 py-2.5 whitespace-nowrap">
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {profile.previewRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    {profile.columns.map((col) => (
                      <td key={col.name} className="px-4 py-2 text-slate-300 whitespace-nowrap">
                        {String(row[col.name] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
