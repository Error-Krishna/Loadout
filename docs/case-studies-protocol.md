# LOADOUT V2.1 — Case Study & Empirical Research Protocol

This document defines the standardized research protocol, empirical benchmark evaluation framework, and case study reporting structure for **LOADOUT Version 2.1**.

---

## 1. Research Objectives & Principles

LOADOUT is designed around the core engineering thesis:

> _"The engineering engine measures. AI interprets."_

The purpose of these case studies is to empirically evaluate:

1. **Bottleneck Identification:** Whether developers can pinpoint performance degradations (DOM bloat, main-thread blocking, V8 GC thrashing) in realistic data-intensive applications.
2. **Controlled Benchmark Rigor:** Whether optimizations demonstrate verifiable statistical speedups over baselines under strict monotonic clock timing.
3. **Correctness Preservation:** Whether the candidate optimization preserves record parity, schema fidelity, and null semantics without regressions.
4. **AI Copilot Utility:** Whether AI-generated interpretations, RAG citations, and experiment plans deliver actionable guidance without hallucinating metrics.
5. **Zero-Egress Privacy:** Whether the local-first execution model protects sensitive dataset records from outbound exfiltration.

---

## 2. Participant Profile & Methodology

- **Target Profiles:** Senior Frontend Engineers, Full-Stack Architects, and Performance Specialists.
- **Environment:** Clean browser instances (Chromium, Firefox, WebKit) running LOADOUT V2.1 on macOS, Linux, and Windows.
- **Workflow Steps:**
  1. **Intake:** Ingest synthetic or real-world datasets (10,000 to 100,000 rows in CSV, JSON, or NDJSON format).
  2. **Profile & Diagnose:** Inspect memory allocation estimates, DOM element counts, and thread utilization.
  3. **Compare & Benchmark:** Run baseline vs. candidate benchmark suites (e.g. naive DOM table vs. TanStack Virtual row windowing).
  4. **Verify Correctness:** Inspect the Correctness Gate audit report (record count, schema, null semantics, hash parity).
  5. **Apply & Export:** Export benchmark dossiers as portable JSON bundles.

---

## 3. Case Study Matrix

| Case Study ID | Workload Type                       | Dataset Scale                    | Baseline Variant                         | Candidate Optimization                               | Primary Evaluation Metric                                                 |
| :------------ | :---------------------------------- | :------------------------------- | :--------------------------------------- | :--------------------------------------------------- | :------------------------------------------------------------------------ |
| **CS-01**     | Large Tabular DOM Mounting          | 25,000 Rows, 8 Columns           | Full Table Mount (Naive `<tr>` mapping)  | Virtualized Windowing (`@tanstack/react-virtual`)    | DOM node count reduction (>95%) and render duration (<25ms)               |
| **CS-02**     | Interactive Multi-Column Search     | 50,000 Rows, 12 Columns          | Synchronous Main-Thread Linear Scan      | Web Worker Background Thread with Cached Dataset     | Main-thread FPS stability (60 FPS) and query latency (<10ms)              |
| **CS-03**     | High-Velocity Live Telemetry        | 200 events/sec socket stream     | Unthrottled Real-Time State Re-renders   | Visual Coalescing (16ms frame-rate batching)         | React render cycle reduction (>90%) and bounded memory queue (<200 items) |
| **CS-04**     | Responsive Canvas Image Encoding    | 4K Raw Image Assets              | Synchronous Main-Thread JPEG Compression | Offscreen Canvas + WebP / AVIF Responsive Generation | Worker offloading and binary byte savings (>60%)                          |
| **CS-05**     | Offline AI Benchmark Interpretation | Benchmark Dossiers (N=5 to N=30) | Unassisted Manual JSON Log Review        | Local Heuristic Copilot with BM25 RAG Citations      | Diagnostic accuracy, statistical warning fidelity, zero network egress    |

---

## 4. Empirical Evaluation Metric Provenance

Every metric reported in a LOADOUT case study must declare its provenance:

1. **`measured`**: Directly captured from runtime performance APIs (e.g., `performance.now()`, `container.querySelectorAll('*').length`, `Blob.size`).
2. **`estimated`**: Calculated via deterministic mathematical heuristics or formulas (e.g., pointer array heap memory, fallback dimensions).
3. **`inferred`**: Deduced by diagnostic algorithms from observed metrics (e.g., layout thrashing, V8 garbage collection spikes).
4. **`simulated`**: Produced under synthetic or mock conditions.

Fabricating measurements or labeling estimated formulas as `'measured'` is strictly prohibited.

---

## 5. Statistical Rigor Protocol

1. **Warmup Exclusion:** Every trial must perform at least 2 warmup iterations that are excluded from measured statistical distributions.
2. **Central Tendency:** Median is the primary measure of central tendency to resist asymmetric latency outliers.
3. **Tail-Latency Integrity:** P95 and P99 latency claims require sample sizes $N \ge 20$ and $N \ge 100$ respectively. For small sample sizes ($N < 20$), explicit small-sample warnings must be documented.
4. **Rank-Sum Significance:** Non-parametric Mann–Whitney U test with mid-rank tie breaking and tie-corrected variance must be evaluated to confirm whether distributions are statistically distinct ($p < 0.05$).
5. **Bootstrap Confidence Intervals:** 95% bootstrap confidence intervals for median delta must be computed to establish effect size uncertainty bounds.

---

## 6. Case Study Reporting Template

Every case study write-up must include:

- **Executive Summary:** Workload name, dataset characteristics, and optimization objective.
- **Baseline vs Candidate Architecture:** Structural and algorithmic differences.
- **Telemetric Evidence:** Measured duration distributions (median, mean, spread, standard deviation), DOM counts, and memory footprints.
- **Correctness Gate Audit:** Exact status of record count parity, schema parity, null semantics preservation, and divergence details if any.
- **Architectural Trade-Offs:** Practical trade-offs introduced by the optimization (e.g. in-page Ctrl+F limitations, dynamic row height measurement overhead, structured cloning serialization costs).
- **AI Copilot Evaluation:** Completeness, accuracy, and citation validity of copilot analysis.
