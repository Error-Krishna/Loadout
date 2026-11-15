import { useState, useEffect, useRef } from 'react';
import {
  loadSettings,
  saveSettings,
  purgeAllWorkbenchData,
  exportWorkbenchData,
  importWorkbenchData,
} from '../../lib/storage/session-store';
import type { ExportBundle } from '../../types/storage';

export default function SettingsView() {
  const [workerLimit, setWorkerLimit] = useState<number>(4);
  const [domCap, setDomCap] = useState<number>(5000);
  const [memoryWarningMb, setMemoryWarningMb] = useState<number>(50);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isSubscribed = true;
    loadSettings()
      .then((saved) => {
        if (!isSubscribed) return;
        setWorkerLimit(saved.workerLimit);
        setDomCap(saved.domCap);
        setMemoryWarningMb(saved.memoryWarningMb);
      })
      .catch(() => {});

    return () => {
      isSubscribed = false;
    };
  }, []);

  function handleSave(limit: number, cap: number, mem: number) {
    saveSettings({
      workerLimit: limit,
      domCap: cap,
      memoryWarningMb: mem,
      telemetryOptIn: false,
      aiMode: 'disabled',
    }).catch(() => {});
  }

  function handleWorkerLimitChange(n: number) {
    setWorkerLimit(n);
    handleSave(n, domCap, memoryWarningMb);
  }

  function handleDomCapChange(cap: number) {
    setDomCap(cap);
    handleSave(workerLimit, cap, memoryWarningMb);
  }

  function handleMemoryCeilingChange(mem: number) {
    setMemoryWarningMb(mem);
    handleSave(workerLimit, domCap, mem);
  }

  async function handleClearStorage() {
    try {
      await purgeAllWorkbenchData();
      localStorage.clear();
      sessionStorage.clear();
      setActionMessage('✓ Local IndexedDB & caches purged.');
      setTimeout(() => setActionMessage(null), 3000);
    } catch {
      setActionMessage('Storage cleared.');
    }
  }

  async function handleExport() {
    try {
      setIsExporting(true);
      const bundle = await exportWorkbenchData();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loadout-workbench-bundle-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setActionMessage('✓ Export downloaded.');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      setActionMessage(`Export error: ${(err as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const bundle = JSON.parse(text) as ExportBundle;
      const summary = await importWorkbenchData(bundle);
      setActionMessage(
        `✓ Imported: ${summary.reportsImported} reports, ${summary.benchmarkResultsImported} benchmarks.`,
      );
      setTimeout(() => setActionMessage(null), 4000);
      const newSettings = await loadSettings();
      setWorkerLimit(newSettings.workerLimit);
      setDomCap(newSettings.domCap);
      setMemoryWarningMb(newSettings.memoryWarningMb);
    } catch (err) {
      setActionMessage(`Import error: ${(err as Error).message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
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
                  onClick={() => handleWorkerLimitChange(n)}
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
              onChange={(e) => handleDomCapChange(Number(e.target.value))}
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
              onChange={(e) => handleMemoryCeilingChange(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Warns when heap allocation exceeds ceiling.
            </p>
          </div>
        </div>
      </div>

      {/* Data Portability (Export & Import) */}
      <div className="p-6 rounded-lg border border-slate-800 bg-[var(--color-surface)] space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 font-mono">
            Workbench Data Portability
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Export or restore your benchmark history, experiment dossiers, and workbench settings as
            a portable JSON bundle.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-mono rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 transition-colors"
          >
            {isExporting ? 'Exporting...' : 'Export Workspace Bundle'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            className="hidden"
            id="import-bundle-file"
          />
          <label
            htmlFor="import-bundle-file"
            className="px-4 py-2 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition-colors"
          >
            Import Workspace Bundle
          </label>
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

      {/* Free-First AI Architecture */}
      <div className="p-6 rounded-lg border border-slate-800 bg-[var(--color-surface)] space-y-4">
        <div>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
            AI Assistant Configuration
          </span>
          <h3 className="text-sm font-semibold text-slate-100 font-mono">
            Free-First AI Architecture
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            LOADOUT is designed free-first with zero commercial vendor lock-in. No BYOK API keys
            (OpenAI, Anthropic, Gemini) are required or accepted.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-4 rounded-lg border border-emerald-900/60 bg-emerald-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-300">1. Offline AI (Default)</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900 text-emerald-200">
                ACTIVE
              </span>
            </div>
            <p className="text-slate-300 text-[11px]">
              Local deterministic heuristic engine. Runs entirely within the browser. 100% zero
              network egress, zero API keys, and instantaneous response times.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-cyan-900/60 bg-cyan-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-300">2. Groq Cloud AI</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-900 text-cyan-200">
                FREE OPT-IN
              </span>
            </div>
            <p className="text-slate-300 text-[11px]">
              Ultra-fast open-weight models (Llama 3.3 70B) served via backend endpoint. Only
              sanitized, row-free benchmark summaries are transmitted. Automatically falls back to
              Offline AI if unavailable.
            </p>
          </div>
        </div>
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
          {actionMessage && (
            <span className="text-xs font-mono text-emerald-400">{actionMessage}</span>
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
