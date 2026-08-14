# Private coding-tooling integration

`coding-tooling-validation.yml` is the private-consumer adapter between this public Workflow
Contract repository and the private `moritzbrantner/coding-tooling` Action.

It is intentionally available only to private repositories owned by the same GitHub account.
Public Consumer Repositories must continue to use the public, command-driven Lifecycle Workflows and
public third-party Actions.

## One-time access configuration

In `moritzbrantner/coding-tooling`, open **Settings → Actions → General → Access** and select
**Accessible from repositories owned by the user**. GitHub permits that private sharing only to
private repositories owned by the same account.

## Consumer configuration

Add `.coding-tooling.json`:

```json
{
  "schemaVersion": 1,
  "profile": "typescript-react",
  "tiers": {
    "fast": ["format:check", "lint", "typecheck", "test:unit", "build"],
    "integration": ["test:integration"],
    "e2e": ["test:e2e"]
  },
  "requiredCapabilities": ["lint", "typecheck", "test:unit"],
  "conventionRefs": ["AGENT-001", "AGENT-007", "TEST-002"]
}
```

Then add a Caller Workflow:

```yaml
name: Private deterministic validation

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  fast:
    uses: moritzbrantner/reusable-workflows/.github/workflows/coding-tooling-validation.yml@workflow-standard-v1.4
    with:
      tier: fast
```

The Reusable Workflow pins the private Action to an exact commit, executes the same tier that local
agents and the local orchestrator use, writes a job summary, and uploads the JSON report even when
validation fails.

Do not pass repository-specific shell commands through this interface. Those commands remain
declared in the Consumer Repository and are discovered mechanically by `coding-tooling`.
