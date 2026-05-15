# CLI Reference

```bash
testseed --help
```

## `init`

Write a starter schema.

```bash
testseed init fixtures/schema.yaml
```

Pass `--force` to overwrite an existing schema.

## `generate`

Generate fixtures and `manifest.json`.

```bash
testseed generate fixtures/schema.yaml --seed 42 --out fixtures/generated
```

Options:

- `--seed <seed>`: deterministic seed. Defaults to `1`.
- `--out <dir>`: required output directory.
- `--clean`: recreate the output directory first.
- `--dry-run`: print the manifest without writing generated files.

## `inspect`

Print a concise manifest summary.

```bash
testseed inspect fixtures/generated/manifest.json
```

## `validate`

Check manifest shape and recorded file hashes.

```bash
testseed validate fixtures/generated/manifest.json
```
