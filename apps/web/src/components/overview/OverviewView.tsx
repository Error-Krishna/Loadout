import type { WorkbenchView } from '../../types/navigation';

interface OverviewViewProps {
  onNavigate: (view: WorkbenchView) => void;
  onStartSyntheticAnalysis: () => void;
}

export default function OverviewView({ onNavigate, onStartSyntheticAnalysis }: OverviewViewProps) {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Hero Banner */}
      <div className="p-8 rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-950 space-y-4 shadow-xl ring-1 ring-cyan-500/20">
        <div className="flex items-center gap-2 font-mono text-xs text-cyan-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>PERFORMANCE BENCHMARK WORKBENCH</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight sm:text-4xl">
          Find the right optimization. See the evidence. Leave with working code.
        </h1>
        <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
          LOADOUT is a local-first engineering workbench for developers diagnosing slow tables,
          galleries, charts, and data pipelines. Upload representative samples, diagnose
          bottlenecks, compare candidate strategies under controlled conditions, and export proven
          implementation patterns.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigate('new-analysis')}
            className="px-5 py-2.5 text-xs font-bold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors shadow-md font-mono"
          >
            + Start New Dataset Analysis
          </button>
          <button
            type="button"
            onClick={onStartSyntheticAnalysis}
            className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors font-mono"
          >
            ⚡ Load 25,000 Row Benchmark
          </button>
          <button
            type="button"
            onClick={() => onNavigate('technique-library')}
            className="px-4 py-2.5 text-xs font-semibold rounded-lg text-cyan-400 hover:text-cyan-300 transition-colors font-mono"
          >
            Browse Technique Library →
          </button>
        </div>
      </div>

      {/* Core Loop Architecture: Inspect -> Diagnose -> Compare -> Apply -> Verify */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400">
          The 5-Stage Verification Loop
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {[
            {
              step: '01',
              title: 'Inspect',
              desc: 'Upload CSV/JSON or generate bounded synthetic payloads.',
            },
            {
              step: '02',
              title: 'Diagnose',
              desc: 'Infer schema types, memory heap, null rate, and layout bottlenecks.',
            },
            {
              step: '03',
              title: 'Compare',
              desc: 'Run baseline vs virtualized vs worker search on identical data.',
            },
            {
              step: '04',
              title: 'Apply',
              desc: 'Copy production-ready React components and handle real caveats.',
            },
            {
              step: '05',
              title: 'Verify',
              desc: 'Export reproducible markdown dossier with environment metadata.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="p-4 rounded-lg border border-slate-800 bg-[var(--color-surface)] space-y-1.5"
            >
              <span className="font-mono text-xs text-cyan-400 font-bold">
                {item.step} • {item.title}
              </span>
              <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3 Core Modalities Hub */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Available Modality Labs
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('workloads')}
            className="text-xs font-mono text-cyan-400 hover:underline"
          >
            Open Workloads Hub →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Modality 1 */}
          <div className="p-5 rounded-lg border border-slate-800 bg-[var(--color-surface)] flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                Tabular Workload
              </span>
              <h3 className="font-bold text-slate-100 text-base">Dataset Explorer</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Analyze CSV, JSON, and NDJSON files up to 100,000 rows. Compare naive rendering
                against TanStack Virtual and off-thread Web Worker search filtering with request
                cancellation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('new-analysis')}
              className="w-full py-2 text-xs font-mono rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 transition-colors"
            >
              Launch Dataset Lab →
            </button>
          </div>

          {/* Modality 2 */}
          <div className="p-5 rounded-lg border border-slate-800 bg-[var(--color-surface)] flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                Asset Workload
              </span>
              <h3 className="font-bold text-slate-100 text-base">Image Delivery Lab</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Benchmark real browser WebP / AVIF canvas transforms, test decode scheduling with
                createImageBitmap, and generate responsive &lt;picture&gt; srcset snippets.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('workloads')}
              className="w-full py-2 text-xs font-mono rounded bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-800 transition-colors"
            >
              Launch Image Lab →
            </button>
          </div>

          {/* Modality 3 */}
          <div className="p-5 rounded-lg border border-slate-800 bg-[var(--color-surface)] flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                Streaming Workload
              </span>
              <h3 className="font-bold text-slate-100 text-base">Real-Time Stream Lab</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Simulate 10 to 1,000 events/second. Compare unthrottled render thrashing against
                frame batching, visual coalescing, and bounded ring buffers with backpressure drops.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('workloads')}
              className="w-full py-2 text-xs font-mono rounded bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 transition-colors"
            >
              Launch Stream Lab →
            </button>
          </div>
        </div>
      </div>

      {/* Engineering Principles */}
      <div className="p-5 rounded-lg border border-slate-800 bg-slate-950/60 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
        <div>
          <span className="text-emerald-400 font-bold block mb-1">🔒 Local-First Privacy</span>
          <span className="text-slate-400">
            Zero network telemetry. All files process strictly in client RAM.
          </span>
        </div>
        <div>
          <span className="text-cyan-400 font-bold block mb-1">⚖️ Non-Fabricated Telemetry</span>
          <span className="text-slate-400">
            Never invent percentages. Every metric stems from actual browser performance.now().
          </span>
        </div>
        <div>
          <span className="text-amber-400 font-bold block mb-1">⚡ Bounded Resource Safety</span>
          <span className="text-slate-400">
            Workers, buffers, and canvases cleanly unmount with timeout guards to prevent memory
            leaks.
          </span>
        </div>
      </div>
    </div>
  );
}
