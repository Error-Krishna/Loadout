import { useState } from 'react';
import type { WorkbenchView, AnalysisStep } from '../../types/navigation';
import type { LoadedDataset } from '../../types/dataset';
import DatasetIntake from '../intake/DatasetIntake';
import DatasetProfileView from '../profile/DatasetProfileView';

const STEPS: { id: AnalysisStep; label: string; number: string }[] = [
  { id: 'input', label: 'Input', number: '01' },
  { id: 'configure', label: 'Configure', number: '02' },
  { id: 'profile', label: 'Profile', number: '03' },
  { id: 'compare', label: 'Compare', number: '04' },
  { id: 'implement', label: 'Implement', number: '05' },
  { id: 'report', label: 'Report', number: '06' },
];

const NAV_ITEMS: { id: WorkbenchView; label: string }[] = [
  { id: 'new-analysis', label: 'New Analysis' },
  { id: 'workloads', label: 'Workloads' },
  { id: 'performance-lab', label: 'Performance Lab' },
  { id: 'reports', label: 'Reports' },
  { id: 'technique-library', label: 'Technique Library' },
  { id: 'settings', label: 'Settings' },
];

export default function AppShell() {
  const [activeView, setActiveView] = useState<WorkbenchView>('new-analysis');
  const [activeStep, setActiveStep] = useState<AnalysisStep>('input');
  const [dataset, setDataset] = useState<LoadedDataset | null>(null);

  function handleDatasetLoaded(loaded: LoadedDataset) {
    setDataset(loaded);
    setActiveStep('profile'); // Advance stepper to profile stage
  }
  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-canvas)] text-slate-100 font-sans">
      {/* 1. Header Bar */}
      <header className="h-14 border-b border-slate-800 bg-[var(--color-surface)] px-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-wider text-cyan-400 font-mono">
              LOADOUT
            </span>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              v1.0 • Workbench
            </span>
          </div>

          <nav className="flex items-center gap-1" aria-label="Main Navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-cyan-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Local Processing Privacy Badge */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Local-First Engine
          </span>
        </div>
      </header>

      {/* 2. Stepper Bar (shown during analysis flow) */}
      {activeView === 'new-analysis' && (
        <section
          className="border-b border-slate-800/80 bg-slate-900/60 px-6 py-2.5"
          aria-label="Analysis Pipeline Progress"
        >
          <ol className="flex items-center gap-2 max-w-5xl mx-auto overflow-x-auto">
            {STEPS.map((step, index) => {
              const isActive = activeStep === step.id;
              return (
                <li key={step.id} className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveStep(step.id)}
                    className={`flex items-center gap-2 px-3 py-1 rounded text-xs transition-all ${
                      isActive
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-medium'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="font-mono text-[10px] opacity-60">{step.number}</span>
                    <span>{step.label}</span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <span className="text-slate-700 text-xs select-none">/</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* 3. Main Workspace Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {activeView === 'new-analysis' ? (
          activeStep === 'input' || !dataset ? (
            <DatasetIntake onDatasetLoaded={handleDatasetLoaded} />
          ) : activeStep === 'profile' ? (
            <DatasetProfileView
              dataset={dataset}
              onProceedToCompare={() => setActiveStep('compare')}
              onChangeDataset={() => {
                setDataset(null);
                setActiveStep('input');
              }}
            />
          ) : (
            <div className="border border-slate-800 bg-[var(--color-surface)] rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                    Workload Active ({dataset.format.toUpperCase()})
                  </span>
                  <h3 className="text-lg font-semibold text-slate-100">{dataset.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDataset(null);
                    setActiveStep('input');
                  }}
                  className="px-3 py-1.5 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Change Dataset
                </button>
              </div>

              <div className="py-12 text-center text-slate-400">
                <span className="inline-block px-2.5 py-1 text-xs font-mono rounded bg-cyan-950/70 text-cyan-400 border border-cyan-800/40 mb-3">
                  Active Stage: {activeStep.toUpperCase()}
                </span>
                <p className="text-sm">
                  Stage under construction. Proceeding to Performance Lab in next milestone.
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="border border-slate-800 bg-[var(--color-surface)] rounded-lg p-8 text-center text-slate-400">
            View: <span className="font-mono text-cyan-400">{activeView}</span> (Under development)
          </div>
        )}
      </main>

      {/* 4. Engineering Status Footer */}
      <footer className="h-9 border-t border-slate-800/80 bg-slate-950 px-6 flex items-center justify-between text-xs text-slate-500 font-mono">
        <div className="flex items-center gap-4">
          <span>
            Engine: <strong className="text-emerald-400 font-normal">Ready</strong>
          </span>
          <span>
            Workers: <strong className="text-slate-300 font-normal">Bounded (Max 4)</strong>
          </span>
        </div>
        <div>
          <span>Zero network transmission • In-memory only</span>
        </div>
      </footer>
    </div>
  );
}
