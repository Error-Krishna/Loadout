import { useState } from 'react';
import type { LoadedDataset } from '../../types/dataset';
import ImageLabView from '../image/ImageLabView';
import StreamLabView from '../stream/StreamLabView';
import DatasetIntake from '../intake/DatasetIntake';

interface WorkloadsViewProps {
  onDatasetLoaded: (dataset: LoadedDataset) => void;
}

type WorkloadTab = 'datasets' | 'images' | 'streams';

export default function WorkloadsView({ onDatasetLoaded }: WorkloadsViewProps) {
  const [activeTab, setActiveTab] = useState<WorkloadTab>('datasets');

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <div>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
            Workload Modalities • Performance Hub
          </span>
          <h2 className="text-lg font-bold text-slate-100">Workload Optimization Labs</h2>
          <p className="text-xs text-slate-400 font-mono">
            Select a target modality to test bottlenecks, measure frame times, and generate code
            patterns.
          </p>
        </div>

        {/* Modality Selector Tabs */}
        <div className="flex rounded-lg p-1 bg-slate-950 border border-slate-800 gap-1 font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('datasets')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'datasets'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📊 Datasets (CSV/JSON)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('images')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'images'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🖼️ Image Encodings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('streams')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'streams'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚡ Real-Time Streams
          </button>
        </div>
      </div>

      {/* Render Active Modality Lab */}
      {activeTab === 'datasets' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-slate-800 bg-[var(--color-surface)] text-xs text-slate-300 font-mono flex items-center justify-between">
            <span>
              Workload Type:{' '}
              <strong className="text-cyan-400">Tabular Collections (CSV / JSON / NDJSON)</strong>
            </span>
            <span className="text-slate-500">Up to 100,000 records supported locally</span>
          </div>
          <DatasetIntake onDatasetLoaded={onDatasetLoaded} />
        </div>
      )}

      {activeTab === 'images' && <ImageLabView />}

      {activeTab === 'streams' && <StreamLabView />}
    </div>
  );
}
