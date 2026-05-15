import fs from 'node:fs/promises';
import { fail } from './errors.js';
import type { FieldSchema, OutputFormat, OutputSchema, TestSeedSchema } from './types.js';

const outputFormats = new Set<OutputFormat>(['json', 'jsonl', 'csv', 'md', 'env', 'tree']);

function parseScalar(raw: string): unknown {
  const value = raw.trim();
  if (value === '') return '';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((part) => String(parseScalar(part.trim())));
  }
  return value.replace(/^['"]|['"]$/g, '');
}

export function parseTinyYaml(text: string): TestSeedSchema {
  const schema: TestSeedSchema = { name: '', count: 0, fields: {}, outputs: [] };
  let section: 'root' | 'fields' | 'outputs' | 'field' | 'output' = 'root';
  let currentField: FieldSchema | undefined;
  let currentOutput: OutputSchema | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const withoutComment = rawLine.replace(/\s+#.*$/, '');
    if (!withoutComment.trim()) continue;
    const indent = withoutComment.match(/^ */)?.[0].length ?? 0;
    const line = withoutComment.trim();

    if (indent === 0) {
      currentField = undefined;
      currentOutput = undefined;
      if (line === 'fields:') { section = 'fields'; continue; }
      if (line === 'outputs:') { section = 'outputs'; continue; }
      const [key, ...rest] = line.split(':');
      const value = parseScalar(rest.join(':'));
      if (key === 'name') schema.name = String(value);
      else if (key === 'count') schema.count = Number(value);
      else fail(`Unknown root key: ${key}`, 'SCHEMA_PARSE');
      section = 'root';
      continue;
    }

    if (section === 'fields' && indent === 2 && line.endsWith(':')) {
      const name = line.slice(0, -1);
      currentField = { type: 'string' };
      schema.fields[name] = currentField;
      section = 'field';
      continue;
    }

    if (section === 'outputs' && indent === 2 && line.startsWith('- ')) {
      currentOutput = { path: '', format: 'json' };
      schema.outputs.push(currentOutput);
      const rest = line.slice(2);
      if (rest.includes(':')) {
        const [key, ...parts] = rest.split(':');
        assignOutput(currentOutput, key.trim(), parseScalar(parts.join(':')));
      }
      section = 'output';
      continue;
    }

    const [key, ...parts] = line.split(':');
    const value = parseScalar(parts.join(':'));
    if (section === 'field' && currentField) assignField(currentField, key.trim(), value);
    else if (section === 'output' && currentOutput) assignOutput(currentOutput, key.trim(), value);
    else fail(`Unexpected schema line: ${rawLine}`, 'SCHEMA_PARSE');
  }
  return validateSchema(schema);
}

function assignField(field: FieldSchema, key: string, value: unknown): void {
  if (key === 'type') field.type = String(value);
  else if (key === 'prefix') field.prefix = String(value);
  else if (key === 'start') field.start = String(value);
  else if (key === 'stepDays') field.stepDays = Number(value);
  else if (key === 'length') field.length = Number(value);
  else if (key === 'values') field.values = Array.isArray(value) ? value.map(String) : String(value).split(',').map((v) => v.trim());
  else if (key === 'weights') field.weights = Array.isArray(value) ? value.map(Number) : String(value).split(',').map(Number);
  else if (key === 'min') field.min = Number(value);
  else if (key === 'max') field.max = Number(value);
  else if (key === 'template') field.template = String(value);
  else fail(`Unknown field key: ${key}`, 'SCHEMA_PARSE');
}

function assignOutput(output: OutputSchema, key: string, value: unknown): void {
  if (key === 'path') output.path = String(value);
  else if (key === 'format') output.format = String(value) as OutputFormat;
  else if (key === 'fields') output.fields = Array.isArray(value) ? value.map(String) : String(value).split(',').map((v) => v.trim());
  else if (key === 'items') output.items = Array.isArray(value) ? value.map(String) : String(value).split(',').map((v) => v.trim());
  else fail(`Unknown output key: ${key}`, 'SCHEMA_PARSE');
}

export function validateSchema(schema: TestSeedSchema): TestSeedSchema {
  if (!schema.name) fail('Schema requires a name', 'SCHEMA_INVALID');
  if (!Number.isInteger(schema.count) || schema.count < 1 || schema.count > 10_000) fail('Schema count must be 1..10000', 'SCHEMA_INVALID');
  if (Object.keys(schema.fields).length === 0) fail('Schema requires at least one field', 'SCHEMA_INVALID');
  for (const [name, field] of Object.entries(schema.fields)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) fail(`Invalid field name: ${name}`, 'SCHEMA_INVALID');
    if (!field.type) fail(`Field ${name} requires type`, 'SCHEMA_INVALID');
  }
  if (schema.outputs.length === 0) fail('Schema requires at least one output', 'SCHEMA_INVALID');
  for (const output of schema.outputs) {
    if (!output.path) fail('Each output requires path', 'SCHEMA_INVALID');
    if (!outputFormats.has(output.format)) fail(`Unsupported output format: ${output.format}`, 'SCHEMA_INVALID');
  }
  return schema;
}

export async function readSchema(filePath: string): Promise<TestSeedSchema> {
  return parseTinyYaml(await fs.readFile(filePath, 'utf8'));
}
