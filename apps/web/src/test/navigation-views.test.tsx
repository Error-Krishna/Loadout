import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OverviewView from '../components/overview/OverviewView';
import TechniqueLibraryView from '../components/library/TechniqueLibraryView';
import ReportsManagerView from '../components/report/ReportsManagerView';
import SettingsView from '../components/settings/SettingsView';

describe('Top-level navigation views', () => {
  it('renders OverviewView and handles CTA clicks', () => {
    const handleNavigate = vi.fn();
    const handleSynthetic = vi.fn();

    render(<OverviewView onNavigate={handleNavigate} onStartSyntheticAnalysis={handleSynthetic} />);

    expect(screen.getByText(/Find the right optimization. See the evidence./i)).toBeInTheDocument();
    expect(screen.getByText('Dataset Explorer')).toBeInTheDocument();
    expect(screen.getByText('Image Delivery Lab')).toBeInTheDocument();
    expect(screen.getByText('Real-Time Stream Lab')).toBeInTheDocument();

    const startBtn = screen.getByText('+ Start New Dataset Analysis');
    fireEvent.click(startBtn);
    expect(handleNavigate).toHaveBeenCalledWith('new-analysis');
  });

  it('renders TechniqueLibraryView and allows filtering by category', () => {
    render(<TechniqueLibraryView />);

    expect(screen.getByText('Frontend Optimization Technique Library')).toBeInTheDocument();
    expect(screen.getAllByText('DOM Virtualization (Windowing)')[0]).toBeInTheDocument();

    // Filter by Streams
    const streamsBtn = screen.getByRole('button', { name: 'Streams' });
    fireEvent.click(streamsBtn);
    expect(screen.getAllByText('Real-Time Event Batching')[0]).toBeInTheDocument();
  });

  it('renders ReportsManagerView with history and dossier details', () => {
    render(<ReportsManagerView />);

    expect(screen.getByText('Benchmark Dossier History')).toBeInTheDocument();
    expect(screen.getAllByText('ecommerce-inventory-25k.csv')[0]).toBeInTheDocument();
    expect(screen.getByText('Copy Markdown')).toBeInTheDocument();
    expect(screen.getByText('Download JSON')).toBeInTheDocument();
  });

  it('renders SettingsView with resource bounds and storage purger', () => {
    render(<SettingsView />);

    expect(screen.getByText('Workbench Settings & Safety Budgets')).toBeInTheDocument();
    expect(screen.getByText('Max Worker Threads')).toBeInTheDocument();
    expect(screen.getByText('Zero-Transmission Privacy Guarantee')).toBeInTheDocument();
    expect(screen.getByText('Clear Local Storage')).toBeInTheDocument();
  });
});
