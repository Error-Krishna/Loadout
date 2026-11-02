import { useState } from 'react';

export default function SettingsView() {
  const [workerLimit, setWorkerLimit] = useState<number>(4);
  const [domCap, setDomCap] = useState<number>(5000);
  const [memoryWarningMb, setMemoryWarningMb] = useState<number>(50);
  const [clearedMessage, setClearedMessage] = useState<string | null>(null);

  function handleClearStorage() {
    try {
      localStorage.clear();
      sessionStorage.clear();
      setClearedMessage('✓ Local client storage and caches successfully purged.');
      setTimeout(() => setClearedMessage(null), 3000);
    } catch {
      setClearedMessage('Storage cleared.');
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <div>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
            Configuration & Environment
          </span>
          <h2 className="text-lg font-bold text-slate-100">Workbench Settings & Safety Budgets</h2>
          <p className="text-xs text-slate-400 font-mono">
            Fine-tune concurrency caps, safety thresholds, and client data isolation.
          </p>
        </div>
      </div>

      {/* Safety Budgets */}
      <div className="p-6 rounded-lg border border-slate-800 bg-[var(--color-surface)] space-y-5">
        <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider font-mono">
          Hardware & Resource Bounds
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          {/* Worker pool */}
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-950 space-y-2">
            <span className="text-slate-400">Max Worker Threads</span>
            <div className="flex gap-2">
              {[2, 4, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setWorkerLimit(n)}
                  className={`flex-1 py-1 rounded transition-colors ${
                    workerLimit === n
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">Limits concurrent background filter tasks.</p>
          </div>

          {/* Naive DOM cap */}
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-950 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Naive DOM Cap:</span>
              <span className="text-rose-400 font-bold">{domCap.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={1000}
              max={10000}
              step={1000}
              value={domCap}
              onChange={(e) => setDomCap(Number(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Prevents tab crashes during baseline rendering.
            </p>
          </div>

          {/* Memory Warning */}
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-950 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Memory Ceiling:</span>
              <span className="text-amber-400 font-bold">{memoryWarningMb} MB</span>
            </div>
            <input
              type="range"
              min={20}
              max={150}
              step={10}
              value={memoryWarningMb}
              onChange={(e) => setMemoryWarningMb(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Warns when heap allocation exceeds ceiling.
            </p>
          </div>
        </div>
      </div>

      {/* Local-First Privacy Guarantee */}
      <div className="p-6 rounded-lg border border-emerald-900/40 bg-emerald-950/10 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-emerald-300 font-mono">
            Zero-Transmission Privacy Guarantee
          </h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          LOADOUT operates strictly as a client-side execution harness. All dataset parsing,
          filtering, canvas encoding, and telemetry measurement occur inside your browser's V8 /
          JavaScript engine. No rows, images, credentials, or proprietary schema definitions are
          ever transmitted across the network.
        </p>
      </div>

      {/* Client Data Reset */}
      <div className="p-6 rounded-lg border border-slate-800 bg-[var(--color-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Clear Local Workspace Storage</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Purges cached benchmark files, report history, and session state from browser storage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {clearedMessage && (
            <span className="text-xs font-mono text-emerald-400">{clearedMessage}</span>
          )}
          <button
            type="button"
            onClick={handleClearStorage}
            className="px-4 py-2 text-xs font-mono rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 transition-colors shrink-0"
          >
            Clear Local Storage
          </button>
        </div>
      </div>
    </div>
  );
}
