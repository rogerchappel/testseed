# TestSeed PRD

Status: in-progress

## One-liner

Deterministic fixture data from tiny schemas 🌱

## Problem

Small OSS tools need realistic fixture files fast, but random mock data makes tests flaky and hand-written fixtures get stale.

## Proposed solution

A local-first generator that turns compact schemas into deterministic JSON, CSV, Markdown, env files, and directory trees from a seed.

## Primary users

CLI authors, agents creating test fixtures, maintainers building repro cases.

## V1 scope

- Generate deterministic fixture records from concise YAML schemas
- Support JSON, JSONL, CSV, Markdown tables, .env files, and directory tree outputs
- Provide built-in generators for names, slugs, dates, paths, semver, git-ish SHAs, and weighted enums
- Validate generated fixtures against simple expectations
- Explain seed and schema decisions in a human-readable manifest

## CLI shape

```bash
testseed init fixtures/schema.yaml
testseed generate fixtures/schema.yaml --seed 42 --out fixtures/generated
testseed inspect fixtures/generated/manifest.json
```

## Non-goals

- No hosted service, hidden telemetry, or required account.
- No secret collection; fixture and metadata redaction should be conservative.
- No broad framework lock-in beyond a practical Node/TypeScript CLI MVP.

## Local-first safety

- Default to dry-run or read-only behavior for write/apply style commands.
- Keep generated artifacts deterministic and reviewable.
- Fail closed on suspicious paths, binary blobs, or likely secrets.

## Acceptance criteria

- Functional CLI with help text and at least three useful commands.
- Fixture-backed tests covering happy path, validation failure, and deterministic output.
- README with concise examples, safety notes, and practical developer workflow.
- `npm test`, `npm run check`, `npm run build`, `npm run smoke`, and `bash scripts/validate.sh` pass where present.
- Public GitHub repo under `rogerchappel/testseed` with description and topics.

## Attribution / inspiration

Inspired by faker-style data generation and property-test seeds, but intentionally deterministic, tiny, and fixture-file oriented.
