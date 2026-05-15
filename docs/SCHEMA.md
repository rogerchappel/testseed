# Schema Reference

TestSeed schemas are intentionally tiny YAML files. The MVP parser supports the compact style used in `examples/people.yaml`: root scalars, nested `fields`, and list-style `outputs`.

## Root keys

- `name`: dataset name for humans.
- `count`: number of records to generate. Must be between 1 and 10,000.
- `fields`: named field definitions.
- `outputs`: output file definitions.

## Field keys

Common keys:

- `type`: required generator type.
- `prefix`: used by `id` and `path`.
- `values`: used by `enum`.
- `weights`: optional enum weights matching `values`.
- `start`: ISO start date for `date`.
- `stepDays`: day increment for `date`.
- `length`: hex length for `sha`.
- `min` / `max`: range for `int`.
- `template`: string for `template` fields.

## Output keys

- `path`: relative output path under `--out`.
- `format`: `json`, `jsonl`, `csv`, `md`, `env`, or `tree`.
- `fields`: optional ordered field subset.
- `items`: optional explicit item list for `tree` outputs.

## Determinism model

The seed, field name, and row index are hashed together. This keeps values stable across machines without storing hidden state.
