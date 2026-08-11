# Manifest Format

Every generation writes `manifest.json` beside the generated files.

```json
{
  "tool": "testseed",
  "version": "0.1.0",
  "schema": "examples/people.yaml",
  "seed": "42",
  "generatedAt": "deterministic-local-time",
  "files": [],
  "decisions": []
}
```

`generatedAt` is intentionally stable in the MVP so fixture diffs remain quiet.
File entries contain relative paths, output formats, byte counts, SHA-256
hashes, and record counts where applicable. `testseed validate` resolves each
entry relative to the directory containing `manifest.json`, then verifies the
recorded byte count and SHA-256 against the file on disk.

## Validation

`testseed validate` first checks that the manifest is valid JSON with an object
at its root. The `tool` value must be `"testseed"`; `version`, `schema`, `seed`,
and `generatedAt` must be non-empty strings; `decisions` must be an array of
strings; and `files` must be a non-empty array.

Each file entry must be an object containing a non-empty relative `path`, a
supported `format`, a non-negative integer `bytes` value, and a lowercase
64-character SHA-256 hash. When present, `records` must also be a non-negative
integer. Shape errors identify the invalid field (for example,
`files[0].bytes`) before testseed reads or hashes any generated file.
