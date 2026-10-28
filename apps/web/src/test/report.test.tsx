import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DatasetReportView from '../components/report/DatasetReportView';
import type { LoadedDataset } from '../types/dataset';

describe('DatasetReportView', () => {
  const mockDataset: LoadedDataset = {
    name: 'metrics.csv',
    format: 'csv',
    sizeBytes: 2048,
    rawText: 'id,metric\n1,10',
    isSynthetic: true,
    rowCountEstimate: 10000,
  };

  it('renders experiment summary and export buttons', () => {
    const handleRestart = vi.fn();
    const handleBack = vi.fn();

    render(
      <DatasetReportView
        dataset={mockDataset}
        onRestart={handleRestart}
        onBackToImplement={handleBack}
      />,
    );

    expect(screen.getByText('Performance Optimization Summary')).toBeInTheDocument();
    expect(screen.getByText(/Row Virtualization reduces DOM nodes/i)).toBeInTheDocument();
    expect(screen.getByText('Download JSON')).toBeInTheDocument();
    expect(screen.getByText('Copy Markdown Report')).toBeInTheDocument();
  });
});
