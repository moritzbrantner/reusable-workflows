# Reusable GitHub Workflow Capabilities

This repository provides small, optional GitHub Actions adapters for repositories that want hosted validation, deployment, publication, or release automation.

It is **not** the source of truth for how a repository develops, validates, or orchestrates work.

The intended ownership boundary is:

1. `coding-agent-conventions` describes preferred repository behavior.
2. Repository-owned commands and `coding-tooling` implement deterministic checks locally.
3. Source workspaces may compose sibling repositories directly and remain usable without GitHub.
4. This repository optionally reproduces selected checks or release operations on GitHub-hosted runners.
5. Agent contracts, profilers, and orchestrators may consume results, but are not prerequisites for these workflows.

A repository can use one workflow, several workflows, or none of them. Adoption is progressive rather than profile- or standard-driven.

## Compatibility release

`workflow-standard-v1.3` is frozen as the compatibility release for existing consumers. Its tag remains immutable and its historical contract snapshot remains in `contracts/workflows.json`.

Do not publish `workflow-standard-v1.4` or build a monolithic `workflow-standard-v2`. New work on `main` evolves individual capabilities independently. Consumers of the new capability line should pin an immutable commit SHA until a capability-specific release tag is intentionally published.

The existing reference/adoption UI is also a v1.3 compatibility aid. It is not the architectural source of truth for the capability line.

## Source-first boundary

Hosted CI is not responsible for recreating every local source workspace.

A local development workspace may use exact sibling sources, including repositories that are private or intentionally unpublished. Those source relationships are owned by the repository and local tooling. GitHub workflows should validate what can legitimately be validated from their checkout; they must not force publication or credential-dependent remote checkouts back into the normal development loop.

Publication is a later, explicit concern:

```text
source development -> local validation -> done
                                      \
                                       -> optional release qualification -> publish
```

## Current capabilities

### Core validation

- `fast-validation.yml` — thin fail-fast adapter. The repository owns one validation command; the workflow owns checkout, runtime setup, installation, timeout, permissions, and execution.
- `integration-validation.yml` — optional service, migration, package, and integration validation.
- `e2e-validation.yml` — optional browser, desktop, mobile, or application-level validation.
- `storybook-validation.yml` — optional component documentation and browser-backed component checks.
- `link-validation.yml` — optional site/link validation.
- `performance-validation.yml` — optional remote execution and evidence transport for performance checks. Performance semantics should live in repository tooling or `runtime-profiler`, not in GitHub-specific policy.

### Delivery

- `deploy-pages.yml` — GitHub Pages deployment.
- `package-publish.yml` — explicit npm/Cargo publication. Publication is never a prerequisite for source development.

### Advanced / optional

- `external-pull.yml` — notify an external deployment host.
- `release-template.yml` — repository-specific release skeleton.
- `stage-validation.yml` — stage/branch-specific validation.
- `promote-branches.yml` — exact tested-SHA branch promotion.

### Compatibility only

- `validate-repo.yml` — combined scaffold-v2 compatibility workflow. Do not adopt it in new repositories.

The local caller workflows `validate.yml`, `deploy-docs-pages.yml`, and `smoke-reusable-workflows.yml` exercise this repository itself; they are not part of the reusable capability API.

## Fast validation: next-generation shape

`fast-validation.yml` is the first capability moved to the thinner model on `main`.

The repository decides what "fast validation" means and exposes that as one command. For example:

```yaml
jobs:
  fast:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/fast-validation.yml@<immutable-sha>
    with:
      command: bun run validate:fast
```

The workflow deliberately does not have separate `format_command`, `lint_command`, `typecheck_command`, `build_command`, or `unit_test_command` inputs on the new capability line. Those distinctions belong to repository tooling. Existing v1.3 callers keep the old interface by remaining pinned to `workflow-standard-v1.3`.

## Contracts and generated metadata

GitHub workflow YAML is the source of truth for the current capability interfaces.

`contracts/workflows.json` is retained only as the frozen `workflow-standard-v1.3` compatibility snapshot. It is no longer manually synchronized with `main`.

Current capability metadata is generated from `.github/workflows/*.yml`:

```bash
bun run contracts:generate
```

Validation parses the current workflow files directly:

```bash
bun run validate:contracts
```

This avoids maintaining inputs, defaults, secrets, outputs, and permissions twice.

## Caller-owned concerns

Keep these in the caller or repository rather than growing reusable workflow inputs:

- concurrency policy;
- the exact validation command and semantic test tiers;
- source-workspace layout;
- local-only dependency resolution;
- profiler thresholds and benchmark interpretation;
- agent/orchestrator behavior;
- release decision policy.

Reusable workflows should mainly own GitHub-specific mechanics such as checkout, runtime setup, permissions, timeouts, artifact transport, and deployment APIs.

## Dependency updates

Dependency automation is a separate concern from workflow architecture. Dependabot or Renovate may propose updates, while repository-owned validation determines whether those updates are acceptable. See `DEPENDENCY_UPDATES.md`.

## Repository validation

For this repository:

```bash
bun install --frozen-lockfile
bun run validate:fast
```

`Smoke Reusable Workflows` exercises the callable workflows with minimal commands. Expensive app-level validation remains optional and should not be used to define the workflow contract itself.
