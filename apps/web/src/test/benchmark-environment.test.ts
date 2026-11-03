import { describe, expect, it } from 'vitest';
import { captureBenchmarkEnvironment } from '../lib/benchmark/environment';

describe('captureBenchmarkEnvironment (M1-T02b)', () => {
  it('captures live runtime environment conforming to BenchmarkEnvironment schema', () => {
    const env = captureBenchmarkEnvironment();

    expect(env.userAgent).toBeDefined();
    expect(env.platform).toBeDefined();
    expect(env.browserEngine).toBeDefined();
    expect(env.jsRuntime).toBeDefined();
    expect(new Date(env.capturedAt).toISOString()).toBe(env.capturedAt);
  });

  it('correctly maps Blink and V8 for Chromium user agents', () => {
    const mockNav: Partial<Navigator> = {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      platform: 'MacIntel',
      hardwareConcurrency: 10,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockNav as any).deviceMemory = 16;

    const env = captureBenchmarkEnvironment(mockNav, () => '2026-11-03T12:00:00.000Z');

    expect(env.browserEngine).toBe('Blink');
    expect(env.hardwareConcurrency).toBe(10);
    expect(env.deviceMemoryGb).toBe(16);
    expect(env.capturedAt).toBe('2026-11-03T12:00:00.000Z');
  });

  it('correctly maps Gecko for Firefox user agents and leaves deviceMemory undefined', () => {
    const mockNav: Partial<Navigator> = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
      platform: 'Win32',
      hardwareConcurrency: 8,
      // deviceMemory is not implemented in Firefox
    };

    const env = captureBenchmarkEnvironment(mockNav);

    expect(env.browserEngine).toBe('Gecko');
    expect(env.hardwareConcurrency).toBe(8);
    expect(env.deviceMemoryGb).toBeUndefined();
  });

  it('correctly maps WebKit for Safari user agents', () => {
    const mockNav: Partial<Navigator> = {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      platform: 'MacIntel',
      hardwareConcurrency: 8,
    };

    const env = captureBenchmarkEnvironment(mockNav);

    expect(env.browserEngine).toBe('WebKit');
    expect(env.deviceMemoryGb).toBeUndefined();
  });

  it('provides safe fallbacks for empty or missing navigator signals', () => {
    const env = captureBenchmarkEnvironment({});

    expect(env.userAgent).toBe('Unknown User Agent');
    expect(env.platform).toBe('Unknown Platform');
    expect(env.browserEngine).toBe('Unknown Engine');
    expect(env.hardwareConcurrency).toBeUndefined();
    expect(env.deviceMemoryGb).toBeUndefined();
  });
});
