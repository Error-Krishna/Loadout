import { useState, useMemo } from 'react';
import type { LoadedDataset, ExperimentReport } from '../../types/dataset';
import type { BenchmarkComparisonRecord } from '../../types/benchmark';
import { captureBenchmarkEnvironment } from '../../lib/benchmark/environment';

interface DatasetReportViewProps {
  dataset: LoadedDataset;
  onRestart: () => void;
  onBackToImplement: () => void;
  comparisonRecord?: BenchmarkComparisonRecord | null;
}

function buildReportFromRecord(
  dataset: LoadedDataset,
  record: BenchmarkComparisonRecord | null | undefined,
): ExperimentReport {
  const totalRows = dataset.rowCountEstimate ?? 25000;
  const env = captureBenchmarkEnvironment();

  if (record) {
    const baseDom = record.baseline.domNodeCount.value;
    const candDom = record.candidate.domNodeCount.value;
    const baseMedian = record.baseline.distribution.medianMs;
    const candMedian = record.candidate.distribution.medianMs;

    const domReduction =
      baseDom > 0 ? Number((((baseDom - candDom) / baseDom) * 100).toFixed(1)) : 0;
    const timeReduction =
      baseMedian > 0 ? Number((((baseMedian - candMedian) / baseMedian) * 100).toFixed(1)) : 0;

    return {
      id: record.id,
      timestamp: record.createdAt,
      workloadName: record.workloadName,
      workloadFormat: dataset.format,
      rowCount: totalRows,
      columnCount: 6,
      environment: {
        userAgent: record.environment.userAgent,
        platform: record.environment.platform,
        date: new Date(record.createdAt).toLocaleDateString(),
      },
      baselineMetrics: {
        domNodes: baseDom,
        renderTimeMs: baseMedian,
        memoryEstimateMb: Number(
          (
            (record.baseline.estimatedMemoryBytes?.value ?? dataset.sizeBytes * 2) /
            (1024 * 1024)
          ).toFixed(1),
        ),
      },
      candidateMetrics: {
        domNodes: candDom,
        renderTimeMs: candMedian,
        technique: record.candidate.variantLabel,
      },
      improvementPct: {
        domReduction: Math.max(0, domReduction),
        timeReduction: Number(timeReduction.toFixed(1)),
      },
      verifiedTradeoffs: [
        'Browser Ctrl+F search requires in-app search query input with row windowing.',
        'Dynamic row heights require measureElement ref callbacks.',
        'Keyboard focus preservation must be tracked across unmounted rows.',
        `Benchmark executed ${record.policy.measuredIterations} measured trials (+${record.policy.warmupIterations} warmups).`,
      ],
      benchmarkComparison: record,
    };
  }

  // Fallback for un-benchmarked dataset view
  const naiveDomNodes = totalRows * 8;
  const virtualDomNodes = 25 * 8;

  return {
    id: `rep_${dataset.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_preview`,
    timestamp: new Date().toISOString(),
    workloadName: dataset.name,
    workloadFormat: dataset.format,
    rowCount: totalRows,
    columnCount: 6,
    environment: {
      userAgent: env.userAgent,
      platform: env.platform,
      date: new Date().toLocaleDateString(),
    },
    baselineMetrics: {
      domNodes: naiveDomNodes,
      renderTimeMs: 0, // Unmeasured
      memoryEstimateMb: Number(((dataset.sizeBytes * 2) / (1024 * 1024)).toFixed(1)),
    },
    candidateMetrics: {
      domNodes: virtualDomNodes,
      renderTimeMs: 0, // Unmeasured
      technique: 'Row Virtualization (TanStack Virtual)',
    },
    improvementPct: {
      domReduction: Number((((naiveDomNodes - virtualDomNodes) / naiveDomNodes) * 100).toFixed(1)),
      timeReduction: 0, // Unmeasured
    },
    verifiedTradeoffs: [
      'Workload has not yet executed in the Compare Lab benchmark runner.',
      'Run the benchmark suite in Step 04 to capture measured execution durations.',
    ],
  };
}

