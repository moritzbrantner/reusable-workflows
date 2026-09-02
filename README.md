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

## Validation architecture

Keep three separate decisions separate:

1. A **validation capability** describes what is checked: linting, unit tests, integration checks, browser E2E, accessibility, benchmarks, and so on.
2. A **validation tier** (or depth) composes deterministic capabilities into the confidence a repository wants, such as `fast`, `standard`, `deep`, or `release`. Tier names and composition belong to `coding-tooling` defaults or the consumer's repository configuration.
3. A **repository lifecycle** decides when a tier runs: local agent handoff, pull request, `main`, nightly, release candidate, or stable release. The caller owns this policy.

```text
coding-agent-conventions
        |
        | engineering policy
        v
consumer repository
  conventions.json / .conventions/
  .coding-tooling.json
        |
        v
coding-tooling
  capabilities + repository tiers
        |
        +--> humans / coding agents locally
        |
        `--> reusable-workflows GitHub adapter
                 |
                 `--> caller-owned lifecycle triggers
```

The preferred shape lets an agent and hosted CI run the same deterministic tier. A generic consumer can make the same choice with one repository-owned command through `fast-validation.yml`; no GitHub workflow defines the repository's validation semantics.

### Lifecycle and release guidance

The following is recommended guidance, not a required branch strategy or workflow profile:

```text
local agent handoff -> fast
pull request        -> fast, optionally affected or deeper checks
main                -> normal confidence suite
nightly             -> expensive or deep checks
release candidate   -> qualify an exact commit or artifact
stable release      -> publish or promote the qualified immutable candidate
```

`nightly`, `beta`, release candidate, and stable are normally lifecycle or release concepts, not deterministic test capabilities. Prefer qualifying and promoting an exact commit or artifact instead of requiring a long-lived `develop -> nightly -> beta -> staging -> production` branch chain.

### Progressive adoption

- Tiny or experimental repositories may validate locally and use no hosted CI.
- Small repositories can run a `fast` tier on pull requests.
- Normal repositories can add deeper checks on `main`.
- Important applications can add E2E/accessibility checks and nightly deep validation.
- Performance-sensitive repositories can add benchmark or profiling evidence.
- Released packages and products can add release qualification and publication.
- Advanced production systems can add matrices or environments only where evidence requires them.

Each maturity step composes capabilities and tiers; it never requires a different workflow standard or profile family.

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

Using `coding-tooling-validation.yml` in hosted CI does not change this rule. The same `coding-tooling run --tier ...` semantics remain directly usable locally; GitHub is only another execution environment.

## Current capabilities

### Preferred core validation

- `fast-validation.yml` — universal thin adapter around one repository-owned validation command. This is the public/generic fallback.
- `coding-tooling-validation.yml` — preferred semantic validation adapter for private consumer repositories that can access `moritzbrantner/coding-tooling`. It runs a declared tier and uploads the machine-readable report.
- `environment-v1-canary.yml` — environment integrity canary for environment-v1 consumers. It captures semantic identity before setup, runs the standard setup entrypoint, requires setup to leave tracked repository state unchanged, verifies the prepared environment earns the exact pre-setup fingerprint, and uploads both receipts.

### Specialized / transitional validation

- `integration-validation.yml` — optional service, migration, package, and integration validation.
- `e2e-validation.yml` — optional browser, desktop, mobile, or application-level validation.
- `storybook-validation.yml` — optional component documentation and browser-backed component checks.
- `link-validation.yml` — optional site/link validation.
- `performance-validation.yml` — optional remote execution and evidence transport for performance checks. Performance semantics should live in repository tooling or `runtime-profiler`, not in GitHub-specific policy.

These semantic workflows remain callable for existing consumers. New architecture should prefer repository or `coding-tooling` capability semantics expressed through the preferred core adapters instead of expanding these YAML interfaces.

### Delivery

- `deploy-pages.yml` — GitHub Pages deployment.
- `package-publish.yml` — explicit npm/Cargo publication. Publication is never a prerequisite for source development.

### Specialized / legacy lifecycle and release support

- `external-pull.yml` — notify an external deployment host.
- `release-template.yml` — repository-specific release skeleton.
- `stage-validation.yml` — specialized legacy support for consumers that already select commands from a stage/branch model. It is not the preferred lifecycle abstraction.
- `promote-branches.yml` — advanced exact-tested-SHA branch promotion for consumers that genuinely use promotion branches. It is not a default release architecture.
- `toolchain-refresh.yml` — scheduled environment-v1 maintenance adapter that proposes exact current-stable toolchain pins and delegates acceptance to the consumer repository's full gate.

### Compatibility only

- `validate-repo.yml` — combined scaffold-v2 compatibility workflow. Do not adopt it in new repositories.

The local caller workflows `validate.yml`, `deploy-docs-pages.yml`, and `smoke-reusable-workflows.yml` exercise this repository itself; they are not part of the reusable capability API.

