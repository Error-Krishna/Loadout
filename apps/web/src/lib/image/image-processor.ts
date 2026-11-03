import type {
  ImageWorkload,
  ImageTransformOptions,
  ImageTransformResult,
  ResponsiveSource,
  SupportedImageFormats,
} from '../../types/image.ts';

/**
 * Detects browser canvas encoder support for modern formats (WebP, AVIF, JPEG).
 */
export async function detectSupportedImageFormats(): Promise<SupportedImageFormats> {
  if (typeof document === 'undefined') {
    return { webp: true, avif: false, jpeg: true };
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  const checkMime = (mime: string): boolean => {
    try {
      const data = canvas.toDataURL(mime);
      return data.startsWith(`data:${mime}`);
    } catch {
      return false;
    }
  };

  return {
    webp: checkMime('image/webp'),
    avif: checkMime('image/avif'),
    jpeg: checkMime('image/jpeg'),
  };
}

/**
 * Safely revokes any blob URLs associated with a transform result to prevent memory leaks.
 */
export function revokeImageTransformResult(res: ImageTransformResult | null): void {
  if (
    res &&
    res.dataUrl &&
    res.dataUrl.startsWith('blob:') &&
    typeof URL !== 'undefined' &&
    URL.revokeObjectURL
  ) {
    try {
      URL.revokeObjectURL(res.dataUrl);
    } catch {
      // Ignored
    }
  }
}

export function createSampleImageWorkloads(): ImageWorkload[] {
  // High-res gradient image data URL
  const heroSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <radialGradient id="grad1" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#06b6d4" stop-opacity="1" />
        <stop offset="50%" stop-color="#3b82f6" stop-opacity="0.8" />
        <stop offset="100%" stop-color="#0f172a" stop-opacity="1" />
      </radialGradient>
      <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.6" />
        <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.6" />
      </linearGradient>
    </defs>
    <rect width="1200" height="800" fill="#020617"/>
    <circle cx="600" cy="400" r="380" fill="url(#grad1)"/>
    <rect x="200" y="250" width="800" height="300" rx="24" fill="url(#grad2)"/>
    <text x="600" y="410" font-family="monospace" font-size="32" font-weight="bold" fill="#f8fafc" text-anchor="middle">
      LOADOUT HIGH-RES SAMPLE (1200x800)
    </text>
  </svg>`;

  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <circle cx="256" cy="256" r="220" fill="#06b6d4" fill-opacity="0.9" />
    <polygon points="256,90 390,380 122,380" fill="#ffffff" fill-opacity="0.95" />
    <text x="256" y="320" font-family="monospace" font-size="28" font-weight="bold" fill="#0f172a" text-anchor="middle">
      ALPHA PNG
    </text>
  </svg>`;

  const heroDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(heroSvg)}`;
  const iconDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(iconSvg)}`;

  return [
    {
      id: 'img-sample-hero',
      name: 'hero-marketing-banner.png',
      format: 'png',
      originalBytes: 1_280_000, // ~1.28 MB original
      width: 1200,
      height: 800,
      hasAlpha: false,
      dataUrl: heroDataUrl,
      isSample: true,
    },
    {
      id: 'img-sample-icon',
      name: 'app-badge-transparency.png',
      format: 'png',
      originalBytes: 340_000, // ~340 KB original
      width: 512,
      height: 512,
      hasAlpha: true,
      dataUrl: iconDataUrl,
      isSample: true,
    },
  ];
}

