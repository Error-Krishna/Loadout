import type { LoadedDataset, SyntheticPreset } from '../../types/dataset';

export const SYNTHETIC_PRESETS: SyntheticPreset[] = [
  {
    id: 'events-10k',
    label: '10,000 Event Log',
    description: 'Web analytics stream with timestamps, status codes, and latency spikes.',
    rowCount: 10_000,
    format: 'csv',
  },
  {
    id: 'users-25k',
    label: '25,000 User Records',
    description: 'Relational user records with IDs, email domains, roles, and score distributions.',
    rowCount: 25_000,
    format: 'json',
  },
  {
    id: 'metrics-50k',
    label: '50,000 System Metrics',
    description:
      'High-frequency telemetry (CPU, memory, disk I/O) ideal for virtual table stress testing.',
    rowCount: 50_000,
    format: 'csv',
  },
];

const EVENT_NAMES = [
  'page_view',
  'click',
  'api_request',
  'db_query',
  'auth_token_refresh',
  'cache_miss',
];
const HTTP_CODES = [200, 200, 200, 201, 204, 400, 401, 404, 500, 502];
const ROLES = ['engineer', 'viewer', 'billing_admin', 'auditor', 'team_lead'];

export function generateSyntheticDataset(preset: SyntheticPreset): LoadedDataset {
  const startTime = Date.now() - preset.rowCount * 1000;

  if (preset.format === 'csv') {
    const isMetrics = preset.id.includes('metrics');
    const header = isMetrics
      ? 'id,timestamp,cpu_pct,memory_mb,disk_read_kb,service_name\n'
      : 'id,timestamp,event_name,user_id,status_code,latency_ms\n';

    const lines: string[] = [header];

    for (let i = 1; i <= preset.rowCount; i++) {
      const timestamp = new Date(startTime + i * 1000).toISOString();
      if (isMetrics) {
        const cpu = (15 + ((i * 7) % 85)).toFixed(1);
        const mem = (512 + ((i * 31) % 3500)).toString();
        const disk = ((i * 13) % 4096).toString();
        const service = `srv-node-0${(i % 8) + 1}`;
        lines.push(`${i},${timestamp},${cpu},${mem},${disk},${service}\n`);
      } else {
        const event = EVENT_NAMES[i % EVENT_NAMES.length]!;
        const userId = `usr_${1000 + (i % 850)}`;
        const code = HTTP_CODES[i % HTTP_CODES.length]!;
        const latency = (12 + ((i * 17) % 450)).toString();
        lines.push(`${i},${timestamp},${event},${userId},${code},${latency}\n`);
      }
    }

    const rawText = lines.join('');
    return {
      name: `${preset.id}.csv`,
      sizeBytes: new Blob([rawText]).size,
      format: 'csv',
      rawText,
      isSynthetic: true,
      rowCountEstimate: preset.rowCount,
    };
  }

  // JSON generation
  const records: Record<string, unknown>[] = [];
  for (let i = 1; i <= preset.rowCount; i++) {
    const role = ROLES[i % ROLES.length]!;
    records.push({
      id: i,
      name: `Engineer ${i}`,
      email: `engineer_${i}@loadout.internal`,
      role,
      score: (i * 19) % 1000,
      active: i % 5 !== 0,
      createdAt: new Date(startTime + i * 2000).toISOString(),
    });
  }

  const rawText = JSON.stringify(records, null, 2);
  return {
    name: `${preset.id}.json`,
    sizeBytes: new Blob([rawText]).size,
    format: 'json',
    rawText,
    isSynthetic: true,
    rowCountEstimate: preset.rowCount,
  };
}
