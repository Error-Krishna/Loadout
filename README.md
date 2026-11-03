# LOADOUT (v2.0)

> **The engineering engine measures. AI interprets.**

LOADOUT is a production-grade, AI-assisted performance engineering workbench designed for frontend developers and systems engineers. It provides empirical measurement, statistical rigor, and controlled experimentation for modern web workloads—including large-scale dataset rendering, client-side image processing pipelines, and high-throughput real-time streaming architectures.

LOADOUT is built on a strict **local-first, privacy-preserving foundation**: user datasets, raw records, and sensitive payloads never leave the browser. While the deterministic measurement engine profiles execution times and enforces semantic correctness gates, the integrated AI Copilot interprets statistical results, explains performance trade-offs, and recommends verified optimization strategies using an embedded knowledge retrieval (RAG) system.

---

## Table of Contents

- [Core Principles](#core-principles)
- [Architecture & Subsystems](#architecture--subsystems)
  - [1. Data Ingestion & Stream Parsing](#1-data-ingestion--stream-parsing)
  - [2. Canonical Benchmark Engine & Provenance](#2-canonical-benchmark-engine--provenance)
  - [3. Semantic Correctness Verification Gate](#3-semantic-correctness-verification-gate)
  - [4. Workload Laboratories](#4-workload-laboratories)
  - [5. Privacy Gateway & AI Copilot](#5-privacy-gateway--ai-copilot)
  - [6. Local Persistence & State Engine](#6-local-persistence--state-engine)
- [Monorepo Structure](#monorepo-structure)
- [Getting Started](#getting-started)
- [Verification & Quality Commands](#verification--quality-commands)
- [Technology Stack](#technology-stack)
- [Privacy & Security Guarantees](#privacy--security-guarantees)
- [License](#license)

---

## Core Principles

1. **Empirical Measurement Over Intuition**  
   Optimizations are never declared successful based on one-off runs or speculative micro-benchmarks. LOADOUT runs multi-trial benchmark policies with configurable warmups, inter-run cooldowns, monotonic sub-millisecond clocks (`performance.now()`), and non-parametric hypothesis testing (Mann-Whitney U).

2. **The Correctness Gate Precedes Performance Claims**  
   A faster algorithm that alters semantics, drops records, corrupts field types, or introduces silent regressions is a broken optimization. Every candidate variant must pass automated correctness gate verification before its performance is recognized.

3. **Strict Local-First Privacy (Zero Data Egress)**  
   User files and raw dataset rows remain exclusively in client memory or browser IndexedDB storage. The AI subsystem operates across a strict Privacy Gateway that sanitizes context into structural metadata and statistical metrics, cryptographically asserting that raw data never touches external network endpoints.

4. **Transparent Metric Provenance**  
   Every number displayed in LOADOUT carries unambiguous provenance: `real-measurement`, `simulated-estimate`, `deterministic-heuristic`, or `derived-calculation`.

---

## Architecture & Subsystems

```
                                      +---------------------------------------------+
                                      |            LOADOUT Workbench UI             |
                                      |  (AppShell, Router, Deep-Linking, Drawer)   |
                                      +----------------------+----------------------+
                                                             |
                 +---------------------------+---------------+---------------------------+
                 |                           |                                           |
                 v                           v                                           v
    +-------------------------+ +-------------------------+               +-------------------------+
    |   Dataset Laboratory    | |    Image Laboratory     |               |    Stream Laboratory    |
    | - Streaming RFC4180 CSV | | - AVIF / WebP / JPEG    |               | - 500-10k msgs/sec      |
    | - NDJSON Stream Parser  | | - Canvas / Offscreen    |               | - Drop-oldest / Drop-new|
    | - Web Worker Filtering  | | - createImageBitmap     |               | - rAF Visual Throttle   |
    | - Virtualized DOM Render| | - Blob Lifecycle (Revoke|               | - Transactional Logging |
    +------------+------------+ +------------+------------+               +------------+------------+
                 |                           |                                         |
                 +---------------------------+-----------------------------------------+
                                             |
                                             v
                              +-----------------------------+
                              | Deterministic Benchmark Engine|
                              | - Injectable Monotonic Clock|
                              | - Warmup & Measured Trials  |
                              | - Cooldown & Execution Guard|
                              | - Environment Fingerprinting|
                              +--------------+--------------+
                                             |
                 +---------------------------+---------------------------+
                 |                                                       |
                 v                                                       v
+---------------------------------+                     +---------------------------------+
| Semantic Correctness Gate (M1)  |                     | Statistical Aggregation (M1)    |
| - Record count parity           |                     | - Mean, Median, Min, Max, Spread|
| - Schema & field parity         |                     | - Sample Variance & Std Dev     |
| - Type & null value preservation|                     | - P95 & P99 with sample caveats |
| - djb2 64-bit Hex Hash Samples  |                     | - Mann-Whitney U Hypothesis Test|
| - Structured divergence reports |                     | - Comparison Uncertainty Verdict|
+---------------------------------+                     +---------------------------------+
                 |                                                       |
                 +---------------------------+---------------------------+
                                             |
                                             v
                              +-----------------------------+
                              |   Local IndexedDB Engine    |
                              | - Sessions, Benchmarks,     |
                              |   Reports, User Settings    |
                              | - In-Memory Fallback Adapter|
                              +--------------+--------------+
                                             |
                                             v
                              +-----------------------------+
                              |   AI Privacy Gateway        |
                              | - Zero-Leakage Sanitization |
                              | - Strips all raw row data   |
                              | - Structural context only   |
                              +--------------+--------------+
                                             |
                 +---------------------------+---------------------------+
                 |                                                       |
                 v                                                       v
+---------------------------------+                     +---------------------------------+
| Curated RAG Knowledge Base      |                     | AI Copilot Provider Engine      |
| - In-Memory BM25/Lexical Search |                     | - Offline Rule-Based Provider   |
| - Engineering Citations & Links |                     | - BYOK OpenAI Provider          |
| - Virtualization, GC, Workers   |                     | - BYOK Gemini Provider          |
+---------------------------------+                     +---------------------------------+
```

### 1. Data Ingestion & Stream Parsing
- **Streaming RFC 4180 CSV Engine**: Handles multi-line quoted fields, escaped quotes (`""`), and CRLF/LF line endings.
- **NDJSON Stream Parser**: Fault-tolerant line-by-line parsing that recovers from malformed individual rows without terminating ingestion.
- **Chunked Processing & Backpressure**: Streams in 64 KB binary chunks with microtask backpressure yielding (`setTimeout(0)`) to preserve UI responsiveness on large files.
- **Client Resource Limits**: Guarded with a 100 MB hard ceiling and AbortSignal cancellation support.
- **Synthetic Benchmark Presets**: Includes deterministic generators (`events-10k.csv`, `inventory-50k.csv`, `logs-100k.json`) for stress-testing DOM virtualization and search algorithms immediately without external files.

### 2. Canonical Benchmark Engine & Provenance
- **Metric Provenance**: Every metric emitted by the engine conforms to canonical Zod schemas, tagged with measurement methodology and unit descriptions.
- **Execution Runner (`runner.ts`)**: Decoupled from React, executing isolated workload adapters through a deterministic lifecycle:
  1. Validate benchmark policy and inputs.
  2. Capture environment metadata (`userAgent`, hardware concurrency, platform, memory heap status).
  3. Execute setup phase.
  4. Execute warmup iterations (discarded from final metrics).
  5. Execute measured iterations with inter-run cooldowns.
  6. Enforce execution timeouts per trial.
  7. Execute teardown/cleanup.
  8. Aggregate trial distributions.
- **Statistical Rigor (`statistics.ts`)**:
  - Sample variance and standard deviation using Bessel's correction ($N - 1$).
  - Percentiles (P95, P99) and quartiles (Q1, Q3, IQR) computed via NIST recommended linear interpolation.
  - Tukey's fences for IQR-based outlier classification.
  - Transparent sample reliability warnings: small sample sets (e.g. $N = 5$) explicitly flag tail-latency estimates as preliminary indicators.
  - Baseline vs. candidate uncertainty evaluation via the Mann-Whitney U rank-sum test with normal approximation, yielding definitive verdicts: `improved`, `regressed`, `inconclusive`, or `no-difference`.

### 3. Semantic Correctness Verification Gate
- **Validation Modes**:
  - `exact`: Full record and property equality across the complete dataset.
  - `canonical`: Structural normalization with key-order independence.
  - `sampled`: High-speed deterministic sampling for massive datasets, explicitly reporting sample size and coverage confidence.
- **Verification Checks**:
  - Record count parity.
  - Schema and column key parity.
  - Primitive and composite type consistency.
  - Null, undefined, and missing key semantics.
  - Deep value equivalence with configurable floating-point tolerances.
  - Deterministic 64-bit djb2 hex hashing of dataset states.
  - Structured divergence reporting detailing exact mismatch indices, expected values, and actual values.

### 4. Workload Laboratories
- **Dataset Lab**: Comprehensive 6-step workbench pipeline: Intake $\rightarrow$ Schema Profiling $\rightarrow$ Configuration $\rightarrow$ Controlled Benchmark $\rightarrow$ Correctness Gate $\rightarrow$ Actionable Implementation Guide with live code diffs.
  - Baseline: Naive DOM rendering and main-thread linear search.
  - Candidate: Virtualized row rendering (`@tanstack/react-virtual`) and non-blocking Web Worker off-thread search.
- **Image Lab**: Client-side image manipulation and asset optimization laboratory.
  - Browser format support detection (AVIF, WebP, JPEG).
  - Main-thread image decoding (`HTMLImageElement.decode()`) vs. asynchronous offscreen bitmap allocation (`createImageBitmap()`).
  - Strict blob URL lifecycle tracking (`URL.revokeObjectURL`) preventing memory leaks.
- **Stream Lab**: High-frequency streaming simulation and backpressure laboratory.
  - Throughput range from 500 to 10,000 messages/second.
  - Backpressure queue strategies: drop-oldest vs. drop-newest.
  - Frame-rate coalescing: visual rendering throttled via `requestAnimationFrame` while preserving lossless transactional message logging.
  - Explicit provenance labeling: `Simulated In-Memory Clock • Zero Network Egress`.

### 5. Privacy Gateway & AI Copilot
- **Privacy Boundary**: Sits between the workbench state and all AI providers. It strips raw dataset rows, columns, and private values, constructing a sanitized payload containing only structural metadata (row count, column names, data types) and verified benchmark statistics.
- **Curated RAG Knowledge Base**: High-speed in-memory lexical search engine loaded with verified engineering papers and references:
  - DOM virtualization and layout thrashing avoidance.
  - Web Worker concurrency and structured clone overhead.
  - JavaScript memory management and Garbage Collection pause mitigation.
  - Real-time backpressure and streaming queue architectures.
  - Statistical benchmark methodology in V8/browser environments.
- **Multi-Provider Support**:
  - `OfflineAIProvider`: Built-in local rule-based heuristic intelligence engine requiring no API keys, interpreting benchmarks, trade-offs, and experiment plans locally.
  - `OpenAIProvider`: Direct user-configured BYOK integration.
  - `GeminiProvider`: Direct user-configured BYOK integration.
- **Interactive UI**: Sliding drawer accessible across the entire application with quick-prompt shortcuts, expandable citation cards, and an inspectable payload view disclosing the exact sanitized data sent to the AI.

### 6. Local Persistence & State Engine
- **Native IndexedDB Adapter (`db.ts`)**: Promisified, transaction-safe storage engine with zero external dependencies.
- **Headless & SSR Fallback**: Seamless, transparent in-memory storage fallback for Node.js test runners, headless environments, or private browsing modes.
- **Object Stores**:
  - `sessions`: Active workflow state, dataset metadata, and configuration.
  - `benchmarkResults`: Complete historical benchmark comparison records and correctness results.
  - `reports`: Saved optimization reports with metrics and findings.
  - `settings`: User preferences, AI provider selections, and encrypted local API keys.
- **State Export/Import**: One-click JSON backup bundle generation and restoration.

---

## Monorepo Structure

```
.
├── apps/
│   ├── web/                         # Frontend Application (React 19 + Vite 7 + Tailwind 4)
│   │   ├── src/
│   │   │   ├── auth/                # Authentication context & route guards
│   │   │   ├── components/
│   │   │   │   ├── ai/              # AI Copilot drawer & payload inspector
│   │   │   │   ├── compare/         # Dataset Benchmark comparison view
│   │   │   │   ├── configure/       # Experiment configuration view
│   │   │   │   ├── image/           # Image Lab view & format detectors
│   │   │   │   ├── implement/       # Code diffs & implementation recommendations
│   │   │   │   ├── intake/          # Dataset intake, presets & streaming dropzone
│   │   │   │   ├── layout/          # AppShell, navigation & header
│   │   │   │   ├── library/         # Engineering technique catalog
│   │   │   │   ├── overview/        # System dashboard
│   │   │   │   ├── profile/         # Schema profiler & bottleneck heuristics
│   │   │   │   ├── report/          # Executive report viewer & manager
│   │   │   │   ├── settings/        # Workbench & AI provider configuration
│   │   │   │   ├── stream/          # Stream Lab view & queue monitor
│   │   │   │   └── workloads/       # Workload catalog
│   │   │   ├── hooks/               # React hooks (e.g. useDatasetFilter)
│   │   │   ├── lib/
│   │   │   │   ├── ai/              # Privacy gateway, knowledge base & providers
│   │   │   │   ├── benchmark/       # Statistics, runner, correctness & workloads
│   │   │   │   ├── dataset/         # Ingestion, stream parsers & synthetic generators
│   │   │   │   ├── image/           # Image processor & canvas transforms
│   │   │   │   └── storage/         # IndexedDB & in-memory session persistence
│   │   │   ├── test/                # 24 test suites covering all workbench modules
│   │   │   ├── types/               # Canonical TypeScript contracts & Zod schemas
│   │   │   └── workers/             # Dedicated Web Workers (dataset-filter.worker.ts)
│   │   ├── index.html
│   │   └── vite.config.ts
│   └── api/                         # Backend Service (Node.js + Express 5 + Mongoose)
│       ├── src/
│       │   ├── common/              # App errors, middleware, request ID
│       │   ├── config/              # Environment & logger configuration
│       │   └── modules/             # Auth & Health endpoints
│       └── tsconfig.json
├── docs/                            # Architecture and product specification documents
├── package.json                     # Monorepo root package configuration
├── pnpm-workspace.yaml              # Workspace package definitions
├── tsconfig.base.json               # Root TypeScript configuration (erasableSyntaxOnly)
└── vitest.workspace.ts              # Vitest multi-project runner configuration
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.x` or later (LTS recommended)
- **pnpm**: `v9.x` or later (`corepack enable && corepack prepare pnpm@latest --activate`)

### Installation

```bash
# Clone the repository
git clone https://github.com/Error-Krishna/Loadout.git
cd Loadout

# Install all dependencies across the monorepo
pnpm install
```

### Running Locally

```bash
# Start both Web and API applications in development mode
pnpm dev

# Or run the Web workbench independently
pnpm --filter @loadout/web dev
```

The frontend workbench will be accessible at `http://localhost:5173`.

---

## Verification & Quality Commands

LOADOUT enforces a strict zero-regression quality gate. All checks must pass cleanly:

```bash
# 1. Typecheck all workspaces (strict TypeScript, erasableSyntaxOnly)
pnpm typecheck

# 2. Lint all workspaces (ESLint with zero warnings/errors)
pnpm lint

# 3. Run the complete automated test suite (191+ tests across 26 test files)
pnpm test

# 4. Execute production compilation and bundle verification
pnpm build
```

---

## Technology Stack

| Domain | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | React 19, TypeScript (Strict) | Component architecture and state lifecycle |
| **Build Tool** | Vite 7 | Lightning-fast HMR and optimized production bundles |
| **Styling** | Tailwind CSS v4, Lucide React | Modern, responsive technical workbench interface |
| **Routing** | React Router v7 | Deep-linking, navigation history, and breadcrumbs |
| **DOM Virtualization** | TanStack Virtual (`@tanstack/react-virtual`) | Efficient 60fps rendering of 100k+ row datasets |
| **Concurrency** | Dedicated Web Workers | Off-thread regex filtering and data processing |
| **Data Validation** | Zod v4 | Schema parity, benchmark contracts, metric validation |
| **Local Persistence** | Native IndexedDB API | Privacy-preserving local database with memory fallback |
| **Testing** | Vitest 3, React Testing Library, jsdom | Fast unit, integration, and E2E pipeline verification |
| **AI Integration** | Lexical BM25 RAG + BYOK Providers | Grounded performance interpretation with zero data egress |

---

## Privacy & Security Guarantees

- **No Data Egress**: Workloads and uploaded files remain entirely client-side.
- **Sanitized Telemetry**: Context sent to the AI Copilot includes only schema statistics and aggregated run distributions.
- **Inspectable AI Payloads**: Developers can inspect the exact JSON payload dispatched to LLM providers via the Copilot drawer.
- **Offline By Default**: The workbench functions fully without an active internet connection using the built-in `OfflineAIProvider`.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
