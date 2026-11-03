import { useState, useEffect } from 'react';
import type { WorkbenchView, AnalysisStep } from '../../types/navigation';
import type { LoadedDataset, AnalysisConfiguration } from '../../types/dataset';
import type { BenchmarkComparisonRecord } from '../../types/benchmark';
import type { WorkbenchSession } from '../../types/storage';
import { saveSession, loadSession } from '../../lib/storage/session-store';
import { generateSyntheticDataset, SYNTHETIC_PRESETS } from '../../lib/dataset/synthetic';
import DatasetIntake from '../intake/DatasetIntake';
import AnalysisConfigView from '../configure/AnalysisConfigView';
import DatasetProfileView from '../profile/DatasetProfileView';
import DatasetCompareLab from '../compare/DatasetCompareLab';
import DatasetImplementationGuide from '../implement/DatasetImplementationGuide';
import DatasetReportView from '../report/DatasetReportView';
import OverviewView from '../overview/OverviewView';
import WorkloadsView from '../workloads/WorkloadsView';
import TechniqueLibraryView from '../library/TechniqueLibraryView';
import ReportsManagerView from '../report/ReportsManagerView';
import SettingsView from '../settings/SettingsView';

const STEPS: { id: AnalysisStep; label: string; number: string }[] = [
  { id: 'input', label: 'Input', number: '01' },
  { id: 'configure', label: 'Configure', number: '02' },
  { id: 'profile', label: 'Profile', number: '03' },
  { id: 'compare', label: 'Compare', number: '04' },
  { id: 'implement', label: 'Implement', number: '05' },
  { id: 'report', label: 'Report', number: '06' },
];

const NAV_ITEMS: { id: WorkbenchView; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'new-analysis', label: 'New Analysis' },
  { id: 'workloads', label: 'Workloads' },
  { id: 'performance-lab', label: 'Performance Lab' },
  { id: 'reports', label: 'Reports' },
  { id: 'technique-library', label: 'Technique Library' },
  { id: 'settings', label: 'Settings' },
];

const DEFAULT_CONFIG: AnalysisConfiguration = {
  goal: 'first-render',
  deviceTarget: 'desktop',
  maxMemoryMb: 50,
  localOnly: true,
};

