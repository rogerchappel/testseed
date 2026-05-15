#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { generate, inspectManifest, readManifest } from './index.js';
import { starterSchema } from './init.js';
import { TestSeedError } from './errors.js';

const help = `testseed — deterministic fixture data from tiny schemas 🌱

Usage:
  testseed init <schema.yaml> [--force]
  testseed generate <schema.yaml> --seed <seed> --out <dir> [--clean] [--dry-run]
  testseed inspect <manifest.json>
  testseed validate <manifest.json>

Commands:
  init       Write a starter schema.
  generate   Generate fixture files and a manifest.
  inspect    Summarize a generated manifest.
  validate   Check manifest shape and file metadata.
`;

function flag(args: string[], name: string, fallback?: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

async function main(argv: string[]): Promise<void> {
  const [command, target, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') { console.log(help); return; }
  if (command === 'init') {
    if (!target) throw new TestSeedError('init requires a schema path');
    const full = path.resolve(target);
    await fs.mkdir(path.dirname(full), { recursive: true });
    if (!rest.includes('--force')) {
      try { await fs.access(full); throw new TestSeedError(`Refusing to overwrite ${target}; pass --force`); } catch (error) { if (!(error instanceof TestSeedError)) { /* absent is okay */ } else throw error; }
    }
    await fs.writeFile(full, starterSchema(), 'utf8');
    console.log(`Wrote ${target}`);
    return;
  }
  if (command === 'generate') {
    if (!target) throw new TestSeedError('generate requires a schema path');
    const outDir = flag(rest, '--out');
    const seed = flag(rest, '--seed', '1');
    if (!outDir) throw new TestSeedError('generate requires --out <dir>');
    const manifest = await generate(target, { seed: seed ?? '1', outDir, clean: rest.includes('--clean'), dryRun: rest.includes('--dry-run') });
    console.log(`Generated ${manifest.files.length} files into ${outDir} with seed ${manifest.seed}`);
    if (rest.includes('--dry-run')) console.log(JSON.stringify(manifest, null, 2));
    return;
  }
  if (command === 'inspect') {
    if (!target) throw new TestSeedError('inspect requires a manifest path');
    console.log(await inspectManifest(target));
    return;
  }
  if (command === 'validate') {
    if (!target) throw new TestSeedError('validate requires a manifest path');
    const manifest = await readManifest(target);
    if (manifest.tool !== 'testseed' || !manifest.seed || manifest.files.length === 0) throw new TestSeedError('Invalid testseed manifest');
    for (const file of manifest.files) if (!file.path || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new TestSeedError(`Invalid manifest file entry: ${file.path}`);
    console.log(`Manifest OK: ${manifest.files.length} files`);
    return;
  }
  throw new TestSeedError(`Unknown command: ${command}`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`testseed: ${message}`);
  process.exitCode = 1;
});
