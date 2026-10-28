import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DatasetImplementationGuide from '../components/implement/DatasetImplementationGuide';
import type { LoadedDataset } from '../types/dataset';

describe('DatasetImplementationGuide', () => {
  const mockDataset: LoadedDataset = {
    name: 'sample.csv',
    format: 'csv',
    sizeBytes: 1024,
    rawText: 'id,val\n1,a',
    isSynthetic: true,
  };

  it('renders copyable code block and gotchas matrix with tab navigation', () => {
    const handleProceed = vi.fn();
    const handleBack = vi.fn();

    render(
      <DatasetImplementationGuide
        dataset={mockDataset}
        onProceedToReport={handleProceed}
        onBackToCompare={handleBack}
      />,
    );

    // Initial tab: Virtualization
    expect(screen.getByText('DOM Virtualization (TanStack Virtual)')).toBeInTheDocument();
    expect(screen.getByText(/pnpm add @tanstack\/react-virtual/i)).toBeInTheDocument();
    expect(screen.getByText('Copy Code Template')).toBeInTheDocument();
    expect(screen.getByText('1. Browser Ctrl+F')).toBeInTheDocument();
    expect(screen.getByText('2. Dynamic Heights')).toBeInTheDocument();
    expect(screen.getByText('3. Keyboard Focus')).toBeInTheDocument();

    // Switch to Progressive Chunking tab
    const chunkingTab = screen.getByText('2. Progressive Chunking');
    fireEvent.click(chunkingTab);
    expect(screen.getByText('Progressive Chunking (Time-Slicing)')).toBeInTheDocument();
    expect(screen.getByText('Native Browser API (Zero Dependencies)')).toBeInTheDocument();
  });

  it('updates completed items count in the verification checklist', () => {
    render(
      <DatasetImplementationGuide
        dataset={mockDataset}
        onProceedToReport={vi.fn()}
        onBackToCompare={vi.fn()}
      />,
    );

    expect(screen.getByText('0 / 4 Verified')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);

    expect(screen.getByText('1 / 4 Verified')).toBeInTheDocument();
  });
});
