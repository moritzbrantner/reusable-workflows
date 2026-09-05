# Reusable GitHub Workflow Capabilities

This repository provides small, optional GitHub Actions adapters for repositories that want hosted validation, deployment, publication, or release automation.

It is **not** the source of truth for how a repository develops, validates, or orchestrates work.

The ownership boundary is:

1. `coding-agent-conventions` describes preferred repository behavior.
2. Repository-owned commands and `coding-tooling` implement deterministic checks locally.
3. Source workspaces may compose sibling repositories directly and remain usable without GitHub.
4. This repository optionally reproduces selected checks or release operations on GitHub-hosted runners.
5. Agent contracts, profilers, and orchestrators may consume results, but are not prerequisites for these workflows.

A repository can use one workflow, several workflows, or none. Adoption is progressive rather than profile-driven.

## Validation architecture

Keep three decisions separate:

1. A **validation capability** describes what is checked: linting, tests, E2E, accessibility, benchmarks, and so on.
2. A **validation tier/depth** composes deterministic capabilities into the confidence a repository wants, such as `fast`, `standard`, `deep`, or `release`.
3. A **repository lifecycle** decides when a tier runs: local handoff, pull request, `main`, nightly, release candidate, or stable release.

The preferred shape lets an agent and hosted CI run the same repository-owned command. GitHub workflows transport execution and evidence; they do not redefine repository semantics.

```text
local agent handoff -> fast
pull request        -> fast, optionally affected/deeper checks
main                -> normal confidence suite
nightly             -> expensive/deep checks
release candidate   -> qualify an exact commit/artifact
stable release      -> promote/deliver the same qualified artifact
```

Prefer qualifying and promoting an exact immutable candidate over a long-lived `develop -> nightly -> beta -> staging -> production` branch chain.

## Compatibility release

`workflow-standard-v1.3` is frozen for existing consumers. Its tag and `contracts/workflows.json` snapshot remain immutable. Do not publish `workflow-standard-v1.4` or build a monolithic `workflow-standard-v2`; new work on `main` evolves capabilities independently.

## Source-first boundary

Hosted CI is not responsible for recreating every local source workspace. Local source development may use exact sibling sources, including private or intentionally unpublished packages. Publication is a later explicit concern:

```text
source development -> local validation -> done
                                      \
                                       -> optional qualification -> promotion -> delivery
```

## Current capabilities

### Preferred core validation

- `command-validation.yml` — runtime-neutral adapter around one optional repository-owned setup command and one validation command. Emits Execution Receipt v1.
- `coding-tooling-validation.yml` — invokes `coding-tooling` for a declared operation/tier and transports its report plus Execution Receipt v1.
- `coding-tooling-score-history.yml` — persists descriptive score evidence while keeping score semantics in `coding-tooling`.
- `public-contract-validation.yml` — thin wrapper for canonical public-contract evidence transport.
- `environment-v1-canary.yml` — verifies environment-v1 setup preserves tracked repository state and reconstructs the declared semantic environment.
- `fast-validation.yml` — existing Node/Bun convenience adapter retained with a stable interface.

### Specialized / transitional validation

- `integration-validation.yml`
- `e2e-validation.yml`
- `storybook-validation.yml`
- `link-validation.yml`
- `performance-validation.yml`

These remain callable for existing consumers. Prefer repository or `coding-tooling` semantics through the core adapters for new architecture.

### Release qualification and promotion

- `release-qualification.yml` — qualifies one exact consumer SHA, runs repository-owned qualification/build commands, uploads the candidate once, and emits exact-source provenance plus Execution Receipt v1. It accepts one optional opaque `build_token`, exposed only to the build command as `RELEASE_BUILD_TOKEN`; this supports credentialed remote builders without teaching the generic capability about Expo, registries, or another product-specific service.
- `artifact-promotion.yml` — promotes by immutable reference. It consumes a successful qualification receipt, resolves the original GitHub artifact, verifies its archive digest and signed exact-source provenance, and emits a new promotion receipt. It does not rebuild, repack, or publish the candidate.

Qualification does not make the release decision. Promotion records that a previously qualified candidate was selected; it still does not deliver the candidate.

### Delivery

- `deploy-qualified-pages.yml` — consumes a successful promotion receipt, re-verifies the original qualified Pages artifact and signer provenance, then deploys it without checkout, dependency installation, or rebuilding.
- `deliver-qualified-expo-stores.yml` — terminal Expo store delivery. It consumes a successful promotion receipt, re-verifies the original qualified archive and `release-qualification.yml` provenance, safely extracts one `mobile-release.json`, verifies the recorded `.ipa` and `.aab` SHA-256 digests, checks out the exact source only to read app-owned `eas.json`, and submits the exact binaries with `eas submit --path`. It never uses `--latest` and never rebuilds. The caller supplies the app-owned EAS Submit profile and an Expo token; TestFlight/Play tracks and final public-release policy remain outside this capability.
- `deploy-pages.yml` — existing build-and-deploy Pages convenience workflow retained for compatibility/transitional callers.
- `package-publish.yml` — explicit npm/Cargo publication. Publication is never a prerequisite for source development.

