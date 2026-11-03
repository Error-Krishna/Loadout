import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import type { LoadedDataset, IntakeValidationError, IngestionProgress } from '../../types/dataset';
import { SYNTHETIC_PRESETS, generateSyntheticDataset } from '../../lib/dataset/synthetic';
import { streamParseFile } from '../../lib/dataset/stream-parser';

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB bounded client ceiling

interface DatasetIntakeProps {
  onDatasetLoaded: (dataset: LoadedDataset) => void;
}

export default function DatasetIntake({ onDatasetLoaded }: DatasetIntakeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<IngestionProgress | null>(null);
  const [validationError, setValidationError] = useState<IntakeValidationError | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function validateAndReadFile(file: File) {
    setValidationError(null);
    setProgress(null);

    // 1. Extension & Format validation
    const name = file.name.toLowerCase();
    const isCsv = name.endsWith('.csv') || name.endsWith('.tsv');
    const isNdjson = name.endsWith('.ndjson') || name.endsWith('.jsonl');
    const isJson = name.endsWith('.json') && !isNdjson;

    if (!isCsv && !isJson && !isNdjson) {
      setValidationError({
        title: 'Unsupported File Format',
        message: `"${file.name}" is not supported. Please upload a .csv, .tsv, .json, or .ndjson/.jsonl file.`,
      });
      return;
    }

    // 2. Resource boundary validation
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setValidationError({
        title: 'File Exceeds Safe Memory Limit',
        message: `Uploaded file is ${sizeMB} MB. In-browser client analysis is currently capped at 100 MB to prevent tab freezing.`,
      });
      return;
    }

    if (file.size === 0) {
      setValidationError({
        title: 'Empty File',
        message: 'The selected file is empty (0 bytes). Please upload a valid dataset.',
      });
      return;
    }

    // 3. Chunked Streaming Ingestion with cancellation
    setIsProcessing(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const format = isCsv ? 'csv' : isNdjson ? 'ndjson' : 'json';

    try {
      // Chunked stream parsing with backpressure yielding
      const result = await streamParseFile(file, format, {
        chunkSizeBytes: 64 * 1024,
        maxRows: 100_000,
        signal: controller.signal,
        onProgress: (p) => setProgress(p),
      });

      if (result.rows.length === 0) {
        setValidationError({
          title: 'No Valid Records Found',
          message: 'The dataset could not be parsed into valid records or headers were missing.',
        });
        setIsProcessing(false);
        return;
      }

      // Read a preview string for in-memory dataset representation
      const previewBlob = file.slice(0, Math.min(file.size, 512 * 1024));
      const rawText = await previewBlob.text();

      onDatasetLoaded({
        name: file.name,
        sizeBytes: file.size,
        format,
        rawText,
        isSynthetic: false,
        rowCountEstimate: result.totalRows,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        setValidationError({
          title: 'Import Cancelled',
          message: 'Dataset ingestion was cancelled by the user.',
        });
      } else {
        setValidationError({
          title: 'Ingestion Error',
          message: (err as Error).message || 'Failed to parse dataset stream.',
        });
      }
    } finally {
      setIsProcessing(false);
      setProgress(null);
      abortControllerRef.current = null;
    }
  }

  function handleCancelImport() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('User cancelled dataset ingestion.');
    }
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
          className="p-4 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-200 text-xs font-mono space-y-1"
        >
          <div className="flex items-center gap-2 font-bold text-rose-400">
            <span>⚠️</span>
            <span>{validationError.title}</span>
          </div>
          <p className="text-slate-300 pl-5 leading-relaxed">{validationError.message}</p>
        </div>
      )}

      {/* Streaming Progress Bar during Ingestion */}
      {isProcessing && progress && (
        <div className="p-4 rounded-lg bg-slate-900 border border-cyan-700/60 text-xs font-mono space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-cyan-400 font-bold uppercase">
              Phase: {progress.phase} ({progress.percent}%)
            </span>
            <button
              type="button"
              onClick={handleCancelImport}
              className="text-rose-400 hover:text-rose-300 underline font-semibold"
            >
              Cancel Import
            </button>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-cyan-400 h-full transition-all duration-150"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>
              {(progress.bytesProcessed / (1024 * 1024)).toFixed(2)} MB /{' '}
              {(progress.totalBytes / (1024 * 1024)).toFixed(2)} MB
            </span>
            <span>Streaming chunked byte stream</span>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="space-y-2 text-center sm:text-left">
        <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
          Step 01 • Workload Ingestion
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Load Application Workload
        </h1>
        <p className="text-xs text-slate-400 max-w-xl font-mono">
          Upload real-world tabular data or select a deterministic synthetic workload to inspect
          runtime rendering, compute, and memory bottlenecks.
        </p>
      </div>

      {/* Upload Drag and Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-cyan-400 bg-cyan-950/20'
            : 'border-slate-800 hover:border-slate-700 bg-[var(--color-surface)] hover:bg-slate-900/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.json,.ndjson,.jsonl"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Upload Dataset File"
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center text-xl">
            {isProcessing ? '⚡' : '📁'}
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-200">
              {isProcessing
                ? 'Streaming and parsing workload...'
                : 'Click to upload or drop your dataset here'}
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              Supported: CSV (RFC 4180), TSV, JSON, NDJSON/JSONL • Bounded at 50 MB safe ceiling
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40">
            <span>🔒</span>
            <span>100% Client-Side Ingestion • Zero Data Exfiltration</span>
          </div>
        </div>
      </div>

      {/* Synthetic Workload Benchmarks Section */}
      <div className="space-y-4 pt-4 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-slate-200 font-mono">
              Synthetic Benchmark Presets
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Deterministic synthetic datasets designed to stress-test DOM limits and
              virtualization.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
            RFC 4180 In-Memory
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SYNTHETIC_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={isProcessing}
              onClick={() => handleSyntheticClick(preset.id)}
              className="p-4 rounded-lg border border-slate-800 bg-[var(--color-surface)] hover:border-cyan-500/60 hover:bg-slate-900/40 transition-all text-left flex flex-col justify-between group disabled:opacity-50"
            >
              <div className="space-y-1">
                <span className="text-xs font-mono text-cyan-400 font-semibold uppercase">
                  {preset.rowCount.toLocaleString()} Rows
                </span>
                <h3 className="text-sm font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
                  {preset.label}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">{preset.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>{preset.format.toUpperCase()}</span>
                <span className="text-cyan-400 group-hover:translate-x-0.5 transition-transform">
                  Load Preset →
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
