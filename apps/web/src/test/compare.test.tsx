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
    expect(screen.getByText(/performance lab • side-by-side comparison/i)).toBeInTheDocument();
    expect(screen.getByText('Mounted DOM Nodes')).toBeInTheDocument();
    expect(screen.getByText('Render Duration')).toBeInTheDocument();
    expect(screen.getByText('Virtualized (60 FPS)')).toBeInTheDocument();
  });

  it('allows toggling between baseline and virtualized modes', () => {
    const handleImplement = vi.fn();
    const handleBack = vi.fn();

    render(
      <DatasetCompareLab
        dataset={mockDataset}
        onProceedToImplement={handleImplement}
        onBackToProfile={handleBack}
      />,
    );

    const baselineBtn = screen.getByText('Baseline (Naive)');
    fireEvent.click(baselineBtn);

    expect(screen.getByText('O(N) Linear')).toBeInTheDocument();
    expect(screen.getByText(/naive dom cap/i)).toBeInTheDocument();

    const virtualBtn = screen.getByText('Virtualized (60 FPS)');
    fireEvent.click(virtualBtn);

    expect(screen.getByText('O(1) Constant')).toBeInTheDocument();
  });
});
