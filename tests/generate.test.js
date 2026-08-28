import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { buildRecords, generate, inspectManifest, parseTinyYaml } from '../dist/index.js';

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
  const options = { enum: '\n    values: [one, two]' };
  const fields = types.map((type) => `  ${type}_field:\n    type: ${type}${options[type] ?? ''}`).join('\n');
  const schema = parseTinyYaml(`name: builtins\ncount: 1\nfields:\n${fields}\noutputs:\n  - path: out.json\n    format: json\n`);

  assert.deepEqual(Object.values(schema.fields).map((field) => field.type), types);
});

test('schema validation accepts output subsets and template references', () => {
  const schema = parseTinyYaml('name: references\ncount: 1\nfields:\n  label:\n    type: template\n    template: user-{id}\n  id:\n    type: id\noutputs:\n  - path: out.json\n    format: json\n    fields: [label]\n');

  assert.deepEqual(schema.outputs[0].fields, ['label']);
  assert.equal(buildRecords(schema, '1')[0].label, 'user-id_001');
});

test('schema validation accepts distinct nested output paths', () => {
  const schema = parseTinyYaml('name: nested\ncount: 1\nfields:\n  id:\n    type: id\noutputs:\n  - path: json/data.txt\n    format: json\n  - path: csv/data.txt\n    format: csv\n');

  assert.deepEqual(schema.outputs.map((output) => output.path), ['json/data.txt', 'csv/data.txt']);
});

test('schema parsing rejects duplicate declarations with SCHEMA_PARSE', () => {
  const cases = [
    ['root key name', 'name: first\nname: second\ncount: 1\nfields:\n  id:\n    type: id\noutputs:\n  - path: out.json\n    format: json\n'],
    ['field name id', 'name: duplicate-field\ncount: 1\nfields:\n  id:\n    type: id\n  id:\n    type: name\noutputs:\n  - path: out.json\n    format: json\n'],
    ['field id key type', 'name: duplicate-field-key\ncount: 1\nfields:\n  id:\n    type: id\n    type: name\noutputs:\n  - path: out.json\n    format: json\n'],
    ['output key format', 'name: duplicate-output-key\ncount: 1\nfields:\n  id:\n    type: id\noutputs:\n  - path: out.json\n    format: json\n    format: csv\n'],
  ];

  for (const [declaration, schema] of cases) {
    assert.throws(
      () => parseTinyYaml(schema),
      (error) => error?.code === 'SCHEMA_PARSE' && error.message === `Duplicate ${declaration}`,
    );
  }
});

test('duplicate and equivalent output paths are rejected before output is changed', async () => {
  const outputPairs = [
    ['same.txt', 'same.txt'],
    ['nested/data.txt', 'nested/./data.txt'],
    ['nested/data.txt', 'nested\\\\data.txt'],
  ];

  for (const [first, second] of outputPairs) {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-output-collision-'));
    const schema = path.join(temp, 'schema.yaml');
    const out = path.join(temp, 'out');
    await fs.mkdir(out);
    await fs.writeFile(path.join(out, 'sentinel.txt'), 'keep me');
    await fs.writeFile(schema, `name: collision\ncount: 1\nfields:\n  id:\n    type: id\noutputs:\n  - path: ${first}\n    format: json\n  - path: ${second}\n    format: csv\n`);

    await assert.rejects(
      () => generate(schema, { seed: 1, outDir: out, clean: true }),
      (error) => error?.code === 'SCHEMA_INVALID' && /Duplicate output path/.test(error.message)
    );
    assert.deepEqual(await fs.readdir(out), ['sentinel.txt']);
    assert.equal(await fs.readFile(path.join(out, 'sentinel.txt'), 'utf8'), 'keep me');
  }
});

test('schema parsing preserves hashes in quoted scalars and removes trailing comments', () => {
  const schema = parseTinyYaml('name: comments\ncount: 1 # one fixture\nfields:\n  note:\n    type: template\n    template: "release #1" # displayed note\noutputs:\n  - path: out.json\n    format: json\n');

  assert.equal(schema.count, 1);
  assert.equal(schema.fields.note.template, 'release #1');
});

