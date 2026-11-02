import { useState, useEffect, useRef, useCallback } from 'react';
import type { StreamConfig, StreamEvent, StreamTelemetry } from '../types/stream';

const TOPICS = ['telemetry-alpha', 'telemetry-beta', 'telemetry-gamma', 'telemetry-delta'];

export function useStreamSimulation(config: StreamConfig) {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeItems, setActiveItems] = useState<Record<string, number>>({
    'telemetry-alpha': 50,
    'telemetry-beta': 50,
    'telemetry-gamma': 50,
    'telemetry-delta': 50,
  });
  const [recentEvents, setRecentEvents] = useState<StreamEvent[]>([]);
  const [telemetry, setTelemetry] = useState<StreamTelemetry>({
    eventsReceived: 0,
    eventsRendered: 0,
    eventsCoalesced: 0,
    eventsDropped: 0,
    renderCycles: 0,
    queueDepth: 0,
    latencyP50Ms: 0.5,
    latencyP95Ms: 1.2,
  });

  const bufferRef = useRef<StreamEvent[]>([]);
  const coalescedMapRef = useRef<Map<string, StreamEvent>>(new Map());
  const telemetryRef = useRef<StreamTelemetry>({ ...telemetry });
  const latencySamplesRef = useRef<number[]>([]);

  // Keep telemetryRef synced
  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);

  const reset = useCallback(() => {
    setIsRunning(false);
    bufferRef.current = [];
    coalescedMapRef.current.clear();
    latencySamplesRef.current = [];
    setActiveItems({
      'telemetry-alpha': 50,
      'telemetry-beta': 50,
      'telemetry-gamma': 50,
      'telemetry-delta': 50,
    });
    setRecentEvents([]);
    setTelemetry({
      eventsReceived: 0,
      eventsRendered: 0,
      eventsCoalesced: 0,
      eventsDropped: 0,
      renderCycles: 0,
      queueDepth: 0,
      latencyP50Ms: 0.5,
      latencyP95Ms: 1.2,
    });
  }, []);

  // Event producer timer
  useEffect(() => {
    if (!isRunning) return;

    // Interval between events in ms (e.g. 500 events/sec -> 2ms)
    const intervalMs = Math.max(1, Math.round(1000 / config.eventRate));

    const producerId = setInterval(() => {
      const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)]!;
      const delta = (Math.random() - 0.49) * 4;
      const prevVal = activeItems[topic] ?? 50;
      const newVal = Number(Math.max(10, Math.min(100, prevVal + delta)).toFixed(1));

      const event: StreamEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        topic,
        timestamp: performance.now(),
        value: newVal,
        payload: { delta, cpuLoad: Math.random() * 20 },
      };

      telemetryRef.current.eventsReceived += 1;

      if (config.strategy === 'unthrottled') {
        // Immediate unthrottled render
        telemetryRef.current.eventsRendered += 1;
        telemetryRef.current.renderCycles += 1;
        const latency = performance.now() - event.timestamp;
        latencySamplesRef.current.push(latency);

        setActiveItems((prev) => ({ ...prev, [topic]: newVal }));
        setRecentEvents((prev) => [event, ...prev.slice(0, 7)]);
      } else if (config.strategy === 'coalesced') {
        // Coalesce latest value by topic
        if (coalescedMapRef.current.has(topic)) {
          telemetryRef.current.eventsCoalesced += 1;
        }
        coalescedMapRef.current.set(topic, event);
        telemetryRef.current.queueDepth = coalescedMapRef.current.size;
      } else if (config.strategy === 'bounded-queue') {
        // Bounded queue with drop policy
        if (bufferRef.current.length >= config.queueCapacity) {
          telemetryRef.current.eventsDropped += 1;
        } else {
          bufferRef.current.push(event);
        }
        telemetryRef.current.queueDepth = bufferRef.current.length;
      } else {
        // Batched queue
        bufferRef.current.push(event);
        telemetryRef.current.queueDepth = bufferRef.current.length;
      }
    }, intervalMs);

    return () => clearInterval(producerId);
  }, [isRunning, config.eventRate, config.strategy, config.queueCapacity, activeItems]);

  // Consumer flush timer for batched / coalesced / bounded-queue
  useEffect(() => {
    if (!isRunning || config.strategy === 'unthrottled') return;

    const flushId = setInterval(() => {
      const startFlush = performance.now();

      if (config.strategy === 'coalesced') {
        if (coalescedMapRef.current.size === 0) return;

        const updates: Record<string, number> = {};
        const events: StreamEvent[] = [];
        let count = 0;

        coalescedMapRef.current.forEach((evt, top) => {
          updates[top] = evt.value;
          events.push(evt);
          count += 1;
        });

        coalescedMapRef.current.clear();
        telemetryRef.current.eventsRendered += count;
        telemetryRef.current.renderCycles += 1;
        telemetryRef.current.queueDepth = 0;

        const flushLatency = performance.now() - startFlush;
        latencySamplesRef.current.push(flushLatency);

        setActiveItems((prev) => ({ ...prev, ...updates }));
        setRecentEvents((prev) => [...events.slice(0, 3), ...prev.slice(0, 5)]);
      } else {
        // Batched or Bounded-queue
        if (bufferRef.current.length === 0) return;

        const batch = bufferRef.current.splice(0, bufferRef.current.length);
        const updates: Record<string, number> = {};

        batch.forEach((evt) => {
          updates[evt.topic] = evt.value;
        });

        telemetryRef.current.eventsRendered += batch.length;
        telemetryRef.current.renderCycles += 1;
        telemetryRef.current.queueDepth = 0;

        const flushLatency = performance.now() - startFlush;
        latencySamplesRef.current.push(flushLatency);

        setActiveItems((prev) => ({ ...prev, ...updates }));
        setRecentEvents((prev) => [...batch.slice(-3).reverse(), ...prev.slice(0, 5)]);
      }

      // Calculate latency percentiles
      const samples = latencySamplesRef.current;
      if (samples.length > 0) {
        const sorted = [...samples].sort((a, b) => a - b);
        const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0.8;
        const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 1.5;
        telemetryRef.current.latencyP50Ms = Number(p50.toFixed(2));
        telemetryRef.current.latencyP95Ms = Number(p95.toFixed(2));
      }

      setTelemetry({ ...telemetryRef.current });
    }, config.batchIntervalMs);

    return () => clearInterval(flushId);
  }, [isRunning, config.strategy, config.batchIntervalMs]);

  return {
    isRunning,
    start: () => setIsRunning(true),
    stop: () => setIsRunning(false),
    reset,
    activeItems,
    recentEvents,
    telemetry,
  };
}
