import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readme = readFileSync('README.md', 'utf8');
const githubInstall = 'npm install -D github:rogerchappel/testseed';

assert.match(readme, /## Install\n[\s\S]*?Install the CLI directly from its GitHub source:/);
assert.ok(readme.includes('```bash\n' + githubInstall + '\n```'), 'README must advertise the supported GitHub-source install command');
assert.match(readme, /The npm registry name is not published yet\./);
assert.match(readme, /## Status\n[\s\S]*?The `testseed` npm registry name is not published yet\./);
assert.doesNotMatch(readme, /published (?:CLI )?from npm|published on npm/i);

console.log(`Documentation status verified: ${githubInstall}`);