## Validation choices

### Generic / public consumers

`fast-validation.yml` accepts one repository-owned command:

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

The workflow deliberately does not have separate format, lint, typecheck, build, and unit-test inputs on the new capability line. Those distinctions belong to repository tooling.

### Private consumers using coding-tooling

For repositories that have GitHub Actions access to the private `moritzbrantner/coding-tooling` repository, prefer the semantic adapter:

```yaml
jobs:
  fast:
    permissions:
      contents: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/coding-tooling-validation.yml@<immutable-sha>
    with:
      tier: fast
      strict: true
```

The hosted run delegates to the same deterministic interface used locally:

```bash
coding-tooling run --tier fast --strict --report .artifacts/coding-tooling/report.json --json
```

`coding-tooling-validation.yml` pins the private Action to an exact commit, uploads its JSON report even when validation fails where possible, writes a GitHub job summary, and then propagates the tooling result. It does not own tier definitions or source-dependency policy.

This repository is public, so its own smoke workflow cannot execute the private Action. The adapter is syntax/contract validated here and should be exercised by private consumers that have access to `coding-tooling`.

### Environment-v1 integrity canary

Environment-v1 consumers can add the canary independently of their normal validation tier:

```yaml
jobs:
  environment:
    permissions:
      contents: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/environment-v1-canary.yml@<immutable-sha>
```

The canary deliberately uses the repository-standard `bash scripts/codex-environment.sh setup` entrypoint rather than accepting an arbitrary setup command. It treats setup as an idempotent reconstruction operation: tracked repository state must remain unchanged, and the prepared machine must verify against the semantic fingerprint captured before setup. The expected fingerprint and verification receipt are retained as short-lived evidence.

Existing v1.3 callers keep the old interfaces by remaining pinned to `workflow-standard-v1.3`.

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
- semantic tier definitions and repository capability commands;
- source-workspace layout;
- local-only dependency resolution;
- profiler thresholds and benchmark interpretation;
- agent/orchestrator behavior;
- release decision policy.

Reusable workflows should mainly own GitHub-specific mechanics such as checkout, runtime setup, permissions, timeouts, artifact transport, and deployment APIs.

## Dependency updates

Dependency automation is a separate concern from workflow architecture. Dependabot or Renovate may propose updates, while repository-owned validation determines whether those updates are acceptable. Private consumers may use `coding-tooling-validation.yml` with a `dependency-update` tier; public consumers can run equivalent repository-owned commands through the generic workflows. See `DEPENDENCY_UPDATES.md`.

## Toolchain freshness

`toolchain-refresh.yml` is deliberately separate from normal package dependency automation. It operates only on exact repository-native environment toolchain pins supported by `platform-upgrader`.

The reusable workflow requires:

- `contents: write` and `pull-requests: write` so it can maintain one bot-owned upgrade branch/PR or compatibility-hold branch/PR;
- `packages: read` for consumer environments that restore GitHub Packages;
- an exact 40-character `platform_upgrader_ref` rather than a moving branch/tag;
- `platform_upgrader_token`, a secret with read access to the private `moritzbrantner/platform-upgrader` repository;
- a consumer-owned `full_gate_command` that defines acceptance;
- environment-v1 adoption (`.repository-environment.toml` plus `scripts/codex-environment.sh`).

The caller owns schedule and concurrency. A typical caller runs daily and may also expose `workflow_dispatch`; see `examples/toolchain-refresh-caller.yml`.

The flow is:

1. resolve current stable toolchains through the pinned upgrader;
2. no-op when all supported pins are current or covered by a merged compatibility hold;
3. install the candidate environment and run any repository-owned metadata update hook;
4. run the repository-owned full deterministic gate;
5. on success, clear superseded holds and create/update `automation/toolchain-refresh` as one explicit exact-pin PR;
6. on failure, restore the accepted revision, close any stale upgrade PR, record only the candidate compatibility hold, and create/update `automation/toolchain-compatibility-hold`;
7. if a compatibility-hold PR is already open, defer additional scheduled evaluation until that PR is resolved.

The workflow never writes `latest`, `stable`, `*`, or another floating build input. An exact candidate is accepted only through the consumer's gate.

Because `GITHUB_TOKEN`-authored pushes/PRs do not recursively trigger normal workflow events, consumers whose branch protection requires a fresh PR check suite may later choose a dedicated automation token/GitHub App for publication. The candidate full gate still runs before the refresh PR is created.

## Repository validation

For this repository:

```bash
bun install --frozen-lockfile
bun run validate:fast
```

`Smoke Reusable Workflows` exercises the public callable workflows with minimal commands. The private `coding-tooling-validation.yml`, `environment-v1-canary.yml`, and `toolchain-refresh.yml` adapters are intentionally not called from this public repository because they require access to private sibling tooling or consumer-owned environment-v1 state.
