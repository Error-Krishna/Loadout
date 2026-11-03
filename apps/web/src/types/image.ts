export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'svg';

export interface ImageWorkload {
  id: string;
  name: string;
  format: ImageFormat;
  originalBytes: number;
  width: number;
  height: number;
  hasAlpha: boolean;
  dataUrl: string;
  isSample?: boolean;
}

export interface ImageTransformOptions {
  format: 'webp' | 'jpeg' | 'avif';
  quality: number; // 0.1 to 1.0
  maxWidth?: number;
  decodeMode?: 'offscreen' | 'main-thread';
}

export interface ImageTransformResult {
  format: string;
  blob: Blob;
  dataUrl: string;
  sizeBytes: number;
  width: number;
  height: number;
  compressionRatio: number;
  decodeTimeMs: number;
  decodeMode: 'offscreen' | 'main-thread';
  isEstimatedFallback?: boolean;
}

export interface ResponsiveSource {
  descriptor: string;
  width: number;
  height: number;
  sizeBytes: number;
  dataUrl: string;
}

export interface SupportedImageFormats {
  webp: boolean;
  avif: boolean;
  jpeg: boolean;
}
