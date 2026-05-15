import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveInside } from './path-safety.js';

export async function prepareOutDir(outDir: string, clean = false): Promise<void> {
  if (clean) await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
}

export async function writeGeneratedFile(outDir: string, relativePath: string, content: string): Promise<string> {
  const fullPath = resolveInside(outDir, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf8');
  return fullPath;
}
