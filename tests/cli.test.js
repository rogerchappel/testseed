import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const cli = path.resolve('dist/cli.js');

test('cli help lists useful commands', () => {
  const result = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /init/);
  assert.match(result.stdout, /generate/);
  assert.match(result.stdout, /inspect/);
});

test('cli init, generate, inspect, validate flow works', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-cli-'));
  const schema = path.join(temp, 'schema.yaml');
  const out = path.join(temp, 'out');
  assert.equal(spawnSync(process.execPath, [cli, 'init', schema], { encoding: 'utf8' }).status, 0);
  const generated = spawnSync(process.execPath, [cli, 'generate', schema, '--seed', '99', '--out', out], { encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr);
  assert.match(generated.stdout, /Generated/);
  const inspected = spawnSync(process.execPath, [cli, 'inspect', path.join(out, 'manifest.json')], { encoding: 'utf8' });
  assert.equal(inspected.status, 0, inspected.stderr);
  const validated = spawnSync(process.execPath, [cli, 'validate', path.join(out, 'manifest.json')], { encoding: 'utf8' });
  assert.equal(validated.status, 0, validated.stderr);
});

test('cli refuses unsafe output paths', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-unsafe-'));
  const schema = path.join(temp, 'schema.yaml');
  await fs.writeFile(schema, 'name: unsafe\ncount: 1\nfields:\n  id:\n    type: id\noutputs:\n  - path: ../oops.json\n    format: json\n');
  const result = spawnSync(process.execPath, [cli, 'generate', schema, '--out', path.join(temp, 'out')], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing path outside/);
});
