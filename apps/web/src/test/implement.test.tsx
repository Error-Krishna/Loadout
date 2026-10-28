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

  it('renders copyable code block and gotchas matrix', () => {
    const handleProceed = vi.fn();
    const handleBack = vi.fn();

    render(
      <DatasetImplementationGuide
        dataset={mockDataset}
        onProceedToReport={handleProceed}
        onBackToCompare={handleBack}
      />,
    );

    expect(screen.getByText('TanStack Virtual Integration')).toBeInTheDocument();
    expect(screen.getByText(/pnpm add @tanstack\/react-virtual/i)).toBeInTheDocument();
    expect(screen.getByText('Copy React Component')).toBeInTheDocument();
    expect(screen.getByText('1. Browser Ctrl+F')).toBeInTheDocument();
    expect(screen.getByText('2. Dynamic Heights')).toBeInTheDocument();
    expect(screen.getByText('3. Keyboard Focus')).toBeInTheDocument();
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
