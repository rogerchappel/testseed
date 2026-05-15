import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import type { Manifest, ManifestFile } from './types.js';

export const version = '0.1.0';

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function manifestFile(path: string, format: ManifestFile['format'], content: string, records?: number): ManifestFile {
  return { path, format, bytes: Buffer.byteLength(content), sha256: hashContent(content), records };
}

export function createManifest(schemaPath: string, seed: string, files: ManifestFile[]): Manifest {
  return {
    tool: 'testseed',
    version,
    schema: schemaPath,
    seed,
    generatedAt: 'deterministic-local-time',
    files,
    decisions: [
      `Seed ${seed} is mixed with field names and row indexes using sha256.`,
      'Outputs are written only under the requested output directory.',
      'Manifest timestamps are stable so generated fixtures diff cleanly.'
    ]
  };
}

export async function readManifest(path: string): Promise<Manifest> {
  return JSON.parse(await fs.readFile(path, 'utf8')) as Manifest;
}
