import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import type { LoadedDataset, IntakeValidationError } from '../../types/dataset';
import { SYNTHETIC_PRESETS, generateSyntheticDataset } from '../../lib/dataset/synthetic';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB safe browser ceiling

interface DatasetIntakeProps {
  onDatasetLoaded: (dataset: LoadedDataset) => void;
}

export default function DatasetIntake({ onDatasetLoaded }: DatasetIntakeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState<IntakeValidationError | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function validateAndReadFile(file: File) {
    setValidationError(null);

    // 1. Extension validation
    const name = file.name.toLowerCase();
    const isCsv = name.endsWith('.csv');
    const isJson = name.endsWith('.json');

    if (!isCsv && !isJson) {
      setValidationError({
        title: 'Unsupported File Format',
        message: `"${file.name}" is not supported. Please upload a .csv or .json file.`,
      });
      return;
    }

    // 2. Resource boundary validation (SoT Sec. 11: Set byte-size limits)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setValidationError({
        title: 'File Exceeds Safe Memory Limit',
        message: `Uploaded file is ${sizeMB} MB. In-browser client analysis is currently capped at 50 MB to prevent tab freezing.`,
      });
      return;
    }

    // 3. Read into memory locally
    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      setIsProcessing(false);
      onDatasetLoaded({
        name: file.name,
        sizeBytes: file.size,
        format: isCsv ? 'csv' : 'json',
        rawText: text,
        isSynthetic: false,
      });
    };

    reader.onerror = () => {
      setIsProcessing(false);
      setValidationError({
        title: 'Read Error',
        message: 'Could not read file from disk. Please check file permissions and try again.',
      });
    };

    reader.readAsText(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndReadFile(droppedFile);
    }
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndReadFile(selectedFile);
    }
  }

  function handleSyntheticClick(presetId: string) {
    const preset = SYNTHETIC_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setIsProcessing(true);
    // Yield to let UI show loading spinner
    setTimeout(() => {
      const dataset = generateSyntheticDataset(preset);
      setIsProcessing(false);
      onDatasetLoaded(dataset);
    }, 10);
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Validation Error Alert */}
      {validationError && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-200 text-sm flex items-start justify-between"
        >
          <div>
            <strong className="block font-semibold text-rose-300">
              {validationError.title}
            </strong>
            <span>{validationError.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="text-rose-400 hover:text-rose-200 font-mono text-xs px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-cyan-400 bg-cyan-950/20 scale-[0.99]'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/70'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Upload Dataset File"
        />

        <div className="space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-cyan-400 font-mono text-xl">
            ↑
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              {isProcessing ? 'Reading file into memory...' : 'Drop your dataset here, or browse files'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Supports <strong className="text-slate-300">.csv</strong> and{' '}
              <strong className="text-slate-300">.json</strong> • Bounded at 50 MB for client safety
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono bg-slate-950 text-slate-400 border border-slate-800">
            🔒 Local-only: Raw data never leaves browser memory
          </div>
        </div>
      </div>

      {/* Synthetic Workloads Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <h4 className="text-xs font-semibold tracking-wider uppercase text-slate-400 font-mono">
            Or choose a reproducible synthetic workload
          </h4>
          <span className="text-[11px] text-slate-500 font-mono">Instant verification</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SYNTHETIC_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={isProcessing}
              onClick={() => handleSyntheticClick(preset.id)}
              className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 hover:border-cyan-800/50 transition-all text-left flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                    {preset.format}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {preset.rowCount.toLocaleString()} rows
                  </span>
                </div>
                <h5 className="text-sm font-medium text-slate-200 group-hover:text-white">
                  {preset.label}
                </h5>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {preset.description}
                </p>
              </div>
              <div className="mt-4 pt-2 border-t border-slate-800/60 text-[11px] font-mono text-cyan-400/80 group-hover:text-cyan-300 flex items-center gap-1">
                Load Workload →
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}