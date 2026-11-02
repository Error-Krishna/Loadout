import { describe, expect, it } from 'vitest';
import { rankRecommendations } from '../lib/dataset/recommendation';
import type { DatasetProfile, AnalysisConfiguration } from '../types/dataset';

describe('rankRecommendations engine', () => {
  const mockProfile: DatasetProfile = {
    rowCount: 5000,
    columnCount: 8,
    columns: [],
    previewRows: [],
    rawSizeBytes: 250_000,
    estimatedHeapBytes: 1_200_000,
    estimatedDomNodes: 45_000,
    diagnostics: [],
  };

  const mockConfig: AnalysisConfiguration = {
    goal: 'first-render',
    deviceTarget: 'desktop',
    maxMemoryMb: 50,
    localOnly: true,
  };

  it('ranks virtualization as top pick for large row count with first-render goal', () => {
    const recs = rankRecommendations(mockProfile, mockConfig);

    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]?.id).toBe('rec-virtualization');
    expect(recs[0]?.isTopPick).toBe(true);
    expect(recs[0]?.score).toBeGreaterThan(85);
  });

  it('boosts worker search score when interaction is the primary goal', () => {
    const interactionConfig: AnalysisConfiguration = {
      ...mockConfig,
      goal: 'interaction',
    };

    const recs = rankRecommendations(mockProfile, interactionConfig);
    const workerRec = recs.find((r) => r.id === 'rec-worker-search');

    expect(workerRec).toBeDefined();
    expect(workerRec?.score).toBeGreaterThan(85);
  });

  it('includes progressive chunking and schema pruning for wide or moderate workloads', () => {
    const wideProfile: DatasetProfile = {
      ...mockProfile,
      columnCount: 20,
      rowCount: 1200,
    };

    const recs = rankRecommendations(wideProfile, {
      ...mockConfig,
      goal: 'memory',
      maxMemoryMb: 25,
    });

    const normRec = recs.find((r) => r.id === 'rec-data-normalization');
    const chunkRec = recs.find((r) => r.id === 'rec-progressive-chunking');

    expect(normRec).toBeDefined();
    expect(chunkRec).toBeDefined();
  });
});
