# Contract Data

`workflows.json` is the frozen machine-readable snapshot for the immutable `workflow-standard-v1.3` compatibility release. The existing reference/adoption UI still reads it so that it continues to describe the released v1.3 caller surface.

It is intentionally **not** synchronized with workflow changes on `main`.

For the current capability line, `.github/workflows/*.yml` is the source of truth. Generate current metadata on demand with:

```bash
bun run contracts:generate
```

To write the generated manifest to a file instead of stdout:

```bash
bun run contracts:generate .artifacts/workflow-capabilities.json
```

This keeps current inputs, secrets, outputs, defaults, and job permissions derived from the actual workflow YAML rather than manually maintaining a second authoritative copy.

## Current contract compatibility

`bun run contracts:compat` (CI passes the pull request base) compares the generated contracts at the merge base with the working tree and fails on breaking interface changes. See `CONTEXT.md#compatibility-policy`. Breaking changes go into a new versioned workflow file; `retired-workflows.json` records a migrated-away path as `{ "<path>": { "replacement": "<new path>", "migration": "<caller changes>" } }`.
