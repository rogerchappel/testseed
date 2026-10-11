import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readme = readFileSync('README.md', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const packageRoot = packageLock.packages?.[''];

assert.equal(packageJson.name, 'testseed', 'package name must match the documented registry name');
assert.equal(packageRoot?.name, packageJson.name, 'lockfile package name must match package.json');
assert.equal(packageRoot?.version, packageJson.version, 'lockfile version must match package.json');
assert.equal(packageJson.private, undefined, 'public npm package must not be marked private');
assert.equal(packageRoot?.private, undefined, 'lockfile metadata must not mark the public package private');
assert.equal(packageJson.bin?.testseed, 'dist/cli.js', 'package CLI entry must match the documented executable');
assert.equal(packageJson.exports?.['.']?.import, './dist/index.js', 'package import entry must be present');
assert.ok(packageJson.files?.includes('dist'), 'published files must include built output');
assert.equal(packageJson.publishConfig, undefined, 'unpublished package must not define publish configuration');
const githubInstall = 'npm install -D github:rogerchappel/testseed';

assert.match(readme, /## Install\n[\s\S]*?Install the CLI directly from its GitHub source:/);
assert.ok(readme.includes('```bash\n' + githubInstall + '\n```'), 'README must advertise the supported GitHub-source install command');
assert.match(readme, /The npm registry name is not published yet\./);
assert.match(readme, /## Status\n[\s\S]*?The `testseed` npm registry name is not published yet\./);
assert.doesNotMatch(readme, /published (?:CLI )?from npm|published on npm/i);

console.log(`Documentation status verified: ${githubInstall}`);
