import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DatasetIntake from '../components/intake/DatasetIntake';

describe('DatasetIntake', () => {
  it('renders dropzone, file requirements, and synthetic options', () => {
    const handleLoaded = vi.fn();
    render(<DatasetIntake onDatasetLoaded={handleLoaded} />);

    expect(screen.getByText(/drop your dataset here/i)).toBeInTheDocument();
    expect(screen.getByText(/bounded at 50 mb/i)).toBeInTheDocument();
    expect(screen.getByText(/10,000 Event Log/i)).toBeInTheDocument();
    expect(screen.getByText(/25,000 User Records/i)).toBeInTheDocument();
  });

  it('loads a synthetic dataset on preset click', async () => {
    const handleLoaded = vi.fn();
    render(<DatasetIntake onDatasetLoaded={handleLoaded} />);

    const presetBtn = screen.getByText(/10,000 Event Log/i);
    fireEvent.click(presetBtn);

    await waitFor(() => {
      expect(handleLoaded).toHaveBeenCalledTimes(1);
    });

    const loaded = handleLoaded.mock.calls[0]?.[0];
    expect(loaded).toBeDefined();
    expect(loaded.format).toBe('csv');
    expect(loaded.isSynthetic).toBe(true);
    expect(loaded.rowCountEstimate).toBe(10_000);
  });
});