A mobile qualified artifact for `deliver-qualified-expo-stores.yml` must contain exactly one `mobile-release.json` with `schemaVersion: 1`, the exact source SHA, build profile, exact EAS CLI version, and one iOS plus one Android entry. Each platform entry records its EAS Build ID, relative binary path, app version/build version, and SHA-256 digest. Store delivery re-hashes the binaries before submission.

### Specialized / legacy lifecycle and release support

- `external-pull.yml` — notify an external deployment host.
- `release-template.yml` — repository-specific release skeleton.
- `stage-validation.yml` — legacy support for consumers that already select commands from a stage/branch model.
- `promote-branches.yml` — exact-tested-SHA branch promotion for consumers that genuinely need promotion branches.
- `toolchain-refresh.yml` — scheduled environment-v1 maintenance adapter for exact toolchain-pin proposals.

### Compatibility only

- `validate-repo.yml` — combined scaffold-v2 compatibility workflow. Do not adopt it in new repositories.

Repository-local `validate.yml`, `deploy-docs-pages.yml`, and `smoke-reusable-workflows.yml` exercise this repository itself; they are not part of the reusable API.

## Generic validation usage

A generic consumer can delegate to one repository-owned command:

```yaml
jobs:
  fast:
    permissions:
      contents: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/command-validation.yml@<immutable-sha>
    with:
      setup_command: bun install --frozen-lockfile
      command: bun run validate:fast
```

For repositories using `coding-tooling`, prefer `coding-tooling-validation.yml` so hosted execution delegates to the same semantic interface used locally.

## Immutable release usage

The generic lifecycle is:

```text
exact source SHA
    |
release-qualification.yml
    |  build once + SHA-256 + signed exact-source provenance
    v
qualified artifact
    |
artifact-promotion.yml
    |  verify by reference; no rebuild/repack
    v
promoted reference
    |
terminal delivery capability
```

For Expo apps, the repository-owned build command may translate `RELEASE_BUILD_TOKEN` into the credential expected by its remote build provider, but that mapping stays inside the consumer. The resulting `mobile-release.json` is part of the qualified artifact and binds the remote build IDs to the downloaded `.ipa`/`.aab` digests.

A caller then invokes `deliver-qualified-expo-stores.yml` with the promotion run/receipt coordinates, the repository's `submit_profile`, and `expo_token`. Delivery installs only the exact requested `eas-cli` version and submits the already-qualified binary files by path.

Do not use this capability to make a hidden production decision. A generated app should normally begin with a TestFlight/Google Play internal profile. An Android production profile can remain draft or staged until an outer lifecycle decision authorizes exposure; Apple public App Store release remains an App Store Connect lifecycle decision after TestFlight/submission evidence is clean.

## Environment-v1 canary

`environment-v1-canary.yml` uses the repository-standard `bash scripts/codex-environment.sh setup` entrypoint. Setup is treated as an idempotent reconstruction operation: tracked state must remain unchanged and the prepared machine must verify against the semantic identity captured before setup.

## Contracts and generated metadata

Workflow YAML is the source of truth for current capability interfaces. `contracts/workflows.json` is only the frozen v1.3 compatibility snapshot.

`contracts/execution-receipt-v1.schema.json` defines the shared execution/evidence transport envelope. `contracts/artifact-provenance-v1.schema.json` defines exact-source artifact provenance for qualified candidates.

Generate current capability metadata with:

```bash
bun run contracts:generate
```

Validate interfaces and architecture with:

```bash
bun run validate:contracts
```

## Caller-owned concerns

Keep these in the caller or consumer repository rather than growing reusable workflow inputs:

- concurrency policy;
- semantic validation tiers and commands;
- source-workspace layout;
- local-only dependency resolution;
- profiler thresholds and benchmark interpretation;
- release authorization;
- application/store identity and metadata;
- EAS build/submit profiles, TestFlight groups, Play tracks/rollout policy, and final production exposure;
- agent/orchestrator behavior.

Reusable workflows own GitHub-specific mechanics: exact checkout, bounded command execution, permissions, provenance/evidence transport, immutable-artifact verification, and terminal delivery APIs where the capability is explicitly scoped.

## Dependency updates and toolchains

Dependency automation is separate from workflow architecture. Dependabot or Renovate may propose updates while repository-owned validation decides whether they are acceptable.

`toolchain-refresh.yml` is likewise separate from normal package dependency automation. It operates only on exact repository-native environment pins supported by `platform-upgrader`, delegates acceptance to the consumer's full gate, and never owns semantic validation or floating-version policy.

## Repository validation

For this repository:

```bash
bun install --frozen-lockfile
bun run validate:fast
```

`smoke-reusable-workflows.yml` dogfoods the generic command/public-contract/release-qualification/promotion path. `deploy-docs-pages.yml` dogfoods qualification -> promotion -> qualified Pages delivery on `main`. Credentialed Expo store delivery remains consumer-canary-only because this repository does not own a real App Store/Google Play product or store credentials.
