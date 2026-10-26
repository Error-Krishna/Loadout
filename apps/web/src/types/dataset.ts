export type DatasetFormat = 'csv' | 'json';

export interface LoadedDataset {
  name: string;
  sizeBytes: number;
  format: DatasetFormat;
  rawText: string;
  isSynthetic: boolean;
  rowCountEstimate?: number;
}

export interface SyntheticPreset {
  id: string;
  label: string;
  description: string;
  rowCount: number;
  format: DatasetFormat;
}

export interface IntakeValidationError {
  title: string;
  message: string;
}
