# Examples

`people.yaml` demonstrates the full MVP surface:

- deterministic IDs, names, slugs, dates, enum choices, semver values, SHAs, and paths
- JSON, JSONL, CSV, Markdown, `.env.example`, and tree output formats
- field subsets per output

Run it with:

```bash
npm run build
node dist/cli.js generate examples/people.yaml --seed demo --out .tmp/examples --clean
node dist/cli.js inspect .tmp/examples/manifest.json
```
