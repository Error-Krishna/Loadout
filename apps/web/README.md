# @loadout/web — LOADOUT Workbench Frontend

The core client-side application for LOADOUT Version 2.0, an AI-assisted performance engineering workbench. Built with React 19, TypeScript, Vite 7, and Tailwind CSS v4.

---

## Highlights

- **Workload Laboratories**:
  - **Dataset Lab**: RFC 4180 streaming ingestion, schema profiler, controlled benchmark runner, correctness gate, and live implementation guide.
  - **Image Lab**: AVIF/WebP/JPEG format detection, main-thread vs offscreen canvas transforms, memory lifecycle management.
  - **Stream Lab**: High-frequency streaming simulation (500–10,000 msgs/sec), backpressure drop strategies, and visual coalescing.
- **Milestone 1 Benchmark Engine**:
  - Deterministic execution runner with warmup discard and inter-run cooldowns (`runner.ts`).
  - Pure statistical aggregation: sample variance, percentiles, Mann-Whitney U hypothesis testing (`statistics.ts`).
  - Semantic Correctness Gate: record parity, field parity, deep value comparison, 64-bit hashing (`correctness.ts`).
- **AI Copilot & Privacy Gateway**:
  - Strict zero-leakage privacy boundary (`privacy-gateway.ts`).
  - In-memory RAG retrieval with verified technical citations (`knowledge/`).
  - Multi-provider support: Offline heuristic engine, OpenAI, and Gemini (`providers/`).
- **Local Persistence**:
  - Native IndexedDB promisified storage with transparent in-memory fallback (`db.ts`, `session-store.ts`).

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
