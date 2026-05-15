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

`generatedAt` is intentionally stable in the MVP so fixture diffs remain quiet. File entries contain relative paths, output formats, byte counts, SHA-256 hashes, and record counts where applicable.
