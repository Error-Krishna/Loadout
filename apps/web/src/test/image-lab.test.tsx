import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ImageLabView from '../components/image/ImageLabView';
import {
  createSampleImageWorkloads,
  generatePictureSnippet,
  detectSupportedImageFormats,
  revokeImageTransformResult,
  transformImageClient,
} from '../lib/image/image-processor';
import type { ImageTransformResult } from '../types/image';

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

  it('detects supported image formats without throwing in headless environments', async () => {
    const formats = await detectSupportedImageFormats();
    expect(formats).toHaveProperty('webp');
    expect(formats).toHaveProperty('avif');
    expect(formats).toHaveProperty('jpeg');
  });

  it('safely revokes blob URLs without throwing', () => {
    const mockRevoke = vi.fn();
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = mockRevoke;
    }
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(mockRevoke);
    const mockResult: ImageTransformResult = {
      format: 'webp',
      blob: new Blob([]),
      dataUrl: 'blob:http://localhost:3000/mock-uuid',
      sizeBytes: 1024,
      width: 800,
      height: 600,
      compressionRatio: 2,
      decodeTimeMs: 1.5,
      decodeMode: 'offscreen',
    };

    revokeImageTransformResult(mockResult);
    expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost:3000/mock-uuid');
    revokeSpy.mockRestore();

    // Calling with null or data: URL does not throw
    expect(() => revokeImageTransformResult(null)).not.toThrow();
  });

  it('transforms image with client canvas and returns structured result', async () => {
    const img = document.createElement('img');
    img.width = 400;
    img.height = 300;
    img.src = 'data:image/svg+xml;utf8,<svg></svg>';

    const res = await transformImageClient(img, {
      format: 'webp',
      quality: 0.8,
      maxWidth: 200,
      decodeMode: 'offscreen',
    });

    expect(res.format).toBe('webp');
    expect(res.width).toBeLessThanOrEqual(200);
    expect(res.decodeMode).toBe('offscreen');
  });

  it('renders image lab with controls and comparison panels', async () => {
    await act(async () => {
      render(<ImageLabView />);
    });

    expect(screen.getByText('Format & Delivery Benchmarking')).toBeInTheDocument();
    expect(screen.getByText('Baseline Source')).toBeInTheDocument();
    expect(screen.getByText('Optimized Candidate')).toBeInTheDocument();
    expect(screen.getByText('WebP (Modern)')).toBeInTheDocument();
    expect(screen.getByText('JPEG (Standard)')).toBeInTheDocument();

    // Toggle format
    const jpegBtn = screen.getByText('JPEG (Standard)');
    await act(async () => {
      fireEvent.click(jpegBtn);
    });
    expect(jpegBtn).toHaveClass('font-bold');
  });
});
