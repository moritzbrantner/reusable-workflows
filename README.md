# Reusable GitHub Workflow Capabilities

This repository provides small GitHub Actions adapters plus the canonical workflow profiles used to normalize maintained repositories across the fleet.

It is the source of truth for GitHub workflow topology and reusable GitHub mechanics. It is **not** the source of truth for repository-owned validation semantics, product behavior, or local development commands.

The ownership boundary is:

1. `coding-agent-conventions` describes preferred repository behavior.
2. Repository-owned commands and `coding-tooling` implement deterministic checks locally.
3. Source workspaces may compose sibling repositories directly and remain usable without GitHub.
4. This repository defines the canonical workflow profile and reproduces selected checks or release operations on GitHub-hosted runners.
5. `platform-upgrader` reconciles maintained repositories to those profiles and `coding-tooling` reports profile drift.
6. Agent contracts, profilers, and orchestrators may consume results, but are not prerequisites for these workflows.

Maintained repositories select one canonical profile from `profiles/workflow-profiles.json` and enable only the roles they need. Extra workflow files require an explicit repository-local exception. See [WORKFLOW_PROFILES.md](WORKFLOW_PROFILES.md).

## Validation architecture

Keep three decisions separate:

1. A **validation capability** describes what is checked: linting, tests, E2E, accessibility, benchmarks, and so on.
2. A **validation tier/depth** composes deterministic capabilities into the confidence a repository wants, such as `fast`, `standard`, `deep`, or `release`.
3. A **repository lifecycle** decides when a tier runs: local handoff, pull request, `main`, nightly, release candidate, or stable release.

The preferred shape lets an agent and hosted CI run the same repository-owned command. GitHub workflows transport execution and evidence; they do not redefine repository semantics.

```text
local agent handoff -> fast
pull request        -> fast
main                -> broader confidence suite
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

### Default validation

- `command-validation.yml` — runtime-neutral adapter that checks out the repository, optionally runs one repository-owned setup command, then runs one repository-owned validation command. It emits no reusable validation receipt.
- `coding-tooling-validation.yml` — invokes `coding-tooling` directly for a declared operation/tier. Failed runs may upload reports or repository evidence for diagnosis, but those artifacts are never used to skip or validate a later run.
- `coding-tooling-score-history.yml` — persists descriptive score evidence while keeping score semantics in `coding-tooling`.
- `public-contract-validation.yml` — thin wrapper for canonical public-contract evidence transport.
- `environment-v1-canary.yml` — optionally checks whether the repository's environment-v1 setup command succeeds. It does not verify runner or environment identity.
- `build-artifact.yml` — ordinary-CI producer that checks out one exact source SHA and returns one source-bound artifact plus Execution Receipt v1. By default it builds and uploads normally; opt-in `reuse_across_runs` first resolves a still-retained artifact with the same exact build identity and returns its original `producer_run_id` without rerunning setup or the build. It has no release, promotion, or deployment authority.
- `fast-validation.yml` — existing Node/Bun convenience adapter retained with a stable interface.

### Validation reuse

Ordinary validation results are not reused across revisions. The former validation-impact and validation-evidence workflows were removed because they added routing and trust state without external consumers. Run the repository-owned validation command for the revision being checked.

### Canonical profile composition

Reusable capabilities remain independently callable, but maintained fleet repositories should normally expose only the canonical caller files selected by their workflow profile: `validate.yml`, plus the profile's explicitly enabled `pages.yml`, `evidence.yml`, `publish.yml`, `deploy.yml`, or `release.yml` roles. Prefer adding jobs or matrices inside those callers over creating another top-level workflow file.

For repositories where Pages is an important application surface, `validate.yml` should produce the Pages artifact on pull requests and `main`. Use `build-artifact.yml` when the artifact needs to feed multiple hosted checks or a later workflow. The `pages.yml` role should normally wait for successful `main` validation, resolve/reuse that exact source-bound artifact, and pass it to `deploy-pages.yml` without reinstalling dependencies or rebuilding. This keeps Pages verification in the ordinary completion gate while making deployment a thin delivery step.

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

Qualification does not make the release decision. Promotion records that a previously qualified candidate was selected; it still does not deliver the candidate. Cross-run ordinary-CI reuse is deliberately not applied implicitly to `release-qualification.yml`; qualification remains an explicit lifecycle operation and promotion is the reuse-by-reference boundary for qualified candidates.

### Delivery

- `deploy-qualified-pages.yml` — consumes a successful promotion receipt, re-verifies the original qualified Pages artifact and signer provenance, then deploys it without checkout, dependency installation, or rebuilding.
- `deliver-qualified-expo-stores.yml` — terminal Expo store delivery. It consumes a successful promotion receipt, re-verifies the original qualified archive and `release-qualification.yml` provenance, safely extracts one `mobile-release.json`, verifies the recorded `.ipa` and `.aab` SHA-256 digests, checks out the exact source only to read app-owned `eas.json`, and submits the exact binaries with `eas submit --path`. It never uses `--latest` and never rebuilds. The caller supplies the app-owned EAS Submit profile and an Expo token; TestFlight/Play tracks and final public-release policy remain outside this capability.
- `deploy-pages.yml` — existing build-and-deploy Pages convenience workflow retained for compatibility/transitional callers.

`package-publish.yml` (npm/Cargo publication) is retired on `main`: npm publishing is paused. Owner packages are consumed as commit-pinned git dependencies (`git+https://github.com/moritzbrantner/<repo>.git#<sha>`) with a self-installing `prepare` build. Callers pinned to `workflow-standard-v1.2`/`v1.3` tags or SHAs keep resolving the old file; do not add new callers.

