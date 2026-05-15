export type OutputFormat = 'json' | 'jsonl' | 'csv' | 'md' | 'env' | 'tree';

export interface FieldSchema {
  type: string;
  prefix?: string;
  start?: string;
  stepDays?: number;
  length?: number;
  values?: string[];
  weights?: number[];
  min?: number;
  max?: number;
  template?: string;
}

export interface OutputSchema {
  path: string;
  format: OutputFormat;
  fields?: string[];
  items?: string[];
}

export interface TestSeedSchema {
  name: string;
  count: number;
  fields: Record<string, FieldSchema>;
  outputs: OutputSchema[];
}

export interface GenerateOptions {
  seed: number | string;
  outDir: string;
  clean?: boolean;
  dryRun?: boolean;
}

export interface ManifestFile {
  path: string;
  format: OutputFormat;
  bytes: number;
  sha256: string;
  records?: number;
}

export interface Manifest {
  tool: 'testseed';
  version: string;
  schema: string;
  seed: string;
  generatedAt: string;
  files: ManifestFile[];
  decisions: string[];
}
