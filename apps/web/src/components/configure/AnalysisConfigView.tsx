import type {
  LoadedDataset,
  AnalysisConfiguration,
  OptimizationGoal,
  DeviceTarget,
} from '../../types/dataset';

interface AnalysisConfigViewProps {
  dataset: LoadedDataset;
  config: AnalysisConfiguration;
  onChangeConfig: (updated: AnalysisConfiguration) => void;
  onProceedToProfile: () => void;
  onBackToInput: () => void;
}

const GOALS: { id: OptimizationGoal; label: string; desc: string; icon: string }[] = [
  {
    id: 'first-render',
    label: 'First Render (TTFR)',
    desc: 'Minimize Time-to-First-Result. Prioritize mounting the visible screen in under 16ms.',
    icon: '⚡',
  },
  {
    id: 'memory',
    label: 'Memory Footprint',
    desc: 'Strictly cap heap memory allocations to prevent browser crashes on low-end devices.',
    icon: '💾',
  },
  {
    id: 'interaction',
    label: 'Interaction & Scroll Latency',
    desc: 'Lock 60 FPS scroll performance and zero keystroke delay during search and sort.',
    icon: '🎯',
  },
  {
    id: 'balanced',
    label: 'Balanced Production',
    desc: 'A robust balance between fast initial render, reasonable memory, and smooth navigation.',
    icon: '⚖️',
  },
];

const TARGETS: { id: DeviceTarget; label: string; desc: string }[] = [
  {
    id: 'desktop',
    label: 'Modern Desktop / Laptop',
    desc: 'Standard multi-core CPU, ample RAM (16GB+), and hardware-accelerated GPU.',
  },
  {
    id: 'mobile-constrained',
    label: 'Constrained Device / Mobile',
    desc: 'Aggressive memory limits (max 50MB tab heap) and CPU throttling tolerance.',
  },
];

export default function AnalysisConfigView({
  dataset,
  config,
  onChangeConfig,
  onProceedToProfile,
  onBackToInput,
}: AnalysisConfigViewProps) {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Workload Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <div>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
            Step 02 • Analysis Constraints & Goals
          </span>
          <h2 className="text-lg font-bold text-slate-100">{dataset.name}</h2>
          <p className="text-xs text-slate-400 font-mono">
            {dataset.format.toUpperCase()} • {(dataset.sizeBytes / 1024).toFixed(1)} KB
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToInput}
            className="px-3 py-1.5 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            ← Change File
          </button>
          <button
            type="button"
            onClick={onProceedToProfile}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors shadow-sm"
          >
            Profile Workload →
          </button>
        </div>
      </div>

      {/* Goal Selector */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
          Primary Optimization Target
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {GOALS.map((goal) => {
            const isSelected = config.goal === goal.id;
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => onChangeConfig({ ...config, goal: goal.id })}
                className={`p-4 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-cyan-400 bg-cyan-950/30 ring-1 ring-cyan-400/50'
                    : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base">{goal.icon}</span>
                  {isSelected && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-900/80 text-cyan-300 font-bold uppercase">
                      Selected Goal
                    </span>
                  )}
                </div>
                <h4 className="font-semibold text-sm text-slate-200 mt-2">{goal.label}</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{goal.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Device Environment */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
          Target Environment & Hardware Constraints
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TARGETS.map((target) => {
            const isSelected = config.deviceTarget === target.id;
            return (
              <button
                key={target.id}
                type="button"
                onClick={() => onChangeConfig({ ...config, deviceTarget: target.id })}
                className={`p-4 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-cyan-400 bg-cyan-950/30 ring-1 ring-cyan-400/50'
                    : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm text-slate-200">{target.label}</h4>
                  {isSelected && (
                    <span className="text-[10px] font-mono text-cyan-400">Active</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{target.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Privacy & Bounds Policy */}
      <div className="p-4 rounded-lg border border-slate-800 bg-slate-950 text-xs font-mono space-y-2">
        <span className="text-emerald-400 font-bold">🔒 Privacy & Boundary Envelope:</span>
        <ul className="text-slate-400 space-y-1 list-disc list-inside">
          <li>Local-first in-memory sandbox: zero network payloads transmitted.</li>
          <li>Max file ceiling: 50MB browser allocation budget.</li>
          <li>Telemetry records real client hardware timings without synthetic multipliers.</li>
        </ul>
      </div>
    </div>
  );
}
