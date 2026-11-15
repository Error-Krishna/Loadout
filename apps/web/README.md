# @loadout/web — LOADOUT Workbench Frontend

The core client-side application for LOADOUT Version 2.1, an AI-assisted performance engineering workbench. Built with React 19, TypeScript, Vite, and Tailwind CSS.

**Live Deployment:** [https://loadout-seven-virid.vercel.app/](https://loadout-seven-virid.vercel.app/)

---

## Highlights

- **Workload Laboratories**:
  - **Dataset Lab**: RFC 4180 streaming ingestion across chunk boundaries without truncation, schema profiler, controlled benchmark runner with live DOM mounting, correctness gate, and live implementation guide.
  - **Image Lab**: AVIF/WebP/JPEG format detection, main-thread vs offscreen canvas transforms, memory lifecycle management, and honest measured metrics without fabricated fallbacks.
  - **Stream Lab**: High-frequency streaming simulation (500–10,000 msgs/sec), backpressure drop strategies, visual coalescing, and bounded rolling-window telemetry.
- **Benchmark & Statistical Engine**:
  - Deterministic execution runner with warmup discard and inter-run cooldowns (`runner.ts`).
  - Pure statistical aggregation: sample variance, Type 7 percentiles, authentic non-parametric Mann-Whitney U rank-sum test with tie-corrected variance and continuity correction, and bootstrap median confidence intervals (`statistics.ts`).
  - Semantic Correctness Gate: record parity, field parity, deep value comparison with floating-point tolerance, 64-bit hashing, and contradiction-free hash parity (`correctness.ts`).
- **Free-First AI Architecture & Privacy Gateway**:
  - Strict zero-leakage privacy boundary (`privacy-gateway.ts`) ensuring no raw dataset rows leave the workbench.
  - Curated RAG retrieval with authentic mathematical BM25 ranking ($k_1=1.2, b=0.75$, $TF$, $IDF$, length normalization) and verified technical citations (`knowledge/`).
  - Free-First AI Subsystem: 1. Offline heuristic engine (zero network egress, zero API keys), 2. Groq Cloud AI via backend endpoint with automatic offline fallback (`providers/`). All commercial BYOK key fields removed.
- **Local Persistence & Recovery**:
  - Native IndexedDB promisified storage with transparent in-memory fallback (`db.ts`, `session-store.ts`), storage status exposure, and Zod-validated portable bundle imports.

---

## Development & Testing

```bash
# Start development server with HMR
pnpm dev

# Run TypeScript typecheck
pnpm typecheck

# Run ESLint
pnpm lint

# Run all test suites with Vitest
pnpm test

# Build production bundle
pnpm build
```
