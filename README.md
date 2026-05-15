# TestSeed 🌱

Deterministic fixture data from tiny schemas.

TestSeed is a local-first TypeScript CLI for creating reviewable JSON, JSONL, CSV, Markdown, `.env.example`, and directory-tree fixture files. Give it a compact YAML schema and a seed; get the same fixtures every time.

## Why it exists

Random mock data is fun until a test flakes. Hand-written fixtures are reliable until they drift. TestSeed sits in the middle: small schemas, deterministic output, and manifests that explain what was generated.

## Install

```bash
npm install -D testseed
```

Or run from this repository:

```bash
npm install
npm run build
node dist/cli.js --help
```

## Quick start

```bash
testseed init fixtures/schema.yaml
testseed generate fixtures/schema.yaml --seed 42 --out fixtures/generated
testseed inspect fixtures/generated/manifest.json
testseed validate fixtures/generated/manifest.json
```

Try the bundled example locally:

```bash
npm run build
node dist/cli.js generate examples/people.yaml --seed 42 --out .tmp/readme --clean
cat .tmp/readme/people.csv
```

## Schema shape

```yaml
name: people
count: 4
fields:
  id:
    type: id
    prefix: user
  name:
    type: name
  role:
    type: enum
    values: [admin, maintainer, guest]
    weights: [1, 3, 6]
outputs:
  - path: people.json
    format: json
  - path: people.csv
    format: csv
    fields: [id, name, role]
```

## Built-in field types

- `id` — incrementing IDs with an optional prefix.
- `name` — deterministic human-ish names.
- `slug` — readable slugs with row indexes.
- `date` — stepped ISO dates from a start date.
- `path` — fixture-looking relative file paths.
- `semver` — deterministic semantic versions.
- `sha` — git-ish hex strings.
- `enum` — deterministic choices with optional weights.
- `int` — bounded deterministic integers.
- `template` — simple `{field}` and `{index}` interpolation.

## Output formats

- `json`
- `jsonl`
- `csv`
- `md`
- `env`
- `tree`

Every generation writes a `manifest.json` with stable hashes and seed decisions.

## Local-first safety

TestSeed does not phone home, require accounts, or collect secrets. It refuses absolute paths, parent-directory escapes, and likely secret-looking output names. Generation stays under the output directory you choose.

Use `--dry-run` to inspect a manifest without writing fixture files, and `--clean` only when you intentionally want to recreate the output directory.

## Developer workflow

```bash
npm test
npm run check
npm run build
npm run smoke
bash scripts/validate.sh
```

## Status

MVP. Useful for small fixtures today; intentionally boring and deterministic.
