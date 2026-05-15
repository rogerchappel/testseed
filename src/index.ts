import { buildRecords } from './generators.js';
import { prepareOutDir, writeGeneratedFile } from './io.js';
import { createManifest, manifestFile, readManifest } from './manifest.js';
import { renderOutput } from './renderers.js';
import { readSchema } from './schema.js';
import { seedToString } from './random.js';
import type { GenerateOptions, Manifest, TestSeedSchema } from './types.js';

export * from './types.js';
export { parseTinyYaml, readSchema, validateSchema } from './schema.js';
export { buildRecords } from './generators.js';
export { readManifest } from './manifest.js';

export async function generate(schemaPath: string, options: GenerateOptions): Promise<Manifest> {
  const schema = await readSchema(schemaPath);
  return generateFromSchema(schema, schemaPath, options);
}

export async function generateFromSchema(schema: TestSeedSchema, schemaPath: string, options: GenerateOptions): Promise<Manifest> {
  const seed = seedToString(options.seed);
  const records = buildRecords(schema, seed);
  const files = [];
  await prepareOutDir(options.outDir, options.clean ?? false);
  for (const output of schema.outputs) {
    const content = renderOutput(output, records);
    files.push(manifestFile(output.path, output.format, content, output.format === 'tree' ? undefined : records.length));
    if (!options.dryRun) await writeGeneratedFile(options.outDir, output.path, content);
  }
  const manifest = createManifest(schemaPath, seed, files);
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  if (!options.dryRun) await writeGeneratedFile(options.outDir, 'manifest.json', manifestContent);
  return manifest;
}

export async function inspectManifest(path: string): Promise<string> {
  const manifest = await readManifest(path);
  const lines = [`testseed manifest`, `schema: ${manifest.schema}`, `seed: ${manifest.seed}`, `files: ${manifest.files.length}`];
  for (const file of manifest.files) lines.push(`- ${file.path} (${file.format}, ${file.bytes} bytes, ${file.sha256.slice(0, 12)})`);
  return lines.join('\n');
}
