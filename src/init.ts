export function starterSchema(): string {
  return `name: people
count: 3
fields:
  id:
    type: id
    prefix: user
  name:
    type: name
  handle:
    type: slug
  joined:
    type: date
    start: 2024-01-01
    stepDays: 7
  role:
    type: enum
    values: [admin, maintainer, guest]
    weights: [1, 3, 6]
  version:
    type: semver
  commit:
    type: sha
    length: 10
  path:
    type: path
    prefix: cases
outputs:
  - path: people.json
    format: json
  - path: people.csv
    format: csv
    fields: [id, name, role, joined]
  - path: people.md
    format: md
    fields: [id, handle, version]
  - path: .env.example
    format: env
    fields: [id, role]
  - path: tree.txt
    format: tree
    fields: [path]
`;
}