export async function transformImageClient(
  img: HTMLImageElement,
  options: ImageTransformOptions,
): Promise<ImageTransformResult> {
  const canvas = document.createElement('canvas');
  const naturalWidth = img.naturalWidth || img.width || 800;
  const naturalHeight = img.naturalHeight || img.height || 600;
  const targetWidth = options.maxWidth ? Math.min(naturalWidth, options.maxWidth) : naturalWidth;
  const aspectRatio = naturalHeight / (naturalWidth || 1);
  const targetHeight = Math.round(targetWidth * aspectRatio);

  canvas.width = Math.max(1, targetWidth);
  canvas.height = Math.max(1, targetHeight);

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  }

  const mimeType =
    options.format === 'avif'
      ? 'image/avif'
      : options.format === 'webp'
        ? 'image/webp'
        : 'image/jpeg';

  const decodeMode = options.decodeMode ?? 'offscreen';

  return new Promise((resolve) => {
    // In headless environments (such as JSDOM without native canvas bindings),
    // getContext('2d') returns null or toBlob hangs without invoking callback.
    if (!ctx || typeof canvas.toBlob !== 'function') {
      resolve({
        format: options.format,
        blob: new Blob([]),
        dataUrl: img.src,
        sizeBytes: Math.round(1024 * 1024 * options.quality * 0.4),
        width: targetWidth,
        height: targetHeight,
        compressionRatio: 2.5,
        decodeTimeMs: 4.2,
        decodeMode,
        isEstimatedFallback: true,
      });
      return;
    }

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          // Fallback if browser does not support the requested format
          resolve({
            format: options.format,
            blob: new Blob([]),
            dataUrl: img.src,
            sizeBytes: Math.round(1024 * 1024 * options.quality * 0.4),
            width: targetWidth,
            height: targetHeight,
            compressionRatio: 2.5,
            decodeTimeMs: 4.2,
            decodeMode,
            isEstimatedFallback: true,
          });
          return;
        }

        const startDecode = performance.now();
        let decodeTime = 2.5;

        try {
          if (decodeMode === 'offscreen' && typeof createImageBitmap === 'function') {
            const bmp = await createImageBitmap(blob);
            decodeTime = Number((performance.now() - startDecode).toFixed(2));
            bmp.close();
          } else if (typeof Image !== 'undefined') {
            const testImg = new Image();
            testImg.src = URL.createObjectURL(blob);
            if (typeof testImg.decode === 'function') {
              await testImg.decode();
              decodeTime = Number((performance.now() - startDecode).toFixed(2));
            } else {
              decodeTime = Number((performance.now() - startDecode).toFixed(2));
            }
            URL.revokeObjectURL(testImg.src);
          }
        } catch {
          decodeTime = 3.0;
        }

        const dataUrl = URL.createObjectURL(blob);
        resolve({
          format: options.format,
          blob,
          dataUrl,
          sizeBytes: blob.size || Math.round(1024 * 1024 * options.quality * 0.35),
          width: targetWidth,
          height: targetHeight,
          compressionRatio: 1,
          decodeTimeMs: decodeTime,
          decodeMode,
        });
      },
      mimeType,
      options.quality,
    );
  });
}

export async function generateResponsiveVariants(
  img: HTMLImageElement,
  format: 'webp' | 'jpeg' | 'avif',
  quality: number,
): Promise<ResponsiveSource[]> {
  const widths = [360, 720, 1080];
  const results: ResponsiveSource[] = [];

  for (const w of widths) {
    const res = await transformImageClient(img, {
      format,
      quality,
      maxWidth: w,
    });
    results.push({
      descriptor: `${w}w`,
      width: res.width,
      height: res.height,
      sizeBytes: res.sizeBytes,
      dataUrl: res.dataUrl,
    });
  }

  return results;
}

export function generatePictureSnippet(
  filename: string,
  width: number,
  height: number,
  aspectRatio: string,
): string {
  const baseName = filename.replace(/\.[^/.]+$/, '');
  return `<picture>
  <!-- Modern Next-Gen AVIF & WebP Formats -->
  <source type="image/avif" srcset="/images/${baseName}-360.avif 360w, /images/${baseName}-720.avif 720w, /images/${baseName}-1080.avif 1080w" sizes="(max-width: 640px) 100vw, 720px" />
  <source type="image/webp" srcset="/images/${baseName}-360.webp 360w, /images/${baseName}-720.webp 720w, /images/${baseName}-1080.webp 1080w" sizes="(max-width: 640px) 100vw, 720px" />
  
  <!-- Fallback standard image with layout shift protection -->
  <img
    src="/images/${baseName}.jpg"
    alt="${baseName}"
    width="${width}"
    height="${height}"
    loading="lazy"
    decoding="async"
    style="aspect-ratio: ${aspectRatio}; width: 100%; height: auto;"
  />
</picture>`;
}
