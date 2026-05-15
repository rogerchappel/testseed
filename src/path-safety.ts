import path from 'node:path';
import { fail } from './errors.js';

const secretName = /(secret|token|password|passwd|private[-_]?key|\.pem$|id_rsa)/i;

export function assertSafeRelativePath(candidate: string): string {
  if (!candidate || candidate.trim() !== candidate) fail(`Unsafe blank or padded path: ${candidate}`, 'UNSAFE_PATH');
  if (candidate.includes('\0')) fail('Unsafe path contains a null byte', 'UNSAFE_PATH');
  if (path.isAbsolute(candidate)) fail(`Refusing absolute output path: ${candidate}`, 'UNSAFE_PATH');
  const normalized = path.posix.normalize(candidate.replaceAll('\\', '/'));
  if (normalized === '.' || normalized.startsWith('../') || normalized === '..') {
    fail(`Refusing path outside output directory: ${candidate}`, 'UNSAFE_PATH');
  }
  if (secretName.test(normalized)) fail(`Refusing likely secret-looking path: ${candidate}`, 'UNSAFE_PATH');
  return normalized;
}

export function resolveInside(root: string, relativePath: string): string {
  const safe = assertSafeRelativePath(relativePath);
  const resolved = path.resolve(root, safe);
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    fail(`Resolved path escaped output directory: ${relativePath}`, 'UNSAFE_PATH');
  }
  return resolved;
}
