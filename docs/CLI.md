# CLI Reference

```bash
testseed --help
```

## `init`

Write a starter schema.

```bash
testseed init fixtures/schema.yaml
```

Pass `--force` once to overwrite an existing schema. Unknown options, duplicate
flags, and unexpected positional arguments fail before any directory or schema
is created or overwritten.

## `generate`

Generate fixtures and `manifest.json`.

```bash
testseed generate fixtures/schema.yaml --seed 42 --out fixtures/generated
```

The command validates field types and generator-specific options before
writing output. Unsupported types and invalid options fail with a nonzero exit;
the underlying library error code is `SCHEMA_INVALID`.

Options:

- `--seed <seed>`: deterministic seed. Defaults to `1`.
- `--out <dir>`: required output directory.
- `--clean`: recreate the output directory first.
- `--dry-run`: print the prospective manifest without creating, removing, or
  changing the output directory. This remains side-effect free with `--clean`.

Value-taking options use a separate argument, such as `--out fixtures/generated`.
Each option may be passed at most once. Missing values, `--option=value` syntax,
unknown options, and unexpected positional arguments produce a nonzero exit with
a specific diagnostic.

## `inspect`

Print a concise manifest summary.

```bash
testseed inspect fixtures/generated/manifest.json
```

This command accepts exactly one manifest path and no options or trailing
arguments.

## `validate`

Check manifest shape, then read every recorded file relative to the manifest's
directory and verify its byte count and SHA-256 hash. Missing or changed files
produce a nonzero exit with a file-specific diagnostic.

```bash
testseed validate fixtures/generated/manifest.json
```

This command accepts exactly one manifest path and no options or trailing
arguments.
