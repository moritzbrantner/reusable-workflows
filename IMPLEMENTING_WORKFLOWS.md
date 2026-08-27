# Adopting Workflow Capabilities

Adopt only the GitHub-hosted capabilities a repository currently needs. Local development and repository-owned validation come first.

## 1. Establish local validation

Before adding a reusable workflow, make the desired check runnable from the repository itself.

For a generic repository this may be `bun run validate:fast`, `cargo test`, or `dotnet test`. For repositories using `coding-tooling`, prefer a semantic tier that is usable directly by humans and agents:

```bash
coding-tooling run --tier fast --strict --report .artifacts/coding-tooling/report.json --json
```

The hosted workflow should never become the only place where validation semantics exist.

## 2. Choose the smallest hosted adapter

### Generic or public repository

Use `fast-validation.yml` around one repository-owned command:

```yaml
name: Validate

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  fast:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/fast-validation.yml@<immutable-sha>
    with:
      command: bun run validate:fast
```

### Private repository using coding-tooling

If the private consumer has GitHub Actions access to `moritzbrantner/coding-tooling`, prefer `coding-tooling-validation.yml`:

```yaml
name: Validate

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  fast:
    permissions:
      contents: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/coding-tooling-validation.yml@<immutable-sha>
    with:
      tier: fast
      strict: true
```

The adapter checks out the consumer, invokes an exact-pinned `coding-tooling` Action, uploads `.artifacts/coding-tooling/report.json` by default, writes a job summary, and propagates the tooling result. Tier contents remain in `coding-tooling` defaults or the consumer's `.coding-tooling.json`.

The `coding-tooling` Action is private. Public consumers should use `fast-validation.yml` or other public command-driven capabilities instead.

Caller-owned concurrency is intentional. Reusable capabilities should not invent a repository-wide concurrency policy.

## 3. Add capabilities only when evidence requires them

Possible additions are independent:

- `integration-validation.yml` for services, migrations, package checks, or integration suites;
- `e2e-validation.yml` for browser, desktop, mobile, or application-level tests;
- `storybook-validation.yml` for component-library checks;
- `link-validation.yml` for built-site crawling;
- `performance-validation.yml` for remote performance execution and evidence transport;
- `deploy-pages.yml` for GitHub Pages;
- `package-publish.yml` for explicit package publication.

There is no required adoption profile and no requirement to assemble these into a single standard pipeline.

## 4. Keep source-first work local when appropriate

Hosted CI does not need to reconstruct every sibling-source workspace.

If a repository uses exact sibling sources during development, validate those relationships locally with repository tooling. The presence of `coding-tooling-validation.yml` does not change that boundary: do not introduce package publication or credential-dependent remote source checkout merely so a GitHub runner can imitate the local workspace.

CI can still run a tier that is valid for its isolated checkout. Release qualification may separately verify published dependency paths when publication becomes relevant.

## 5. Publication is opt-in

`package-publish.yml` and `release-template.yml` are terminal capabilities. A repository must be able to continue normal source development when publication is unavailable.

Recommended shape:

```text
local/source development
        |
        +-> coding-tooling / repository validation
        |
        +-> optional GitHub reproduction
        |
        `-> optional release qualification -> publication
```

## Compatibility callers

Existing repositories pinned to `workflow-standard-v1.3` keep the released v1.3 interfaces, including the older multi-input `fast-validation.yml` and `validate-repo.yml` compatibility surface.

Do not migrate those callers just to keep up with `main`. Migrate when the thinner capability model provides a concrete benefit, and pin the selected `main` revision to an immutable SHA.

## Advanced capabilities

Use `stage-validation.yml`, `promote-branches.yml`, `external-pull.yml`, and `release-template.yml` only when the repository actually has those operational requirements. They are not part of a default repository setup.

## Contract metadata

The current YAML files are the source of truth. Generate current machine-readable metadata when needed:

```bash
bun run contracts:generate
```

`contracts/workflows.json` remains the frozen v1.3 compatibility snapshot for the existing reference/adoption UI. It is intentionally not synchronized with the capability line on `main`.

## Dependency automation

Renovate or Dependabot proposes dependency changes; repository-owned validation qualifies them. Keep one updater responsible for a given ecosystem. Private consumers may use `coding-tooling-validation.yml` with a `dependency-update` tier; this is a validation choice, not a dependency on the updater itself. See `DEPENDENCY_UPDATES.md`.
