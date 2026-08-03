# Schema Reference

TestSeed schemas are intentionally tiny YAML files. The MVP parser supports the compact style used in `examples/people.yaml`: root scalars, nested `fields`, and list-style `outputs`.

## Root keys

- `name`: dataset name for humans.
- `count`: number of records to generate. Must be between 1 and 10,000.
- `fields`: named field definitions.
- `outputs`: output file definitions.

## Field keys

Common keys:

- `type`: required generator type. It must be one of `id`, `name`, `slug`,
  `date`, `path`, `semver`, `sha`, `enum`, `int`, or `template`; unknown types
  are rejected rather than treated as strings.
- `prefix`: used by `id` and `path`.
- `values`: used by `enum`.
- `weights`: optional enum weights matching `values`.
- `start`: ISO start date for `date`.
- `stepDays`: day increment for `date`.
- `length`: hex length for `sha`.
- `min` / `max`: range for `int`.
- `template`: string for `template` fields.

Generator-specific constraints are validated before generation:

- `date.start` must be an ISO calendar date (`YYYY-MM-DD`), and `stepDays`
  must be an integer.
- `sha.length`, when supplied, must be an integer from 1 through 64.
- `enum.values` must contain at least one value. Optional `weights` must have
  one positive number per value.
- `int.min` and `int.max` must be integers, and `min` cannot exceed `max`.

An invalid schema raises `SCHEMA_INVALID` and no output directory or files are
written.

## Output keys

- `path`: relative output path under `--out`.
- `format`: `json`, `jsonl`, `csv`, `md`, `env`, or `tree`.
- `fields`: optional ordered field subset.
- `items`: optional explicit item list for `tree` outputs.

## Determinism model

The seed, field name, and row index are hashed together. This keeps values stable across machines without storing hidden state.
