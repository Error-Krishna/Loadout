import { useState } from 'react';
import type { StreamConfig, StreamStrategy } from '../../types/stream';
import { useStreamSimulation } from '../../hooks/useStreamSimulation';

const STRATEGIES: { id: StreamStrategy; label: string; desc: string }[] = [
  {
    id: 'unthrottled',
    label: '1. Baseline (Unthrottled)',
    desc: 'Naive setState on every socket event. Triggers rapid render thrashing and drops frames.',
  },
  {
    id: 'batched',
    label: '2. Interval Batching',
    desc: 'Buffers events and flushes once every 100ms frame, slashing render calls by ~90%.',
  },
  {
    id: 'coalesced',
    label: '3. Visual Coalescing',
    desc: 'Deduplicates by sensor key, keeping only latest state. Best for dashboards & gauges.',
  },
  {
    id: 'bounded-queue',
    label: '4. Bounded Backpressure',
    desc: 'Caps memory queue to 200 items; drops oldest with explicit backpressure signals.',
  },
];

export default function StreamLabView() {
  const [config, setConfig] = useState<StreamConfig>({
    eventRate: 200,
    strategy: 'batched',
    batchIntervalMs: 100,
    queueCapacity: 200,
  });

  const { isRunning, start, stop, reset, activeItems, recentEvents, telemetry } =
    useStreamSimulation(config);

  const renderEfficiency =
    telemetry.eventsReceived > 0
      ? Math.round((1 - telemetry.renderCycles / telemetry.eventsReceived) * 100)
      : 0;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <div>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
            Modality • Real-Time Stream Lab
          </span>
          <h2 className="text-lg font-bold text-slate-100">Live Stream & Backpressure Workbench</h2>
          <p className="text-xs text-slate-400 font-mono">
            Simulate 10 to 1,000 events/sec. Test batching, visual coalescing, and buffer limits.
          </p>
          <div className="flex items-center gap-2 mt-2 text-[10px] font-mono text-slate-400">
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Provenance: In-Memory Simulated Wire
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
              Zero Network Egress
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Timer: performance.now()
            </span>
          </div>
        </div>

        {/* Engine Actions */}
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <button
              type="button"
              onClick={start}
              className="px-4 py-1.5 text-xs font-semibold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors shadow-sm font-mono flex items-center gap-1.5"
            >
              ▶ Start Stream
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="px-4 py-1.5 text-xs font-semibold rounded bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm font-mono flex items-center gap-1.5"
            >
              ⏸ Pause Stream
            </button>
          )}

          <button
            type="button"
            onClick={reset}
            className="px-3 py-1.5 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Control Configuration Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Strategy Selector */}
        <div className="lg:col-span-2 p-4 rounded-lg border border-slate-800 bg-[var(--color-surface)] space-y-3">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            Ingestion & Dispatch Strategy
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, strategy: s.id }))}
                className={`p-3 rounded border text-left transition-all ${
                  config.strategy === s.id
                    ? 'border-cyan-500/80 bg-cyan-950/30 ring-1 ring-cyan-500/40 text-slate-100'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-mono text-xs font-bold text-cyan-300">{s.label}</div>
                <div className="text-[11px] text-slate-400 mt-1 leading-tight">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Rate Controls */}
        <div className="p-4 rounded-lg border border-slate-800 bg-[var(--color-surface)] space-y-4">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            Stream Parameters
          </span>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">Event Rate:</span>
              <span className="text-cyan-400 font-bold">{config.eventRate} events / sec</span>
            </div>
            <div className="flex gap-2">
              {[50, 200, 500, 1000].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, eventRate: rate }))}
                  className={`flex-1 py-1 text-xs font-mono rounded ${
                    config.eventRate === rate
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {rate}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">Flush Interval:</span>
              <span className="text-slate-200 font-bold">{config.batchIntervalMs} ms</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              Buffers updates into requestAnimationFrame / 100ms ticks to prevent React cascading
              renders.
            </p>
          </div>
        </div>
      </div>

      {/* Live Telemetry Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Events Ingested */}
        <div className="p-4 rounded-lg border border-slate-800 bg-[var(--color-surface)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Ingested Events</span>
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-100 mt-1">
            {telemetry.eventsReceived.toLocaleString()}
          </p>
          <span className="text-[11px] font-mono text-slate-500">
            {config.eventRate} / sec wire rate
          </span>
        </div>

        {/* Render Passes (Hero Metric) */}
        <div className="p-4 rounded-lg border border-slate-800 bg-[var(--color-surface)]">
          <span className="text-xs font-mono text-slate-400">React Render Passes</span>
          <p
            className={`text-2xl font-bold font-mono mt-1 ${
              config.strategy === 'unthrottled' ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {telemetry.renderCycles.toLocaleString()}
          </p>
          <span className="text-[11px] font-mono text-emerald-400">
            {config.strategy === 'unthrottled'
              ? '100% Main Thread Load'
              : `-${renderEfficiency}% UI Trashes Saved`}
          </span>
        </div>

        {/* Coalesced / Dropped */}
        <div className="p-4 rounded-lg border border-slate-800 bg-[var(--color-surface)]">
          <span className="text-xs font-mono text-slate-400">Coalesced / Dropped</span>
          <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {(telemetry.eventsCoalesced + telemetry.eventsDropped).toLocaleString()}
          </p>
          <span className="text-[11px] font-mono text-slate-500">
            {telemetry.eventsDropped > 0
              ? `${telemetry.eventsDropped} dropped`
              : 'Lossless visual merge'}
          </span>
        </div>

        {/* Latency P95 */}
        <div className="p-4 rounded-lg border border-slate-800 bg-[var(--color-surface)]">
          <span className="text-xs font-mono text-slate-400">P95 Event Latency</span>
          <p className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            {telemetry.latencyP95Ms} ms
          </p>
          <span className="text-[11px] font-mono text-slate-500">
            P50: {telemetry.latencyP50Ms} ms
          </span>
        </div>
      </div>

      {/* Real-Time Sensor Gauge Grid & Stream Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sensor Gauges */}
        <div className="lg:col-span-2 p-5 rounded-lg border border-slate-800 bg-[var(--color-surface)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-mono text-slate-300 font-semibold uppercase">
              Live Sensor Visual State
            </span>
            <span className="text-xs font-mono text-cyan-400">
              Strategy: {config.strategy.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(activeItems).map(([key, val]) => (
              <div
                key={key}
                className="p-4 rounded-lg border border-slate-800/80 bg-slate-950/60 space-y-2 font-mono text-xs"
              >
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-semibold">{key}</span>
                  <span className="text-cyan-300 font-bold text-sm">{val}</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-cyan-500 h-full transition-all duration-75"
                    style={{ width: `${Math.max(5, Math.min(100, val))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Event Log */}
        <div className="p-5 rounded-lg border border-slate-800 bg-[var(--color-surface)] space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-300 font-semibold uppercase">Ingest Feed</span>
            <span className="text-slate-500 text-[10px]">Recent Events</span>
          </div>

          <div className="space-y-1.5 overflow-hidden">
            {recentEvents.length === 0 ? (
              <p className="text-slate-600 text-[11px] py-4 text-center">
                Press "Start Stream" to simulate high-frequency messages...
              </p>
            ) : (
              recentEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between p-1.5 rounded bg-slate-950/50 border border-slate-800/50 text-[11px]"
                >
                  <span className="text-slate-300 truncate max-w-[130px]">{evt.topic}</span>
                  <span className="text-cyan-400 font-semibold">{evt.value}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Production Architecture Caveats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-1.5">
          <span className="font-mono font-bold text-emerald-400 uppercase">
            1. Visual Coalescing
          </span>
          <h4 className="font-semibold text-slate-200">Safe for dashboards</h4>
          <p className="text-slate-400 leading-relaxed">
            When users monitor real-time state, intermediate value updates within the same 60 FPS
            frame are invisible to the human eye. Coalescing updates to the latest reading per key
            is 100% loss-free visually.
          </p>
        </div>

        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-1.5">
          <span className="font-mono font-bold text-rose-400 uppercase">2. Audit Integrity</span>
          <h4 className="font-semibold text-slate-200">Unsafe for transactions</h4>
          <p className="text-slate-400 leading-relaxed">
            Never coalesce or drop events for financial ledgers, user audit trails, or billing
            streams. Audit pipelines require bounded Ring Buffers and backpressure with sequence ID
            delivery.
          </p>
        </div>

        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-1.5">
          <span className="font-mono font-bold text-cyan-400 uppercase">3. WebSocket vs SSE</span>
          <h4 className="font-semibold text-slate-200">Server-to-client simplicity</h4>
          <p className="text-slate-400 leading-relaxed">
            For read-only streams (metrics, feeds, AI tokens), Server-Sent Events (SSE) provide
            built-in HTTP/2 multiplexing, automatic reconnection, and firewall traversal without
            WebSocket handshake overhead.
          </p>
        </div>
      </div>
    </div>
  );
}
