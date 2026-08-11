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
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(path, 'utf8')) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) throw new TestSeedError('Invalid testseed manifest: invalid JSON');
    throw error;
  }
  return validateManifest(parsed);
}

const outputFormats = new Set(['json', 'jsonl', 'csv', 'md', 'env', 'tree']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TestSeedError(`Invalid testseed manifest: ${field} must be a non-empty string`);
  }
}

export function validateManifest(value: unknown): Manifest {
  if (!isRecord(value)) throw new TestSeedError('Invalid testseed manifest: root must be an object');
  if (value.tool !== 'testseed') throw new TestSeedError('Invalid testseed manifest: tool must be "testseed"');
  for (const field of ['version', 'schema', 'seed', 'generatedAt'] as const) requireString(value[field], field);
  if (!Array.isArray(value.files) || value.files.length === 0) {
    throw new TestSeedError('Invalid testseed manifest: files must be a non-empty array');
  }
  if (!Array.isArray(value.decisions) || !value.decisions.every((decision) => typeof decision === 'string')) {
    throw new TestSeedError('Invalid testseed manifest: decisions must be an array of strings');
  }

  for (const [index, entry] of value.files.entries()) {
    const field = `files[${index}]`;
    if (!isRecord(entry)) throw new TestSeedError(`Invalid testseed manifest: ${field} must be an object`);
    requireString(entry.path, `${field}.path`);
    if (typeof entry.format !== 'string' || !outputFormats.has(entry.format)) {
      throw new TestSeedError(`Invalid testseed manifest: ${field}.format must be a supported output format`);
    }
    if (!Number.isSafeInteger(entry.bytes) || (entry.bytes as number) < 0) {
      throw new TestSeedError(`Invalid testseed manifest: ${field}.bytes must be a non-negative integer`);
    }
    if (typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw new TestSeedError(`Invalid testseed manifest: ${field}.sha256 must be a lowercase SHA-256 hash`);
    }
    if (entry.records !== undefined && (!Number.isSafeInteger(entry.records) || (entry.records as number) < 0)) {
      throw new TestSeedError(`Invalid testseed manifest: ${field}.records must be a non-negative integer`);
    }
  }

  return value as unknown as Manifest;
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