export default function AppShell() {
  const [activeView, setActiveView] = useState<WorkbenchView>('new-analysis');
  const [activeStep, setActiveStep] = useState<AnalysisStep>('input');
  const [dataset, setDataset] = useState<LoadedDataset | null>(null);
  const [config, setConfig] = useState<AnalysisConfiguration>(DEFAULT_CONFIG);
  const [comparisonRecord, setComparisonRecord] = useState<BenchmarkComparisonRecord | null>(null);

  // Restore session from local IndexedDB on mount (Phase 3)
  useEffect(() => {
    let isMounted = true;
    loadSession().then((saved) => {
      if (!isMounted || !saved) return;
      setActiveView(saved.activeView);
      setActiveStep(saved.activeStep);
      if (saved.config) setConfig(saved.config);
      if (saved.activeBenchmarkRecord) setComparisonRecord(saved.activeBenchmarkRecord);
      if (saved.persistedDataset) {
        setDataset(saved.persistedDataset);
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Autosave session state to local IndexedDB
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const sessionToSave: WorkbenchSession = {
        id: 'active_workbench_session',
        activeView,
        activeStep,
        persistedDataset: dataset,
        config,
        activeBenchmarkRecord: comparisonRecord,
        updatedAt: new Date().toISOString(),
      };
      saveSession(sessionToSave).catch(() => {});
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [activeView, activeStep, dataset, config, comparisonRecord]);

  function handleDatasetLoaded(loaded: LoadedDataset) {
    setDataset(loaded);
    setComparisonRecord(null);
    setActiveView('new-analysis');
    setActiveStep('configure');
  }

  function handleLoad25k() {
    const preset = SYNTHETIC_PRESETS[1] || SYNTHETIC_PRESETS[0]!;
    const synthetic = generateSyntheticDataset(preset);
    setDataset(synthetic);
    setComparisonRecord(null);
    setActiveView('new-analysis');
    setActiveStep('profile');
  }

  function handleReset() {
    setDataset(null);
    setConfig(DEFAULT_CONFIG);
    setComparisonRecord(null);
    setActiveStep('input');
  }

  // Active dataset for direct Performance Lab mode (fallback to 10k preset if none loaded)
  const labDataset = dataset ?? generateSyntheticDataset(SYNTHETIC_PRESETS[0]!);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-canvas)] text-slate-100 font-sans">
      {/* 1. Header Bar */}
      <header className="h-14 border-b border-slate-800 bg-[var(--color-surface)] px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveView('overview')}
            className="flex items-baseline gap-2 text-left cursor-pointer focus:outline-none"
          >
            <span className="text-lg font-bold tracking-wider text-cyan-400 font-mono">
              LOADOUT
            </span>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              v1.0 • Workbench
            </span>
          </button>

          <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Main Navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
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
        <div className="flex items-center gap-2 shrink-0">
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
              const isAccessible = !dataset ? step.id === 'input' : true;

              return (
                <li key={step.id} className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={!isAccessible}
                    onClick={() => setActiveStep(step.id)}
                    className={`flex items-center gap-2 px-3 py-1 rounded text-xs transition-all ${
                      isActive
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-medium'
                        : isAccessible
                          ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                          : 'text-slate-600 cursor-not-allowed opacity-50'
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
        {activeView === 'overview' ? (
          <OverviewView
            onNavigate={(view) => setActiveView(view)}
            onStartSyntheticAnalysis={handleLoad25k}
          />
        ) : activeView === 'workloads' ? (
          <WorkloadsView onDatasetLoaded={handleDatasetLoaded} />
        ) : activeView === 'performance-lab' ? (
          <DatasetCompareLab
            dataset={labDataset}
            onProceedToImplement={() => {
              setActiveView('new-analysis');
              setActiveStep('implement');
            }}
            onBackToProfile={() => {
              setActiveView('new-analysis');
              setActiveStep('profile');
            }}
            onBenchmarkCompleted={setComparisonRecord}
            activeBenchmarkRecord={comparisonRecord}
          />
        ) : activeView === 'reports' ? (
          <ReportsManagerView />
        ) : activeView === 'technique-library' ? (
          <TechniqueLibraryView />
        ) : activeView === 'settings' ? (
          <SettingsView />
        ) : activeStep === 'input' || !dataset ? (
          <DatasetIntake onDatasetLoaded={handleDatasetLoaded} />
        ) : activeStep === 'configure' ? (
          <AnalysisConfigView
            dataset={dataset}
            config={config}
            onChangeConfig={setConfig}
            onProceedToProfile={() => setActiveStep('profile')}
            onBackToInput={handleReset}
          />
        ) : activeStep === 'profile' ? (
          <DatasetProfileView
            dataset={dataset}
            config={config}
            onProceedToCompare={() => setActiveStep('compare')}
            onChangeDataset={handleReset}
          />
        ) : activeStep === 'compare' ? (
          <DatasetCompareLab
            dataset={dataset}
            onProceedToImplement={() => setActiveStep('implement')}
            onBackToProfile={() => setActiveStep('profile')}
            onBenchmarkCompleted={setComparisonRecord}
            activeBenchmarkRecord={comparisonRecord}
          />
        ) : activeStep === 'implement' ? (
          <DatasetImplementationGuide
            dataset={dataset}
            onProceedToReport={() => setActiveStep('report')}
            onBackToCompare={() => setActiveStep('compare')}
          />
        ) : (
          <DatasetReportView
            dataset={dataset}
            onRestart={handleReset}
            onBackToImplement={() => setActiveStep('implement')}
            comparisonRecord={comparisonRecord}
          />
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
          <span>Zero network transmission • In-memory client sandbox</span>
        </div>
      </footer>
    </div>
  );
}
