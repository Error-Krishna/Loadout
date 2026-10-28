import '@testing-library/jest-dom/vitest';

class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage(data: unknown) {
    setTimeout(() => {
      if (this.onmessage) {
        const req = data as { id: number; rows: unknown[] };
        this.onmessage(
          new MessageEvent('message', {
            data: {
              id: req.id,
              filteredIndices: req.rows ? req.rows.map((_, i) => i) : [],
              durationMs: 0.5,
            },
          }),
        );
      }
    }, 0);
  }
  terminate() {}
}

if (typeof window !== 'undefined' && !window.Worker) {
  // @ts-expect-error Mocking Worker in jsdom test harness
  window.Worker = MockWorker;
}
