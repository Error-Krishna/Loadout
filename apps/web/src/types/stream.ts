export type StreamStrategy = 'unthrottled' | 'batched' | 'coalesced' | 'bounded-queue';

export interface StreamEvent {
  id: string;
  topic: string;
  timestamp: number;
  value: number;
  payload: Record<string, unknown>;
}

export interface StreamConfig {
  eventRate: number; // events per second (e.g. 50, 200, 500)
  strategy: StreamStrategy;
  batchIntervalMs: number; // e.g. 100ms
  queueCapacity: number; // e.g. 250
}

export interface StreamTelemetry {
  eventsReceived: number;
  eventsRendered: number;
  eventsCoalesced: number;
  eventsDropped: number;
  renderCycles: number;
  queueDepth: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
}
