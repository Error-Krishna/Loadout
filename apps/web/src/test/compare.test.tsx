import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DatasetCompareLab from '../components/compare/DatasetCompareLab';
import type { LoadedDataset } from '../types/dataset';

describe('DatasetCompareLab', () => {
  const sampleCsv = `id,name,role\n1,Alice,Engineer\n2,Bob,Designer\n3,Charlie,Lead`;
  const mockDataset: LoadedDataset = {
    name: 'team.csv',
    format: 'csv',
    sizeBytes: new Blob([sampleCsv]).size,
    rawText: sampleCsv,
    isSynthetic: true,
    rowCountEstimate: 3,
  };

  it('renders the comparison lab with telemetry cards and table viewport', () => {
    const handleImplement = vi.fn();
    const handleBack = vi.fn();

    render(
      <DatasetCompareLab
        dataset={mockDataset}
        onProceedToImplement={handleImplement}
        onBackToProfile={handleBack}
      />,
    );

    expect(screen.getByText('team.csv')).toBeInTheDocument();
    expect(screen.getByText(/performance lab comparison/i)).toBeInTheDocument();
    expect(screen.getByText('Mounted DOM Nodes')).toBeInTheDocument();
    expect(screen.getByText('Render Duration')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^virtualized$/i })).toBeInTheDocument();
  });

  it('allows toggling between baseline, progressive, and virtualized modes', () => {
    const handleImplement = vi.fn();
    const handleBack = vi.fn();

    render(
      <DatasetCompareLab
        dataset={mockDataset}
        onProceedToImplement={handleImplement}
        onBackToProfile={handleBack}
      />,
    );

    // 1. Baseline mode
    const baselineBtn = screen.getByRole('button', { name: /^baseline$/i });
    fireEvent.click(baselineBtn);
    expect(screen.getByText('O(N) Linear')).toBeInTheDocument();
    expect(screen.getByText(/naive dom cap/i)).toBeInTheDocument();

    // 2. Progressive chunking mode
    const progressiveBtn = screen.getByRole('button', { name: /^progressive$/i });
    fireEvent.click(progressiveBtn);
    expect(screen.getByText('O(Batch) Streaming')).toBeInTheDocument();
    expect(screen.getByText(/batch size/i)).toBeInTheDocument();

    // 3. Virtualized mode
    const virtualBtn = screen.getByRole('button', { name: /^virtualized$/i });
    fireEvent.click(virtualBtn);
    expect(screen.getByText('O(1) Constant')).toBeInTheDocument();
  });
});
