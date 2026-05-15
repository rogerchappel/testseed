import { createHash } from 'node:crypto';

export function seedToString(seed: number | string): string {
  return String(seed);
}

export function hashInt(parts: Array<string | number>): number {
  const hex = createHash('sha256').update(parts.map(String).join(':')).digest('hex').slice(0, 8);
  return Number.parseInt(hex, 16) >>> 0;
}

export function choose<T>(items: T[], seed: string, field: string, index: number, weights?: number[]): T {
  if (items.length === 0) throw new Error(`Cannot choose from empty list for ${field}`);
  const roll = hashInt([seed, field, index]);
  if (!weights || weights.length !== items.length) return items[roll % items.length];
  const total = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return items[roll % items.length];
  let cursor = roll % total;
  for (let i = 0; i < items.length; i += 1) {
    cursor -= Math.max(0, weights[i] ?? 0);
    if (cursor < 0) return items[i]!;
  }
  return items.at(-1)!;
}

export function intBetween(seed: string, field: string, index: number, min: number, max: number): number {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return low + (hashInt([seed, field, index]) % (high - low + 1));
}
