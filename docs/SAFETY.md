# Safety Notes

TestSeed is designed for local fixture generation, not secret handling.

## Path safety

Generated outputs must stay inside the requested output directory. The CLI refuses:

- absolute output paths
- `..` parent escapes
- null bytes
- secret-looking names such as `password`, `token`, `.pem`, or `id_rsa`

## Data safety

Built-in generators produce synthetic fixture values. Do not paste production data into schemas. If you need realistic examples, encode the shape of the data rather than the data itself.

## Reviewability

Generated manifests include byte counts and SHA-256 hashes. Commit generated fixtures only when they are intended to be stable test assets.
Use `testseed validate` to detect missing or changed files; validation treats
the manifest directory as the base for every recorded relative path.

Dry runs are side-effect free. Even with `--clean`, `--dry-run` does not create,
remove, or alter the requested output directory.
