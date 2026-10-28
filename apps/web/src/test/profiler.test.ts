import { describe, expect, it } from 'vitest';
import { profileDataset } from '../lib/dataset/profiler';
import type { LoadedDataset } from '../types/dataset';

describe('profileDataset', () => {
  it('correctly profiles a CSV dataset and flags DOM overhead for large row counts', () => {
    const csvLines = ['id,name,score,createdAt'];
    for (let i = 1; i <= 1500; i++) {
      csvLines.push(`${i},User${i},${i * 10},2026-01-01T12:00:00Z`);
    }
    const rawText = csvLines.join('\n');

    const dataset: LoadedDataset = {
      name: 'test.csv',
      format: 'csv',
      sizeBytes: new Blob([rawText]).size,
      rawText,
      isSynthetic: true,
    };

    const profile = profileDataset(dataset);

    expect(profile.rowCount).toBe(1500);
    expect(profile.columnCount).toBe(4);
    expect(profile.columns.find((c) => c.name === 'id')?.type).toBe('number');
    expect(profile.columns.find((c) => c.name === 'createdAt')?.type).toBe('date');

    // Must trigger DOM explosion diagnostic because rows > 1000
    const domSignal = profile.diagnostics.find((d) => d.id === 'dom-explosion');
    expect(domSignal).toBeDefined();
    expect(domSignal?.severity).toBe('critical');
  });

  it('correctly profiles a JSON array dataset', () => {
    const data = [
      { id: 1, active: true, label: 'first' },
      { id: 2, active: false, label: 'second' },
    ];
    const rawText = JSON.stringify(data);

    const dataset: LoadedDataset = {
      name: 'test.json',
      format: 'json',
      sizeBytes: new Blob([rawText]).size,
      rawText,
      isSynthetic: false,
    };

    const profile = profileDataset(dataset);

    expect(profile.rowCount).toBe(2);
    expect(profile.columnCount).toBe(3);
    expect(profile.columns.find((c) => c.name === 'active')?.type).toBe('boolean');
  });
});
