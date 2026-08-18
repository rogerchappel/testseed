# Schema Reference

TestSeed schemas are intentionally tiny YAML files. The MVP parser supports the compact style used in `examples/people.yaml`: root scalars, nested `fields`, and list-style `outputs`.

Scalar strings may be wrapped in single or double quotes. A `#` inside a quoted
scalar is literal, so `template: "release #1"` preserves the complete value.
Outside quotes, whitespace followed by `#` starts a trailing comment.

Compact bracket lists use commas between elements. Quote an element with
single or double quotes when it contains a comma or `#`; those characters are
then preserved literally, for example `values: ["Doe, Jane", 'release #1']`.
Inside single quotes, write `''` for a literal apostrophe. Inside double quotes,
use `\"` for a literal double quote and `\\` for a literal backslash. Other
backslash escapes, unclosed quotes, quotes inside unquoted elements, and
non-whitespace text after a closing quote are rejected with `SCHEMA_PARSE`.

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

Template placeholders may use `{index}` or reference any declared field by
name, including a field declared later in the schema. References are resolved
independently of declaration order. Unknown field names and circular template
references are rejected with `SCHEMA_INVALID` before generation writes output.

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
  Paths must be unique after normalizing separators and `.` segments; equivalent
  spellings such as `data/out.json` and `data/./out.json` are rejected with
  `SCHEMA_INVALID` before the output directory is created or cleaned.
- `format`: `json`, `jsonl`, `csv`, `md`, `env`, or `tree`.
- `fields`: optional ordered field subset. Every entry must name a declared
  field; unknown names are rejected with `SCHEMA_INVALID` before output is
  created.
- `items`: optional explicit item list for `tree` outputs.

Markdown output is a pipe-delimited table. Literal pipes in generated cells are
escaped, backslashes are preserved, and line breaks are rendered as `<br>` so
each record retains the configured number of columns.

## Determinism model

The seed, field name, and row index are hashed together. This keeps values stable across machines without storing hidden state.
