import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'testseed-package-'));

function run(command, args) {
  return execFileSync(command, args, { cwd: temp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

try {
  const pack = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', temp], { cwd: root, encoding: 'utf8' }));
  assert.equal(pack.length, 1);
  const tarball = path.join(temp, pack[0].filename);
  run('npm', ['init', '-y']);
  run('npm', ['install', '--ignore-scripts', tarball]);

  const metadata = JSON.parse(await fs.readFile(path.join(temp, 'node_modules/testseed/package.json'), 'utf8'));
  assert.equal(metadata.name, 'testseed');
  assert.equal(metadata.version, '0.1.0');

  assert.match(run('npx', ['--no-install', 'testseed', '--help']), /Usage:/);
  assert.equal(run('npx', ['--no-install', 'testseed', '--version']).trim(), metadata.version);
  run('npx', ['--no-install', 'testseed', 'generate', 'node_modules/testseed/examples/people.yaml', '--seed', '42', '--out', 'generated']);
  await fs.access(path.join(temp, 'generated/manifest.json'));

  assert.equal(run(process.execPath, ['--input-type=module', '--eval', "import * as api from 'testseed'; if (typeof api.generate !== 'function') process.exit(1)"]), '');
  await fs.writeFile(path.join(temp, 'types.ts'), "import { generate } from 'testseed';\nvoid generate;\n");
  execFileSync(path.join(root, 'node_modules/.bin/tsc'), ['--noEmit', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', 'types.ts'], { cwd: temp, stdio: 'inherit' });
  console.log(`Verified ${metadata.name}@${metadata.version} from ${pack[0].filename}`);
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
