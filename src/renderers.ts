import type { FixtureRecord } from './generators.js';
import type { OutputSchema } from './types.js';

export function renderOutput(output: OutputSchema, records: FixtureRecord[]): string {
  const scoped = selectFields(output, records);
  if (output.format === 'json') return `${JSON.stringify(scoped, null, 2)}\n`;
  if (output.format === 'jsonl') return `${scoped.map((row) => JSON.stringify(row)).join('\n')}\n`;
  if (output.format === 'csv') return renderCsv(scoped);
  if (output.format === 'md') return renderMarkdown(scoped);
  if (output.format === 'env') return renderEnv(scoped[0] ?? {});
  if (output.format === 'tree') return renderTree(output.items ?? scoped.map((row) => String(row.path ?? row.id ?? 'item')));
  return '';
}

function selectFields(output: OutputSchema, records: FixtureRecord[]): FixtureRecord[] {
  if (!output.fields?.length) return records;
  return records.map((record) => Object.fromEntries(output.fields!.map((field) => [field, record[field] ?? ''])) as FixtureRecord);
}

function renderCsv(records: FixtureRecord[]): string {
  const headers = Object.keys(records[0] ?? {});
  const lines = [headers.join(',')];
  for (const record of records) lines.push(headers.map((header) => csvCell(record[header])).join(','));
  return `${lines.join('\n')}\n`;
}

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function renderMarkdown(records: FixtureRecord[]): string {
  const headers = Object.keys(records[0] ?? {});
  return [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...records.map((record) => `| ${headers.map((header) => record[header]).join(' | ')} |`)].join('\n') + '\n';
}

function renderEnv(record: FixtureRecord): string {
  return Object.entries(record).map(([key, value]) => `${key.toUpperCase()}=${String(value).replace(/\s+/g, '_')}`).join('\n') + '\n';
}

function renderTree(items: string[]): string {
  return items.map((item) => `./${String(item).replace(/^\.\//, '')}`).join('\n') + '\n';
}
