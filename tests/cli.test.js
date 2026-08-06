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

test('cli init rejects invalid options before touching the schema', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-init-args-'));
  const schema = path.join(temp, 'nested', 'schema.yaml');
  const invalid = spawnSync(process.execPath, [cli, 'init', schema, '--bogus'], { encoding: 'utf8' });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /Unknown init option: --bogus/);
  await assert.rejects(fs.access(path.dirname(schema)));

  await fs.mkdir(path.dirname(schema));
  await fs.writeFile(schema, 'existing schema');
  const duplicate = spawnSync(process.execPath, [cli, 'init', schema, '--force', '--force'], { encoding: 'utf8' });
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /Duplicate init option: --force/);
  assert.equal(await fs.readFile(schema, 'utf8'), 'existing schema');

  const forced = spawnSync(process.execPath, [cli, 'init', schema, '--force'], { encoding: 'utf8' });
  assert.equal(forced.status, 0, forced.stderr);
  assert.notEqual(await fs.readFile(schema, 'utf8'), 'existing schema');
});

test('cli inspect and validate reject trailing arguments before reading a manifest', () => {
  const missingManifest = path.join(os.tmpdir(), 'testseed-not-read.json');
  for (const command of ['inspect', 'validate']) {
    const result = spawnSync(process.execPath, [cli, command, missingManifest, 'extra'], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`Unexpected ${command} argument: extra`));
    assert.doesNotMatch(result.stderr, /ENOENT/);
  }
});

test('generate rejects options used as --out and --seed values', () => {
  const schema = path.resolve('examples/people.yaml');
  const missingOut = spawnSync(process.execPath, [cli, 'generate', schema, '--out', '--clean'], { encoding: 'utf8' });
  assert.notEqual(missingOut.status, 0);
  assert.match(missingOut.stderr, /--out requires a value/);

  const missingSeed = spawnSync(process.execPath, [cli, 'generate', schema, '--seed', '--out', 'fixtures'], { encoding: 'utf8' });
  assert.notEqual(missingSeed.status, 0);
  assert.match(missingSeed.stderr, /--seed requires a value/);
});

test('generate rejects missing values, unknown options, and unexpected arguments', () => {
  const schema = path.resolve('examples/people.yaml');
  const cases = [
    { args: ['--out'], message: /--out requires a value/ },
    { args: ['--seed'], message: /--seed requires a value/ },
    { args: ['--out=fixtures'], message: /Unknown generate option: --out=fixtures/ },
    { args: ['--out', 'fixtures', '--unknown'], message: /Unknown generate option: --unknown/ },
    { args: ['--out', 'fixtures', 'extra'], message: /Unexpected generate argument: extra/ },
  ];

  for (const { args, message } of cases) {
    const result = spawnSync(process.execPath, [cli, 'generate', schema, ...args], { encoding: 'utf8' });
    assert.notEqual(result.status, 0, args.join(' '));
    assert.match(result.stderr, message);
  }
});

test('generate preserves default seed and boolean option behavior', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-cli-options-'));
  const out = path.join(temp, 'out');
  await fs.mkdir(out);
  await fs.writeFile(path.join(out, 'stale.txt'), 'stale');

  const result = spawnSync(process.execPath, [cli, 'generate', path.resolve('examples/people.yaml'), '--dry-run', '--clean', '--out', out], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /with seed 1/);
  assert.match(result.stdout, /"seed": "1"/);
  assert.equal(await fs.readFile(path.join(out, 'stale.txt'), 'utf8'), 'stale');
});

test('cli refuses unsafe output paths', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-unsafe-'));
  const schema = path.join(temp, 'schema.yaml');
  await fs.writeFile(schema, 'name: unsafe\ncount: 1\nfields:\n  id:\n    type: id\noutputs:\n  - path: ../oops.json\n    format: json\n');
  const result = spawnSync(process.execPath, [cli, 'generate', schema, '--out', path.join(temp, 'out')], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing path outside/);
});

test('generate reports invalid schema references without creating output', async () => {
  const schemas = [
    'name: invalid-output\ncount: 1\nfields:\n  id:\n    type: id\noutputs:\n  - path: out.json\n    format: json\n    fields: [missing]\n',
    'name: invalid-template\ncount: 1\nfields:\n  label:\n    type: template\n    template: user-{missing}\noutputs:\n  - path: out.json\n    format: json\n',
  ];

  for (const [index, contents] of schemas.entries()) {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-cli-reference-'));
    const schema = path.join(temp, `schema-${index}.yaml`);
    const out = path.join(temp, 'out');
    await fs.writeFile(schema, contents);
    const result = spawnSync(process.execPath, [cli, 'generate', schema, '--out', out], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unknown (output field|template reference)/);
    await assert.rejects(() => fs.access(out), /ENOENT/);
  }
});

test('validate reports tampered content hash mismatches', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-validate-hash-'));
  const out = path.join(temp, 'out');
  const generated = spawnSync(process.execPath, [cli, 'generate', path.resolve('examples/people.yaml'), '--out', out], { encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr);
  const target = path.join(out, 'people.json');
  const original = await fs.readFile(target);
  const tampered = Buffer.from(original);
  tampered[0] = tampered[0] === 0x5b ? 0x7b : 0x5b;
  await fs.writeFile(target, tampered);

  const result = spawnSync(process.execPath, [cli, 'validate', path.join(out, 'manifest.json')], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SHA-256 mismatch for people\.json: expected [a-f0-9]{64}, got [a-f0-9]{64}/);
});

test('validate reports byte count mismatches', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-validate-bytes-'));
  const out = path.join(temp, 'out');
  const generated = spawnSync(process.execPath, [cli, 'generate', path.resolve('examples/people.yaml'), '--out', out], { encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr);
  await fs.appendFile(path.join(out, 'people.json'), 'tampered');

  const result = spawnSync(process.execPath, [cli, 'validate', path.join(out, 'manifest.json')], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Byte count mismatch for people\.json: expected \d+, got \d+/);
});

test('validate reports missing generated files', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-validate-missing-'));
  const out = path.join(temp, 'out');
  const generated = spawnSync(process.execPath, [cli, 'generate', path.resolve('examples/people.yaml'), '--out', out], { encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr);
  await fs.rm(path.join(out, 'people.json'));

  const result = spawnSync(process.execPath, [cli, 'validate', path.join(out, 'manifest.json')], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing generated file: people\.json/);
});
