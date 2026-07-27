import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { TestSeedError } from './errors.js';
import { resolveInside } from './path-safety.js';
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

export async function validateManifestFiles(manifestPath: string, manifest: Manifest): Promise<void> {
  const manifestDir = path.dirname(path.resolve(manifestPath));
  for (const file of manifest.files) {
    const filePath = resolveInside(manifestDir, file.path);
    let content: Buffer;
    try {
      content = await fs.readFile(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new TestSeedError(`Missing generated file: ${file.path}`);
      }
      throw error;
    }

    const actualBytes = content.byteLength;
    if (actualBytes !== file.bytes) {
      throw new TestSeedError(`Byte count mismatch for ${file.path}: expected ${file.bytes}, got ${actualBytes}`);
    }

    const actualHash = createHash('sha256').update(content).digest('hex');
    if (actualHash !== file.sha256) {
      throw new TestSeedError(`SHA-256 mismatch for ${file.path}: expected ${file.sha256}, got ${actualHash}`);
    }
  }
}