test('standalone quoted scalars decode supported quote escapes', () => {
  const schema = parseTinyYaml(`name: "quoted \\"schema\\""
count: 1
fields:
  note:
    type: template
    template: 'Roger''s \\ fixture'
outputs:
  - path: "nested\\\\output.json"
    format: json
`);

  assert.equal(schema.name, 'quoted "schema"');
  assert.equal(schema.fields.note.template, "Roger's \\ fixture");
  assert.equal(schema.outputs[0].path, 'nested\\output.json');
});

test('standalone quoted scalars reject malformed quoting with SCHEMA_PARSE', () => {
  const values = ['"unterminated', "'unterminated", '"mismatched\'', '\'mismatched"', '"closed" trailing', '"bad\\nescape"'];
  for (const value of values) {
    assert.throws(
      () => parseTinyYaml(`name: ${value}\ncount: 1\nfields:\n  id:\n    type: id\noutputs:\n  - path: out.json\n    format: json\n`),
      (error) => error?.code === 'SCHEMA_PARSE'
    );
  }
});

test('malformed standalone quoted scalars are rejected before output is changed', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-malformed-scalar-'));
  const schema = path.join(temp, 'schema.yaml');
  const out = path.join(temp, 'out');
  await fs.mkdir(out);
  await fs.writeFile(path.join(out, 'sentinel.txt'), 'keep me');
  await fs.writeFile(schema, 'name: "unterminated\ncount: 1\nfields:\n  id:\n    type: id\noutputs:\n  - path: out.json\n    format: json\n');

  await assert.rejects(
    () => generate(schema, { seed: 1, outDir: out, clean: true }),
    (error) => error?.code === 'SCHEMA_PARSE'
  );
  assert.deepEqual(await fs.readdir(out), ['sentinel.txt']);
  assert.equal(await fs.readFile(path.join(out, 'sentinel.txt'), 'utf8'), 'keep me');
});

test('compact lists preserve commas, hashes, and supported quote escapes', () => {
  const schema = parseTinyYaml(`name: quoted-lists
count: 1
fields:
  label:
    type: enum
    values: ["Doe, Jane", 'release #1', 'Roger''s fixture', "quoted \\"value\\""]
outputs:
  - path: tree.txt
    format: tree
    fields: ["label"]
    items: ["docs, examples", 'release #1']
`);

  assert.deepEqual(schema.fields.label.values, ['Doe, Jane', 'release #1', "Roger's fixture", 'quoted "value"']);
  assert.deepEqual(schema.outputs[0].fields, ['label']);
  assert.deepEqual(schema.outputs[0].items, ['docs, examples', 'release #1']);
});

test('compact lists reject malformed quoting with SCHEMA_PARSE', () => {
  const values = ['["Doe, Jane]', '["one" trailing, two]', '[one "two", three]', '["bad\\nescape"]'];
  for (const value of values) {
    assert.throws(
      () => parseTinyYaml(`name: invalid\ncount: 1\nfields:\n  label:\n    type: enum\n    values: ${value}\noutputs:\n  - path: out.json\n    format: json\n`),
      (error) => error?.code === 'SCHEMA_PARSE'
    );
  }
});

test('compact lists reject unmatched opening and closing brackets with SCHEMA_PARSE', () => {
  for (const value of ['[red, blue', 'red, blue]']) {
    assert.throws(
      () => parseTinyYaml(`name: invalid\ncount: 1\nfields:\n  color:\n    type: enum\n    values: ${value}\noutputs:\n  - path: out.json\n    format: json\n`),
      (error) => error?.code === 'SCHEMA_PARSE' && /Unmatched bracket/.test(error.message)
    );
  }
});