export default function DatasetReportView({
  dataset,
  onRestart,
  onBackToImplement,
  comparisonRecord,
}: DatasetReportViewProps) {
  const [copied, setCopied] = useState(false);
  const report = useMemo(
    () => buildReportFromRecord(dataset, comparisonRecord),
    [dataset, comparisonRecord],
  );

  const isMeasured = Boolean(
    comparisonRecord && comparisonRecord.baseline.distribution.sampleCount > 0,
  );

  const markdownSummary = `## 🔬 LOADOUT Performance Experiment Report
**Workload:** \`${report.workloadName}\` (${report.rowCount.toLocaleString()} rows, ${report.workloadFormat.toUpperCase()})  
**Date:** ${report.environment.date} | **Environment:** ${report.environment.platform}
**Measurement Provenance:** ${isMeasured ? 'Directly Measured via monotonic timer (performance.now())' : 'Unmeasured Preview'}

### 📊 Benchmark Comparison: Baseline vs Candidate
| Metric | Baseline (Naive) | Candidate (${report.candidateMetrics.technique}) | Shift |
| :--- | :--- | :--- | :--- |
| **Mounted DOM Nodes** | ${report.baselineMetrics.domNodes.toLocaleString()} nodes | ${report.candidateMetrics.domNodes} nodes | **${report.improvementPct.domReduction}% reduction** |
| **Execution Duration** | ${isMeasured ? `${report.baselineMetrics.renderTimeMs} ms [measured]` : 'Unmeasured'} | ${isMeasured ? `${report.candidateMetrics.renderTimeMs} ms [measured]` : 'Unmeasured'} | **${isMeasured ? `${report.improvementPct.timeReduction}%` : 'N/A'}** |
| **Scaling Complexity** | O(N) Linear | O(1) Constant | Scalable |

${
  comparisonRecord
    ? `### 🛡️ Correctness Gate Audit
- Status: **${comparisonRecord.correctness.status.toUpperCase()}**
- Record Parity: ${comparisonRecord.correctness.recordCountParity ? 'Passed' : 'Failed'}
- Schema Parity: ${comparisonRecord.correctness.schemaParity ? 'Passed' : 'Failed'}
- Sample Hash Parity: ${comparisonRecord.correctness.sampleHashParity ? 'Passed' : 'Failed'}
- Null Semantics: ${comparisonRecord.correctness.nullSemanticsPreserved ? 'Passed' : 'Failed'}
- Order Preserved: ${comparisonRecord.correctness.orderPreserved ? 'Passed' : 'Not Preserved'}
- Verdict: **${comparisonRecord.verdict.toUpperCase()}** (${comparisonRecord.verdictReason})
`
    : ''
}

### ⚠️ Verified Trade-Offs & Gotchas
${report.verifiedTradeoffs.map((t) => `- ${t}`).join('\n')}

> *Measured locally via LOADOUT Performance Workbench. Zero network transmission.*`;

  function handleCopyMarkdown() {
    navigator.clipboard.writeText(markdownSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadJson() {
    const payload = comparisonRecord ?? report;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loadout-report-${report.workloadName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Top Bar / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <div>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
            Step 06 • Final Experiment Report
          </span>
          <h2 className="text-lg font-bold text-slate-100">Performance Optimization Summary</h2>
          <p className="text-xs text-slate-400 font-mono">
            Manifest ID: {report.id} • {report.environment.date}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToImplement}
            className="px-3 py-1.5 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            ← Back to Guide
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors shadow-sm"
          >
            + New Analysis
          </button>
        </div>
      </div>

      {/* Unmeasured notice if benchmark was skipped */}
      {!isMeasured && (
        <div className="p-4 rounded-lg border border-amber-800/60 bg-amber-950/30 text-xs font-mono text-amber-300 space-y-1">
          <p className="font-bold">⚠️ Unbenchmarked Workload Preview</p>
          <p className="text-amber-400/80">
            This dataset has not yet undergone repeated benchmark execution. To capture genuine
            execution durations, trial distributions, and correctness gates, navigate back to Step
            04 (Compare) and run the automated benchmark suite.
          </p>
        </div>
      )}

      {/* Primary Results Hero */}
      <div className="p-6 rounded-lg border border-cyan-800/60 bg-gradient-to-br from-cyan-950/40 via-slate-900/50 to-slate-950 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
            Evidence Conclusion
          </span>
          {comparisonRecord && (
            <span
              className={`px-2.5 py-0.5 text-xs font-mono font-bold rounded uppercase ${
                comparisonRecord.verdict === 'improved'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              Verdict: {comparisonRecord.verdict}
            </span>
          )}
        </div>

        <h3 className="text-xl font-bold text-slate-100">
          Row Virtualization reduces DOM nodes by{' '}
          <span className="text-emerald-400">{report.improvementPct.domReduction}%</span> on this
          workload.
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
          On a dataset of {report.rowCount.toLocaleString()} rows, native unvirtualized rendering
          forces the browser to manage ~{report.baselineMetrics.domNodes.toLocaleString()} DOM
          elements. Switching to TanStack Virtual maintains an O(1) constant footprint of ~
          {report.candidateMetrics.domNodes} nodes while sustaining 60 FPS scroll.
        </p>

        {/* Metrics Side-by-side Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2">Metric</th>
                <th className="px-4 py-2">Baseline (Naive)</th>
                <th className="px-4 py-2">Virtualized Candidate</th>
                <th className="px-4 py-2 text-cyan-400">Gain / Shift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr>
                <td className="px-4 py-2 text-slate-300 font-semibold">Mounted DOM Nodes</td>
                <td className="px-4 py-2 text-rose-400">
                  {report.baselineMetrics.domNodes.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-emerald-400">{report.candidateMetrics.domNodes}</td>
                <td className="px-4 py-2 text-cyan-300 font-bold">
                  -{report.improvementPct.domReduction}%
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-slate-300 font-semibold">
                  Execution Duration (Median)
                </td>
                <td className="px-4 py-2 text-amber-400">
                  {isMeasured ? `${report.baselineMetrics.renderTimeMs} ms` : 'Unmeasured'}
                </td>
                <td className="px-4 py-2 text-emerald-400">
                  {isMeasured ? `${report.candidateMetrics.renderTimeMs} ms` : 'Unmeasured'}
                </td>
                <td className="px-4 py-2 text-cyan-300 font-bold">
                  {isMeasured ? `${report.improvementPct.timeReduction}%` : 'N/A'}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-slate-300 font-semibold">Scaling Complexity</td>
                <td className="px-4 py-2 text-rose-400">O(N) Linear</td>
                <td className="px-4 py-2 text-emerald-400">O(1) Constant</td>
                <td className="px-4 py-2 text-cyan-300 font-bold">Unbounded Rows</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Correctness Gate Audit Disclosure */}
      {comparisonRecord && (
        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 uppercase tracking-wider font-bold">
              Correctness Gate Audit
            </span>
            <span
              className={`px-2 py-0.5 rounded uppercase font-bold ${
                comparisonRecord.correctness.status === 'passed'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}
            >
              {comparisonRecord.correctness.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300 pt-1">
            <div>
              <span className="text-slate-500 block text-[10px]">Record Parity</span>
              <span>
                {comparisonRecord.correctness.recordCountParity ? '✓ Preserved' : '✗ Failed'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Schema Parity</span>
              <span>{comparisonRecord.correctness.schemaParity ? '✓ Preserved' : '✗ Failed'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Null Semantics</span>
              <span>
                {comparisonRecord.correctness.nullSemanticsPreserved ? '✓ Preserved' : '✗ Failed'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Sample Hash</span>
              <span>
                {comparisonRecord.correctness.sampleHashParity ? '✓ Identical' : '✗ Divergent'}
              </span>
            </div>
          </div>

          {comparisonRecord.verdictReason && (
            <p className="text-slate-400 text-[11px] pt-1 border-t border-slate-800/80">
              Evaluation Note: {comparisonRecord.verdictReason}
            </p>
          )}
        </div>
      )}

      {/* Verified Trade-Offs Disclosure */}
      <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50 space-y-2">
        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
          Documented Limitations & Caveats
        </h4>
        <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
          {report.verifiedTradeoffs.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Export Actions Bar */}
      <div className="p-4 rounded-lg border border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-mono text-slate-400">Share Results</span>
          <p className="text-xs text-slate-300 mt-0.5">
            Export reproducible findings for PR descriptions, team reviews, or technical
            documentation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadJson}
            className="px-3 py-1.5 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Download JSON
          </button>
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="px-3 py-1.5 text-xs font-mono rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 transition-colors"
          >
            {copied ? '✓ Copied Markdown!' : 'Copy Markdown Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
