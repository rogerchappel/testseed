import { choose, hashInt, intBetween } from './random.js';
import type { FieldSchema, TestSeedSchema } from './types.js';

const firstNames = ['Ada', 'Linus', 'Grace', 'Katherine', 'Alan', 'Edsger', 'Margaret', 'Donald'];
const lastNames = ['Lovelace', 'Torvalds', 'Hopper', 'Johnson', 'Turing', 'Dijkstra', 'Hamilton', 'Knuth'];
const nouns = ['river', 'ember', 'atlas', 'signal', 'harbor', 'meadow', 'orbit', 'kernel'];
const adjectives = ['quiet', 'brave', 'tiny', 'bright', 'steady', 'curious', 'silver', 'rapid'];

export type RecordValue = string | number | boolean;
export type FixtureRecord = Record<string, RecordValue>;

export function buildRecords(schema: TestSeedSchema, seed: string): FixtureRecord[] {
  return Array.from({ length: schema.count }, (_, index) => {
    const record: FixtureRecord = {};
    const generate = (name: string): RecordValue => {
      if (record[name] !== undefined) return record[name];
      const field = schema.fields[name];
      record[name] = generateField(field, seed, name, index, record, generate);
      return record[name];
    };
    for (const name of Object.keys(schema.fields)) generate(name);
    return record;
  });
}

function generateField(field: FieldSchema, seed: string, name: string, index: number, record: FixtureRecord, generate: (name: string) => RecordValue): RecordValue {
  switch (field.type) {
    case 'id': return `${field.prefix ?? 'id'}_${String(index + 1).padStart(3, '0')}`;
    case 'name': return `${choose(firstNames, seed, name + ':first', index)} ${choose(lastNames, seed, name + ':last', index)}`;
    case 'slug': return `${choose(adjectives, seed, name + ':adj', index)}-${choose(nouns, seed, name + ':noun', index)}-${index + 1}`;
    case 'date': return dateValue(field.start ?? '2024-01-01', field.stepDays ?? 1, index);
    case 'path': return `${field.prefix ?? 'fixtures'}/${choose(nouns, seed, name, index)}-${index + 1}.json`;
    case 'semver': return `${1 + (hashInt([seed, name, index, 'major']) % 3)}.${hashInt([seed, name, index, 'minor']) % 20}.${hashInt([seed, name, index, 'patch']) % 50}`;
    case 'sha': return hashHex(seed, name, index, field.length ?? 12);
    case 'enum': return choose(field.values ?? ['one', 'two'], seed, name, index, field.weights);
    case 'int': return intBetween(seed, name, index, field.min ?? 0, field.max ?? 100);
    case 'template': return renderTemplate(field.template ?? `${name}-{index}`, index, record, generate);
    default: return `${field.prefix ?? name}-${index + 1}`;
  }
}

function dateValue(start: string, stepDays: number, index: number): string {
  const date = new Date(`${start}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + stepDays * index);
  return date.toISOString().slice(0, 10);
}

function hashHex(seed: string, name: string, index: number, length: number): string {
  let value = '';
  let counter = 0;
  while (value.length < length) value += hashInt([seed, name, index, counter++]).toString(16).padStart(8, '0');
  return value.slice(0, length);
}

function renderTemplate(template: string, index: number, record: FixtureRecord, generate: (name: string) => RecordValue): string {
  return template.replaceAll('{index}', String(index + 1)).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, key: string) => String(record[key] ?? generate(key)));
}
