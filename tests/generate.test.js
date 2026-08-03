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
  assert.throws(() => parseTinyYaml('name: nopecount: 0'), /count must be|requires/);
  assert.throws(() => parseTinyYaml('name: nope\ncount: 0\nfields:\n  id:\n    type: id\noutputs:\n  - path: out.json\n    format: json\n'), /count must be/);
});

test('schema validation accepts every built-in field type', () => {
  const types = ['id', 'name', 'slug', 'date', 'path', 'semver', 'sha', 'enum', 'int', 'template'];
  const fields = types.map((type) => `  ${type}_field:\n    type: ${type}`).join('\n');
  const schema = parseTinyYaml(`name: builtins\ncount: 1\nfields:\n${fields}\noutputs:\n  - path: out.json\n    format: json\n`);

  assert.deepEqual(Object.values(schema.fields).map((field) => field.type), types);
});

test('schema validation rejects unknown field types with SCHEMA_INVALID', () => {
  assert.throws(
    () => parseTinyYaml('name: unknown\ncount: 1\nfields:\n  mystery:\n    type: definitely-not-a-generator\noutputs:\n  - path: out.json\n    format: json\n'),
    (error) => error?.code === 'SCHEMA_INVALID' && /Unsupported field type.*definitely-not-a-generator/.test(error.message)
  );
});

test('unknown field types are rejected before output is written', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-unknown-type-'));
  const schema = path.join(temp, 'schema.yaml');
  const out = path.join(temp, 'out');
  await fs.writeFile(schema, 'name: unknown\ncount: 1\nfields:\n  mystery:\n    type: definitely-not-a-generator\noutputs:\n  - path: out.json\n    format: json\n');

  await assert.rejects(() => generate(schema, { seed: 1, outDir: out }), (error) => error?.code === 'SCHEMA_INVALID');
  await assert.rejects(() => fs.access(out), /ENOENT/);
});

test('inspect summarizes manifest contents', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-inspect-'));
  await generate(schemaPath, { seed: 7, outDir: out });
  const summary = await inspectManifest(path.join(out, 'manifest.json'));
  assert.match(summary, /testseed manifest/);
  assert.match(summary, /people.json/);
});

test('dry run returns a manifest without writing outputs', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-dry-'));
  const out = path.join(temp, 'absent');
  const manifest = await generate(schemaPath, { seed: 'dry', outDir: out, dryRun: true });
  assert.equal(manifest.files.length, 6);
  await assert.rejects(() => fs.access(out), /ENOENT/);
});

test('dry run with clean preserves an existing output directory', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-dry-clean-'));
  const sentinel = path.join(out, 'sentinel.txt');
  await fs.writeFile(sentinel, 'keep me');
  await generate(schemaPath, { seed: 'dry', outDir: out, dryRun: true, clean: true });
  assert.equal(await fs.readFile(sentinel, 'utf8'), 'keep me');
});

test('clean option removes stale files in output directory', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-clean-'));
  await fs.writeFile(path.join(out, 'stale.txt'), 'old');
  await generate(schemaPath, { seed: 'clean', outDir: out, clean: true });
  await assert.rejects(() => fs.readFile(path.join(out, 'stale.txt'), 'utf8'), /ENOENT/);
  assert.match(await fs.readFile(path.join(out, 'people.csv'), 'utf8'), /user_001/);
});

test('generation refuses secret-looking output filenames', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-secret-path-'));
  const schema = path.join(temp, 'schema.yaml');
  await fs.writeFile(schema, 'name: unsafe\ncount: 1\nfields:\n  id:\n    type: id\noutputs:\n  - path: private-key.pem\n    format: env\n');
  await assert.rejects(
    () => generate(schema, { seed: 1, outDir: path.join(temp, 'out') }),
    /Refusing likely secret-looking path/
  );
});
