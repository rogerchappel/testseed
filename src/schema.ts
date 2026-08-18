import fs from 'node:fs/promises';
import { fail } from './errors.js';
import { assertSafeRelativePath } from './path-safety.js';
import type { FieldSchema, FieldType, OutputFormat, OutputSchema, TestSeedSchema } from './types.js';

const outputFormats = new Set<OutputFormat>(['json', 'jsonl', 'csv', 'md', 'env', 'tree']);
const fieldTypes = new Set<FieldType>(['id', 'name', 'slug', 'date', 'path', 'semver', 'sha', 'enum', 'int', 'template']);

function parseScalar(raw: string): unknown {
  const value = raw.trim();
  if (value === '') return '';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return parseCompactList(inner);
  }
  return value.replace(/^['"]|['"]$/g, '');
}

function parseCompactList(inner: string): string[] {
  const values: string[] = [];
  let value = '';
  let quote: "'" | '"' | undefined;
  let quoted = false;
  let closedQuote = false;

  const finish = (): void => {
    if (quote) fail('Unterminated quote in compact list', 'SCHEMA_PARSE');
    const item = quoted ? value : value.trim();
    if (quoted && !closedQuote) fail('Unterminated quote in compact list', 'SCHEMA_PARSE');
    values.push(item);
    value = '';
    quoted = false;
    closedQuote = false;
  };

  for (let index = 0; index < inner.length; index += 1) {
    const character = inner[index];
    if (quote) {
      if (quote === "'" && character === "'" && inner[index + 1] === "'") {
        value += "'";
        index += 1;
      } else if (quote === '"' && character === '\\') {
        const escaped = inner[index + 1];
        if (escaped !== '"' && escaped !== '\\') fail('Unsupported escape in compact list', 'SCHEMA_PARSE');
        value += escaped;
        index += 1;
      } else if (character === quote) {
        quote = undefined;
        closedQuote = true;
      } else {
        value += character;
      }
      continue;
    }
    if (character === ',') {
      finish();
    } else if (character === "'" || character === '"') {
      if (value.trim() || quoted || closedQuote) fail('Unexpected quote in compact list', 'SCHEMA_PARSE');
      value = '';
      quote = character;
      quoted = true;
    } else if (closedQuote) {
      if (!/\s/.test(character)) fail('Unexpected content after quoted compact-list item', 'SCHEMA_PARSE');
    } else {
      value += character;
    }
  }
  finish();
  return values;
}

function stripTrailingComment(line: string): string {
  let quote: "'" | '"' | undefined;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote) {
      if (character === quote) {
        if (quote === "'" && line[index + 1] === "'") index += 1;
        else if (quote === '"' && line[index - 1] === '\\') continue;
        else quote = undefined;
      }
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === '#' && /\s/.test(line[index - 1] ?? '')) return line.slice(0, index).trimEnd();
  }
  return line;
}

export function parseTinyYaml(text: string): TestSeedSchema {
  const schema: TestSeedSchema = { name: '', count: 0, fields: {}, outputs: [] };
  let section: 'root' | 'fields' | 'outputs' | 'field' | 'output' = 'root';
  let currentField: FieldSchema | undefined;
  let currentOutput: OutputSchema | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const withoutComment = stripTrailingComment(rawLine);
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

    if ((section === 'fields' || section === 'field') && indent === 2 && line.endsWith(':')) {
      const name = line.slice(0, -1);
      currentField = { type: '' as FieldType };
      schema.fields[name] = currentField;
      section = 'field';
      continue;
    }

    if ((section === 'outputs' || section === 'output') && indent === 2 && line.startsWith('- ')) {
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
  if (key === 'type') field.type = String(value) as FieldType;
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
    if (!fieldTypes.has(field.type)) fail(`Unsupported field type for ${name}: ${field.type}`, 'SCHEMA_INVALID');
    validateFieldOptions(name, field);
    for (const reference of templateReferences(field)) {
      if (!(reference in schema.fields)) fail(`Unknown template reference in field ${name}: ${reference}`, 'SCHEMA_INVALID');
    }
  }
  validateTemplateCycles(schema);
  if (schema.outputs.length === 0) fail('Schema requires at least one output', 'SCHEMA_INVALID');
  const outputPaths = new Set<string>();
  for (const output of schema.outputs) {
    if (!output.path) fail('Each output requires path', 'SCHEMA_INVALID');
    const normalizedPath = assertSafeRelativePath(output.path);
    if (outputPaths.has(normalizedPath)) fail(`Duplicate output path: ${output.path}`, 'SCHEMA_INVALID');
    outputPaths.add(normalizedPath);
    if (!outputFormats.has(output.format)) fail(`Unsupported output format: ${output.format}`, 'SCHEMA_INVALID');
    for (const field of output.fields ?? []) {
      if (!(field in schema.fields)) fail(`Unknown output field: ${field}`, 'SCHEMA_INVALID');
    }
  }
  return schema;
}

function templateReferences(field: FieldSchema): string[] {
  if (field.type !== 'template' || field.template === undefined) return [];
  return [...field.template.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)]
    .map((match) => match[1])
    .filter((reference) => reference !== 'index');
}

function validateTemplateCycles(schema: TestSeedSchema): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (name: string): void => {
    if (visiting.has(name)) fail(`Circular template reference involving field ${name}`, 'SCHEMA_INVALID');
    if (visited.has(name)) return;
    visiting.add(name);
    for (const reference of templateReferences(schema.fields[name])) {
      if (schema.fields[reference].type === 'template') visit(reference);
    }
    visiting.delete(name);
    visited.add(name);
  };
  for (const name of Object.keys(schema.fields)) visit(name);
}

function validateFieldOptions(name: string, field: FieldSchema): void {
  if (field.type === 'date') {
    if (field.start !== undefined && !isIsoDate(field.start)) fail(`Field ${name} start must be an ISO date (YYYY-MM-DD)`, 'SCHEMA_INVALID');
    if (field.stepDays !== undefined && !Number.isInteger(field.stepDays)) fail(`Field ${name} stepDays must be an integer`, 'SCHEMA_INVALID');
  }
  if (field.type === 'sha' && field.length !== undefined && (!Number.isInteger(field.length) || field.length < 1 || field.length > 64)) {
    fail(`Field ${name} length must be an integer from 1 to 64`, 'SCHEMA_INVALID');
  }
  if (field.type === 'enum') {
    if (!field.values?.length) fail(`Field ${name} requires at least one enum value`, 'SCHEMA_INVALID');
    if (field.weights !== undefined) {
      if (field.weights.length !== field.values.length) fail(`Field ${name} weights must match values`, 'SCHEMA_INVALID');
      if (field.weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) fail(`Field ${name} weights must be positive numbers`, 'SCHEMA_INVALID');
    }
  }
  if (field.type === 'int') {
    const min = field.min ?? 0;
    const max = field.max ?? 100;
    if (!Number.isInteger(min) || !Number.isInteger(max)) fail(`Field ${name} min and max must be integers`, 'SCHEMA_INVALID');
    if (min > max) fail(`Field ${name} min must not exceed max`, 'SCHEMA_INVALID');
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

export async function readSchema(filePath: string): Promise<TestSeedSchema> {
  return parseTinyYaml(await fs.readFile(filePath, 'utf8'));
}
