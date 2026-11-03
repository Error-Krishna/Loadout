import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AICopilotDrawer from '../components/ai/AICopilotDrawer';
import type { WorkbenchAIContext } from '../types/ai';

describe('AICopilotDrawer component', () => {
  const dummyContext: WorkbenchAIContext = {
    activeView: 'new-analysis',
    activeStep: 'compare',
    config: {
      goal: 'first-render',
      deviceTarget: 'desktop',
      maxMemoryMb: 50,
      localOnly: true,
    },
    datasetSummary: {
      name: 'test.csv',
      format: 'csv',
      rowCount: 1000,
      columnCount: 2,
      columns: ['id', 'name'],
    },
    activeBenchmark: null,
  };

  it('renders drawer when open and displays zero egress privacy status', () => {
    render(<AICopilotDrawer isOpen={true} onClose={vi.fn()} context={dummyContext} />);

    expect(screen.getByText('Performance Copilot')).toBeInTheDocument();
    expect(screen.getByText(/Private Mode: Zero Network Egress/i)).toBeInTheDocument();
    expect(screen.getByText(/What would you like to analyze\?/i)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AICopilotDrawer isOpen={false} onClose={vi.fn()} context={dummyContext} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('allows asking questions and renders local AI response with citations', async () => {
    render(<AICopilotDrawer isOpen={true} onClose={vi.fn()} context={dummyContext} />);

    const input = screen.getByPlaceholderText(/Ask about benchmark results/i);
    const sendBtn = screen.getByText('Send');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'How does virtualization reduce DOM nodes?' } });
      fireEvent.click(sendBtn);
    });

    expect(screen.getByText('How does virtualization reduce DOM nodes?')).toBeInTheDocument();
    // Knowledge retrieval response should appear
    expect(await screen.findByText(/Verified Citations:/i)).toBeInTheDocument();
  });

  it('toggles payload disclosure inspection', async () => {
    render(<AICopilotDrawer isOpen={true} onClose={vi.fn()} context={dummyContext} />);

    const inspectBtn = screen.getByText('Inspect Context');
    await act(async () => {
      fireEvent.click(inspectBtn);
    });

    expect(screen.getByText(/Sanitized Payload Disclosure:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Zero dataset records or user values leave the workbench/i),
    ).toBeInTheDocument();

    const hideBtn = screen.getByText('Hide Context');
    await act(async () => {
      fireEvent.click(hideBtn);
    });

    expect(screen.queryByText(/Sanitized Payload Disclosure:/i)).toBeNull();
  });
});
