import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { generate, inspectManifest, parseTinyYaml } from '../dist/index.js';

const schemaPath = path.resolve('fixtures/schemas/people.yaml');

test('generates deterministic fixture files from schema', async () => {
  const one = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-one-'));
  const two = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-two-'));
  const manifestOne = await generate(schemaPath, { seed: 42, outDir: one });
  const manifestTwo = await generate(schemaPath, { seed: 42, outDir: two });
  assert.deepEqual(manifestOne.files.map((file) => file.sha256), manifestTwo.files.map((file) => file.sha256));
  const people = JSON.parse(await fs.readFile(path.join(one, 'people.json'), 'utf8'));
  assert.equal(people.length, 4);
  assert.match(people[0].id, /^user_001$/);
});

test('different seeds alter generated content', async () => {
  const one = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-a-'));
  const two = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-b-'));
  const manifestOne = await generate(schemaPath, { seed: 'alpha', outDir: one });
  const manifestTwo = await generate(schemaPath, { seed: 'beta', outDir: two });
  assert.notDeepEqual(manifestOne.files.map((file) => file.sha256), manifestTwo.files.map((file) => file.sha256));
});

test('schema validation rejects invalid counts', () => {
  assert.throws(() => parseTinyYaml('name: nopecount: 0'), /Unknown root key|requires/);
  assert.throws(() => parseTinyYaml('name: nope\ncount: 0\nfields:\n  id:\n    type: id\noutputs:\n  - path: out.json\n    format: json\n'), /count must be/);
});

test('inspect summarizes manifest contents', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-inspect-'));
  await generate(schemaPath, { seed: 7, outDir: out });
  const summary = await inspectManifest(path.join(out, 'manifest.json'));
  assert.match(summary, /testseed manifest/);
  assert.match(summary, /people.json/);
});