test('compact lists reject empty unquoted items before output is created', async () => {
  const values = ['[admin,]', '[,admin]', '[admin,,guest]'];
  for (const [index, value] of values.entries()) {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-empty-list-item-'));
    const schema = path.join(temp, `schema-${index}.yaml`);
    const out = path.join(temp, 'out');
    await fs.writeFile(schema, `name: invalid\ncount: 1\nfields:\n  role:\n    type: enum\n    values: ${value}\noutputs:\n  - path: out.json\n    format: json\n`);

    await assert.rejects(
      () => generate(schema, { seed: 1, outDir: out }),
      (error) => error?.code === 'SCHEMA_PARSE' && /Empty unquoted compact-list item/.test(error.message)
    );
    await assert.rejects(() => fs.access(out), /ENOENT/);
  }
});

test('compact lists preserve explicitly quoted empty strings', () => {
  const schema = parseTinyYaml(`name: quoted-empty
count: 1
fields:
  role:
    type: enum
    values: ['', "", admin]
outputs:
  - path: out.json
    format: json
`);

  assert.deepEqual(schema.fields.role.values, ['', '', 'admin']);
});

test('markdown output escapes table delimiters in generated values', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-markdown-'));
  const schemaPath = path.join(temp, 'schema.yaml');
  const out = path.join(temp, 'out');
  await fs.writeFile(schemaPath, 'name: markdown\ncount: 1\nfields:\n  label:\n    type: enum\n    values: ["A|B"]\n  note:\n    type: template\n    template: "release #1"\noutputs:\n  - path: table.md\n    format: md\n    fields: [label, note]\n');

  await generate(schemaPath, { seed: 1, outDir: out });
  assert.equal(await fs.readFile(path.join(out, 'table.md'), 'utf8'), '| label | note |\n| --- | --- |\n| A\\|B | release #1 |\n');
});

test('schema validation rejects unknown output fields and template references', () => {
  const schema = (fieldLine, template = 'user-{id}') => `name: invalid\ncount: 1\nfields:\n  label:\n    type: template\n    template: ${template}\n  id:\n    type: id\noutputs:\n  - path: out.json\n    format: json\n    fields: [${fieldLine}]\n`;

  assert.throws(() => parseTinyYaml(schema('missing')), (error) => error?.code === 'SCHEMA_INVALID' && /Unknown output field: missing/.test(error.message));
  assert.throws(() => parseTinyYaml(schema('id', 'user-{missing}')), (error) => error?.code === 'SCHEMA_INVALID' && /Unknown template reference.*missing/.test(error.message));
});

test('schema validation rejects invalid generator-specific options', () => {
  const field = (definition) => `name: invalid\ncount: 1\nfields:\n  value:\n${definition}\noutputs:\n  - path: out.json\n    format: json\n`;
  const invalidDefinitions = [
    '    type: date\n    start: 2024-02-30',
    '    type: date\n    stepDays: 1.5',
    '    type: sha\n    length: 0',
    '    type: enum\n    values: []',
    '    type: enum\n    values: [one, two]\n    weights: [1]',
    '    type: enum\n    values: [one]\n    weights: [0]',
    '    type: int\n    min: 2\n    max: 1',
    '    type: int\n    min: 1.5'
  ];

  for (const definition of invalidDefinitions) {
    assert.throws(() => parseTinyYaml(field(definition)), (error) => error?.code === 'SCHEMA_INVALID');
  }
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

test('unknown cross-field references are rejected before output is written', async () => {
  const schemas = [
    'name: invalid-output\ncount: 1\nfields:\n  id:\n    type: id\noutputs:\n  - path: out.json\n    format: json\n    fields: [id, missing]\n',
    'name: invalid-template\ncount: 1\nfields:\n  id:\n    type: id\n  label:\n    type: template\n    template: user-{missing}\noutputs:\n  - path: out.json\n    format: json\n    fields: [id]\n',
  ];

  for (const [index, contents] of schemas.entries()) {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-unknown-reference-'));
    const schema = path.join(temp, 'schema.yaml');
    const out = path.join(temp, 'out');
    await fs.writeFile(schema, contents);

    await assert.rejects(() => generate(schema, { seed: 1, outDir: out }), (error) => error?.code === 'SCHEMA_INVALID');
    await assert.rejects(() => fs.access(out), /ENOENT/);
  }
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