A mobile qualified artifact for `deliver-qualified-expo-stores.yml` must contain exactly one `mobile-release.json` with `schemaVersion: 1`, the exact source SHA, build profile, exact EAS CLI version, and one iOS plus one Android entry. Each platform entry records its EAS Build ID, relative binary path, app version/build version, and SHA-256 digest. Store delivery re-hashes the binaries before submission.

### Specialized / legacy lifecycle and release support

- `external-pull.yml` — notify an external deployment host.
- `release-template.yml` — repository-specific release skeleton. It no longer wires `NPM_TOKEN`/`node_auth_token` or requests `packages`/`id-token` write; do not use it for npm publishing.
- `stage-validation.yml` — legacy support for consumers that already select commands from a stage/branch model.
- `promote-branches.yml` — exact-tested-SHA branch promotion for consumers that genuinely need promotion branches.
- `toolchain-refresh.yml` — scheduled environment-v1 maintenance adapter for exact toolchain-pin proposals.

`promote-branches.yml` uses only the built-in `GITHUB_TOKEN`. The caller job must explicitly grant `contents: write` and `actions: write`; reusable workflows cannot elevate the caller's token permissions. Branch protection must permit this promotion. Workflow files under `.github/workflows` must already match the tested commit on the target branch: the token cannot push workflow-file changes, so preflight rejects that diff before promotion. Synchronize those files through the repository's normal reviewed workflow first.

```yaml
jobs:
  promote:
    permissions:
      contents: write
      actions: write
    uses: moritzbrantner/reusable-workflows/.github/workflows/promote-branches.yml@main
    with:
      source_branch: staging
      target_branch: production
      tested_sha: ${{ github.sha }}
      dispatch_workflows: deploy.yml
```

Pushes with this token do not start push-triggered workflows. Each optional `dispatch_workflows` entry must exist on the repository default branch and support `workflow_dispatch` on both the default and target branches, with a default for every required input; this interface supplies no input values. A failed dispatch emits a warning and continues with the remaining workflows after the promotion has completed.

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
    uses: moritzbrantner/reusable-workflows/.github/workflows/command-validation.yml@main
    with:
      setup_command: bun install --frozen-lockfile
      command: bun run validate:fast
```

For repositories using `coding-tooling`, prefer `coding-tooling-validation.yml` so hosted execution delegates to the same semantic interface used locally.

Validation results are not reused across source changes. If a repository needs validation, the hosted adapter runs the repository-owned command for that revision.

`build-artifact.yml` is intentionally separate from validation semantics. A caller supplies an exact source SHA, a stable artifact key, preparation if needed, the one build command, and the paths to preserve. Its deterministic identity covers those coordinates plus the runner identity. With `reuse_across_runs: true`, the workflow searches retained build receipts for that identity, verifies the full receipt/source/run/artifact coordinates, and skips setup/build/upload only on a proven hit. Lookup or verification uncertainty falls back to a normal build. Callers that enable reuse must pass the returned `producer_run_id` together with artifact name, digest, receipt name, source SHA, artifact key, and identity digest to downstream consumers rather than assuming `github.run_id`.

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

`environment-v1-canary.yml` runs the repository-standard `bash scripts/codex-environment.sh setup` entrypoint as an optional smoke test. Its former evidence outputs are empty for compatibility; success means only that setup returned successfully.

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

Keep these in the caller or consumer repository rather than growing reusable workflow inputs. The workflow profile still bounds which top-level caller files exist:

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

`validate.yml` keeps pull requests deliberately small: the fast semantic gate, workflow syntax, and the deployable Pages artifact are the default blockers. Browser, link, Storybook, and performance lanes run after merge on `main`, by manual dispatch, or when a pull request explicitly carries the matching `ci:*` label. The Pages artifact enables exact-source deployment reuse; ordinary validation results are still not reused across revisions.

`smoke-reusable-workflows.yml` dogfoods the generic command/public-contract/build-artifact/reuse/release-qualification/promotion path. Branch pushes do not run a duplicate smoke suite when a pull request already provides the PR smoke boundary; push smoke is reserved for `main`. The repository's ordinary `validate.yml` now produces the reference Pages artifact for every pull request and `main`; `deploy-docs-pages.yml` resolves/reuses the successful `main` artifact and deploys it without rebuilding. Release qualification/promotion remains covered by the smoke workflow for consumers that genuinely need an immutable release lifecycle. Credentialed Expo store delivery remains consumer-canary-only because this repository does not own a real App Store/Google Play product or store credentials.
