import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const release = readFileSync('.github/workflows/release.yml', 'utf8');
const dryRun = readFileSync('.github/workflows/release-dry-run.yml', 'utf8');

const checks = [
  ['release checks', 'run: npm run release:check'],
  ['package build', 'run: npm pack'],
  ['npm publication', 'run: npm publish --provenance --access public'],
  ['GitHub release', 'run: gh release create'],
];

for (const [label, command] of checks) {
  assert.notEqual(release.indexOf(command), -1, `release workflow must contain ${label}`);
}

for (let index = 1; index < checks.length; index += 1) {
  assert.ok(
    release.indexOf(checks[index - 1][1]) < release.indexOf(checks[index][1]),
    `${checks[index - 1][0]} must run before ${checks[index][0]}`,
  );
}

assert.match(dryRun, /run: npm publish --dry-run --provenance --access public/);
assert.match(dryRun, /- scripts\/check-release-workflows\.mjs/);

console.log('Release workflow contract verified.');
