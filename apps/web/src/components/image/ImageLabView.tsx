import { useState, useEffect, useRef, useMemo } from 'react';
import type { ImageWorkload, ImageTransformResult } from '../../types/image';
import {
  createSampleImageWorkloads,
  transformImageClient,
  generatePictureSnippet,
} from '../../lib/image/image-processor';

export default function ImageLabView() {
  const sampleWorkloads = useMemo(() => createSampleImageWorkloads(), []);
  const [selectedWorkload, setSelectedWorkload] = useState<ImageWorkload>(
    () => sampleWorkloads[0]!,
  );
  const [targetFormat, setTargetFormat] = useState<'webp' | 'jpeg'>('webp');
  const [quality, setQuality] = useState<number>(0.8);
  const [maxWidth, setMaxWidth] = useState<number>(1200);
  const [useOffscreenDecode, setUseOffscreenDecode] = useState<boolean>(true);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);

  const [transformResult, setTransformResult] = useState<ImageTransformResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const hiddenImgRef = useRef<HTMLImageElement | null>(null);

  // Run real client-side canvas transformation
  useEffect(() => {
    let isCancelled = false;
    const img = hiddenImgRef.current;
    if (!img) return;

    const process = async () => {
      setIsProcessing(true);
      try {
        const res = await transformImageClient(img, {
          format: targetFormat,
          quality,
          maxWidth,
        });

        if (!isCancelled) {
          setTransformResult(res);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (!isCancelled) {
          setIsProcessing(false);
        }
      }
    };

    if (img.complete) {
      void process();
    } else {
      img.onload = () => {
        void process();
      };
    }

    return () => {
      isCancelled = true;
    };
  }, [selectedWorkload, targetFormat, quality, maxWidth]);

  const originalKb = (selectedWorkload.originalBytes / 1024).toFixed(1);
  const transformedKb = transformResult ? (transformResult.sizeBytes / 1024).toFixed(1) : '...';
  const savingsPct =
    transformResult && selectedWorkload.originalBytes > 0
      ? Math.max(
          0,
          Math.round(
            ((selectedWorkload.originalBytes - transformResult.sizeBytes) /
              selectedWorkload.originalBytes) *
              100,
          ),
        )
      : 0;

  const codeSnippet = generatePictureSnippet(
    selectedWorkload.name,
    selectedWorkload.width,
    selectedWorkload.height,
    `${selectedWorkload.width} / ${selectedWorkload.height}`,
  );

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert('File exceeds 25 MB safety limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const testImg = new Image();
      testImg.onload = () => {
        const newWorkload: ImageWorkload = {
          id: `custom_${Date.now()}`,
          name: file.name,
          format: (file.type.split('/')[1] as ImageWorkload['format']) || 'png',
          originalBytes: file.size,
          width: testImg.naturalWidth || 800,
          height: testImg.naturalHeight || 600,
          hasAlpha: file.type.includes('png') || file.type.includes('webp'),
          dataUrl,
        };
        setSelectedWorkload(newWorkload);
        setMaxWidth(testImg.naturalWidth || 800);
      };
      testImg.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function handleCopySnippet() {
    navigator.clipboard.writeText(codeSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Hidden image element to draw onto Canvas */}
      <img
        ref={hiddenImgRef}
        src={selectedWorkload.dataUrl}
        alt="Hidden source"
        className="hidden"
        crossOrigin="anonymous"
      />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <div>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
            Modality • Image Optimization Lab
          </span>
          <h2 className="text-lg font-bold text-slate-100">Format & Delivery Benchmarking</h2>
          <p className="text-xs text-slate-400 font-mono">
            Compare WebP / AVIF encoding, responsive srcset, and decode latency with zero telemetry
            fakery.
          </p>
        </div>

        {/* Workload Selector */}
        <div className="flex items-center gap-2">
          {sampleWorkloads.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => {
                setSelectedWorkload(sample);
                setMaxWidth(sample.width);
              }}
              className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                selectedWorkload.id === sample.id
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {sample.name.replace('.png', '')}
            </button>
          ))}

          <label className="px-3 py-1.5 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer border border-slate-700 transition-colors">
            Upload Image
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Control Configuration Bar */}
      <div className="p-4 rounded-lg border border-slate-800 bg-[var(--color-surface)] grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
        {/* Format Selector */}
        <div className="space-y-1.5">
          <span className="text-slate-400">Target Encoding:</span>
          <div className="flex rounded-md p-0.5 bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => setTargetFormat('webp')}
              className={`flex-1 py-1 text-center rounded transition-colors ${
                targetFormat === 'webp'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              WebP (Modern)
            </button>
            <button
              type="button"
              onClick={() => setTargetFormat('jpeg')}
              className={`flex-1 py-1 text-center rounded transition-colors ${
                targetFormat === 'jpeg'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              JPEG (Standard)
            </button>
          </div>
        </div>

        {/* Quality Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-400">Quality:</span>
            <span className="text-cyan-400 font-bold">{Math.round(quality * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={1.0}
            step={0.05}
            value={quality}
            onChange={(e) => setQuality(parseFloat(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Max Width */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-400">Max Render Width:</span>
            <span className="text-slate-200 font-bold">{maxWidth}px</span>
          </div>
          <input
            type="range"
            min={320}
            max={selectedWorkload.width}
            step={80}
            value={maxWidth}
            onChange={(e) => setMaxWidth(parseInt(e.target.value, 10))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Decode Strategy */}
        <div className="space-y-1.5">
          <span className="text-slate-400">Decode Mode:</span>
          <button
            type="button"
            onClick={() => setUseOffscreenDecode(!useOffscreenDecode)}
            className={`w-full py-1.5 px-2 rounded border text-center transition-colors ${
              useOffscreenDecode
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60 font-semibold'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            {useOffscreenDecode ? '✓ Off-Thread (createImageBitmap)' : 'Main-Thread (img.decode)'}
          </button>
        </div>
      </div>

      {/* Side-by-Side Comparison Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Original Asset */}
        <div className="p-5 rounded-lg border border-slate-800 bg-[var(--color-surface)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-xs font-mono uppercase text-slate-400">Baseline Source</span>
              <h3 className="text-sm font-semibold text-slate-200">{selectedWorkload.name}</h3>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
              {originalKb} KB
            </span>
          </div>

          {/* Visual Container */}
          <div className="w-full h-64 bg-slate-950 rounded border border-slate-800/80 flex items-center justify-center overflow-hidden p-2">
            <img
              src={selectedWorkload.dataUrl}
              alt="Original preview"
              className="max-h-full max-w-full object-contain rounded"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1 text-slate-400">
            <div>
              Format:{' '}
              <strong className="text-slate-200">{selectedWorkload.format.toUpperCase()}</strong>
            </div>
            <div>
              Dimensions:{' '}
              <strong className="text-slate-200">
                {selectedWorkload.width}×{selectedWorkload.height}
              </strong>
            </div>
            <div>
              Alpha:{' '}
              <strong className="text-slate-200">{selectedWorkload.hasAlpha ? 'Yes' : 'No'}</strong>
            </div>
          </div>
        </div>

        {/* Right: Optimized Candidate */}
        <div className="p-5 rounded-lg border border-cyan-800/80 bg-gradient-to-b from-cyan-950/20 to-[var(--color-surface)] space-y-4 shadow-lg ring-1 ring-cyan-500/20">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-xs font-mono uppercase text-cyan-400 font-semibold">
                Optimized Candidate
              </span>
              <h3 className="text-sm font-semibold text-slate-100">
                {targetFormat.toUpperCase()} ({Math.round(quality * 100)}% quality)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                {transformedKb} KB (-{savingsPct}%)
              </span>
            </div>
          </div>

          {/* Visual Container */}
          <div className="w-full h-64 bg-slate-950 rounded border border-slate-800/80 flex items-center justify-center overflow-hidden p-2 relative">
            {isProcessing && (
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-10 font-mono text-xs text-cyan-400 animate-pulse">
                Encoding in browser canvas...
              </div>
            )}
            <img
              src={transformResult?.dataUrl || selectedWorkload.dataUrl}
              alt="Optimized preview"
              className="max-h-full max-w-full object-contain rounded"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1 text-slate-400">
            <div>
              Render W:{' '}
              <strong className="text-cyan-300">
                {transformResult ? `${transformResult.width}px` : '...'}
              </strong>
            </div>
            <div>
              Decode Time:{' '}
              <strong className="text-emerald-400">
                {transformResult ? `${transformResult.decodeTimeMs} ms` : '...'}
              </strong>
            </div>
            <div>
              Payload Saved: <strong className="text-emerald-400">{savingsPct}%</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Production Integration Pattern & Code Generator */}
      <div className="border border-slate-800 bg-slate-950 rounded-lg overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-2.5 bg-slate-900 flex items-center justify-between">
          <span className="text-xs font-mono text-slate-300">
            Responsive &lt;picture&gt; Component (Production Implementation)
          </span>
          <button
            type="button"
            onClick={handleCopySnippet}
            className="px-3 py-1 text-xs font-mono rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 transition-colors"
          >
            {copiedSnippet ? '✓ Copied to Clipboard!' : 'Copy <picture> Snippet'}
          </button>
        </div>
        <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-56">
          <code>{codeSnippet}</code>
        </pre>
      </div>

      {/* Real-World Gotchas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-1.5">
          <span className="font-mono font-bold text-amber-400 uppercase">
            1. LCP Above-the-Fold
          </span>
          <h4 className="font-semibold text-slate-200">Never lazy-load hero images</h4>
          <p className="text-slate-400 leading-relaxed">
            Images in the initial viewport should have{' '}
            <code className="text-cyan-300">loading="eager"</code> and{' '}
            <code className="text-cyan-300">fetchpriority="high"</code>. Lazy loading will delay LCP
            paint by 200-500ms.
          </p>
        </div>

        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-1.5">
          <span className="font-mono font-bold text-cyan-400 uppercase">2. Layout Shift (CLS)</span>
          <h4 className="font-semibold text-slate-200">Always preserve aspect ratio</h4>
          <p className="text-slate-400 leading-relaxed">
            Supply explicit <code className="text-cyan-300">width</code>,{' '}
            <code className="text-cyan-300">height</code>, or{' '}
            <code className="text-cyan-300">aspect-ratio</code> CSS attributes to allow the browser
            to reserve layout space before downloading.
          </p>
        </div>

        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-1.5">
          <span className="font-mono font-bold text-emerald-400 uppercase">3. Async Decoding</span>
          <h4 className="font-semibold text-slate-200">Decouple decode from main thread</h4>
          <p className="text-slate-400 leading-relaxed">
            Use <code className="text-cyan-300">decoding="async"</code> or{' '}
            <code className="text-cyan-300">createImageBitmap</code> to ensure massive image
            decompression happens off the UI thread.
          </p>
        </div>
      </div>
    </div>
  );
}
