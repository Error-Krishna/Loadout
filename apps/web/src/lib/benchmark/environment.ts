import {
  benchmarkEnvironmentSchema,
  type BenchmarkEnvironment,
} from '../../types/benchmark';

/**
 * Detects the underlying browser layout engine from User Agent tokens.
 * Honest representation: returns 'Unknown Engine' when signals are insufficient.
 */
function detectBrowserEngine(userAgent: string): string {
  if (!userAgent) return 'Unknown Engine';

  // Order matters: Chrome contains "Safari" and "AppleWebKit", Edge contains "Chrome"
  if (/Chromium|Chrome|Edg/i.test(userAgent)) {
    return 'Blink';
  }
  if (/Gecko/i.test(userAgent) && !/WebKit/i.test(userAgent)) {
    return 'Gecko';
  }
  if (/AppleWebKit/i.test(userAgent)) {
    return 'WebKit';
  }

  return 'Unknown Engine';
}

/**
 * Detects the JavaScript runtime engine.
 * Avoids guesswork: explicitly identifies Node.js vs known browser JS engines.
 */
function detectJsRuntime(userAgent: string): string {
  // Check for Node.js environment
  if (
    typeof process !== 'undefined' &&
    process.versions &&
    typeof process.versions.node === 'string'
  ) {
    return `Node.js ${process.versions.node} (V8)`;
  }

  if (!userAgent) return 'Standard JS Engine';

  if (/Chrome|Chromium|Edg/i.test(userAgent)) {
    return 'V8';
  }
  if (/Firefox/i.test(userAgent)) {
    return 'SpiderMonkey';
  }
  if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
    return 'JavaScriptCore';
  }

  return 'Standard JS Engine';
}

/**
 * Captures benchmark execution environment and hardware capabilities.
 *
 * Principles (LOADOUT SoT Sec. 10.2 & 10.6):
 * - Captures only information genuinely exposed by the browser/runtime.
 * - Does not infer exact CPU chipsets, physical RAM, or OS internals from weak heuristics.
 * - Handles missing properties (e.g. navigator.deviceMemory on Firefox/WebKit) as undefined.
 * - Injected navigator and clock support 100% deterministic testing.
 *
 * @param customNavigator - Optional partial Navigator object for testing or custom host injection.
 * @param now - Optional timestamp supplier (defaults to current ISO 8601 string).
 */
export function captureBenchmarkEnvironment(
  customNavigator?: Partial<Navigator>,
  now: () => string = () => new Date().toISOString(),
): BenchmarkEnvironment {
  const nav: Partial<Navigator> | undefined =
    customNavigator ?? (typeof navigator !== 'undefined' ? navigator : undefined);

  const userAgent = nav?.userAgent?.trim() || 'Unknown User Agent';
  const platform = nav?.platform?.trim() || 'Unknown Platform';

  // Hardware concurrency: logical CPU cores
  const rawConcurrency = nav?.hardwareConcurrency;
  const hardwareConcurrency =
    typeof rawConcurrency === 'number' && Number.isInteger(rawConcurrency) && rawConcurrency > 0
      ? rawConcurrency
      : undefined;

  // Device memory: approximate RAM in GiB (Chromium-only API, quantized to 0.25 - 8 GB for privacy)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawMemory = (nav as any)?.deviceMemory;
  const deviceMemoryGb =
    typeof rawMemory === 'number' && Number.isFinite(rawMemory) && rawMemory > 0
      ? rawMemory
      : undefined;

  const browserEngine = detectBrowserEngine(userAgent);
  const jsRuntime = detectJsRuntime(userAgent);
  const capturedAt = now();

  const env: BenchmarkEnvironment = {
    userAgent,
    platform,
    hardwareConcurrency,
    deviceMemoryGb,
    browserEngine,
    jsRuntime,
    capturedAt,
  };

  // Validate against canonical contract schema
  return benchmarkEnvironmentSchema.parse(env);
}
