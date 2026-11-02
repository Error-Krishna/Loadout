import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ImageLabView from '../components/image/ImageLabView';
import { createSampleImageWorkloads, generatePictureSnippet } from '../lib/image/image-processor';

describe('ImageLabView and processor', () => {
  it('generates sample workloads with dimensions and format', () => {
    const samples = createSampleImageWorkloads();
    expect(samples.length).toBeGreaterThan(0);
    expect(samples[0]?.width).toBe(1200);
    expect(samples[0]?.format).toBe('png');
  });

  it('generates correct production picture HTML snippet', () => {
    const snippet = generatePictureSnippet('banner.png', 1200, 800, '1200 / 800');
    expect(snippet).toContain('<picture>');
    expect(snippet).toContain('srcset="/images/banner-360.webp');
    expect(snippet).toContain('loading="lazy"');
    expect(snippet).toContain('decoding="async"');
  });

  it('renders image lab with controls and comparison panels', () => {
    render(<ImageLabView />);

    expect(screen.getByText('Format & Delivery Benchmarking')).toBeInTheDocument();
    expect(screen.getByText('Baseline Source')).toBeInTheDocument();
    expect(screen.getByText('Optimized Candidate')).toBeInTheDocument();
    expect(screen.getByText('WebP (Modern)')).toBeInTheDocument();
    expect(screen.getByText('JPEG (Standard)')).toBeInTheDocument();

    // Toggle format
    const jpegBtn = screen.getByText('JPEG (Standard)');
    fireEvent.click(jpegBtn);
    expect(jpegBtn).toHaveClass('font-bold');
  });
});
