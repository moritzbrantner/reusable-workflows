# Workflow Capability Context

This repository owns optional GitHub Actions adapter capabilities. It does not own the development model of consumer repositories.

## Language

**Workflow Capability**  
A callable `.github/workflows/*.yml` unit that provides one GitHub-hosted responsibility. Capabilities are independently adoptable and should not require a repository to adopt a larger workflow family.

**Caller Workflow**  
A repository-local workflow that invokes a Workflow Capability with `jobs.<id>.uses`.

**Consumer Repository**  
A repository that chooses to invoke one or more Workflow Capabilities.

**Repository-owned validation**  
Commands, configuration, and deterministic tooling that define what a repository considers valid. These should work locally without requiring this repository or an orchestrator.

**Validation Capability**  
A semantic check such as linting, tests, E2E, accessibility, or benchmarking. It says what is checked, not when it runs.

**Validation Tier / Depth**  
A consumer-owned composition of deterministic validation capabilities, such as `fast`, `standard`, `deep`, or `release`.

**Repository Lifecycle**  
Caller-owned policy for when validation, qualification, promotion, or delivery runs.

**Command Validation Adapter**  
`command-validation.yml`, the runtime-neutral hosted adapter around one optional repository-owned setup command and one repository-owned validation command.

**Coding Tooling Adapter**  
`coding-tooling-validation.yml`, the hosted adapter that delegates operation/tier/report semantics to `coding-tooling`.

**Coding Tooling Score History Adapter**  
`coding-tooling-score-history.yml`, a persistent-evidence adapter that delegates scoring semantics and attribution to an immutable `coding-tooling` revision.

**Public Contract Adapter**  
`public-contract-validation.yml`, a thin transport wrapper around canonical public-contract evidence.

**Environment Integrity Canary**  
`environment-v1-canary.yml`, which verifies the standard environment-v1 setup is idempotent over tracked state and reconstructs the declared semantic environment.

**Release Qualification Adapter**  
`release-qualification.yml`, which qualifies one exact consumer commit, builds the candidate once, and transports the artifact plus exact-source provenance and Execution Receipt v1. It may accept one opaque `build_token`; that secret is exposed only to the repository-owned build command as `RELEASE_BUILD_TOKEN`. The adapter does not know what external builder or credential the consumer maps that token to.

**Artifact Promotion Adapter**  
`artifact-promotion.yml`, a read-only promotion-by-reference adapter. It consumes a successful qualification receipt, resolves the immutable original artifact, verifies archive digest and signed qualification provenance, then records the selected candidate in a promotion receipt. It does not rebuild, repack, publish, or deploy.

**Qualified Pages Delivery Adapter**  
`deploy-qualified-pages.yml`, a terminal Pages delivery adapter that consumes a successful promotion receipt, re-verifies the original artifact and qualification signer, and deploys without rebuilding.

**Qualified Expo Store Delivery Adapter**  
`deliver-qualified-expo-stores.yml`, a terminal mobile-store delivery adapter. It consumes a successful promotion receipt, re-verifies the original qualification archive and signed source provenance, verifies one `mobile-release.json` plus exact `.ipa`/`.aab` digests, checks out the exact source only for app-owned EAS configuration, and submits those binaries with `eas submit --path`. It never builds and never resolves a latest build. The caller/app owns submit profiles, store tracks/groups, rollout state, and final public-release authorization.

**Source-first development**  
Development against repository sources, including exact sibling sources where appropriate, without requiring publication or hosted cross-repository access as a prerequisite.

**Compatibility Release**  
The immutable `workflow-standard-v1.3` tag and historical contract snapshot.

**Capability Release**  
An optional immutable ref for one or more compatible capability changes. New work does not require a monolithic Workflow Standard release.

**Generated Capability Manifest**  
Machine-readable metadata derived from current workflow YAML; interface metadata is not manually duplicated as an authoritative contract.

## Ownership rules

1. Workflow YAML owns the current hosted interface.
2. Consumer repositories and `coding-tooling` own semantic validation; caller workflows own lifecycle timing.
3. `command-validation.yml` stays runtime-neutral and must not grow framework/test-kind inputs.
4. `coding-tooling-validation.yml` reproduces a repository-owned `coding-tooling` operation/tier on GitHub; GitHub is never a prerequisite for the local path.
5. `coding-tooling-score-history.yml` may persist descriptive score evidence but must not add score thresholds or release policy.
6. `public-contract-validation.yml` standardizes transport/location, not evidence meaning.
7. `environment-v1-canary.yml` owns only the hosted pre/setup/post sequence and must use the standard environment-v1 setup seam.
8. `fast-validation.yml` remains a stable Node/Bun convenience adapter, not the generic abstraction.
9. `runtime-profiler` or repository tooling owns performance meaning; GitHub workflows transport evidence.
10. Publication and release workflows are terminal optional operations, not development prerequisites.
11. `release-qualification.yml` binds repository-owned qualification/build commands to one exact source SHA and candidate. Its only optional credential seam is `build_token`, scoped to the build step; it must not acquire product-specific publication authority.
12. `artifact-promotion.yml` selects only a previously successful qualified artifact by exact run/receipt reference and must verify the original archive and qualification provenance before promotion.
13. `deploy-qualified-pages.yml` deploys only the artifact identified by a successful promotion receipt and cannot accept build/runtime/install inputs.
14. `deliver-qualified-expo-stores.yml` delivers only a promoted artifact containing a verified mobile release manifest and exact binary digests. It may install an exact EAS CLI for submission but cannot invoke `eas build`, accept a build command, or use `--latest`.
15. Store identity, App Store Connect/Play Console metadata, EAS build/submit profiles, TestFlight groups, Play tracks/rollouts, and final public exposure remain caller/application policy.
16. Concurrency policy belongs in caller workflows unless an API/persistent writer requires capability-local serialization.
17. `toolchain-refresh.yml` owns only hosted freshness orchestration; toolchain semantics and acceptance stay with platform-upgrader/environment-v1/the consumer.

## Capability classes

### Preferred core validation

- `command-validation.yml`
- `coding-tooling-validation.yml`
- `coding-tooling-score-history.yml`
- `public-contract-validation.yml`
- `environment-v1-canary.yml`
- `fast-validation.yml`

### Specialized / transitional validation

- `integration-validation.yml`
- `e2e-validation.yml`
- `storybook-validation.yml`
- `link-validation.yml`
- `performance-validation.yml`

### Release qualification and promotion

- `release-qualification.yml`
- `artifact-promotion.yml`

The qualification capability builds once and binds the artifact to exact source provenance. The promotion capability verifies that same candidate and records the lifecycle selection without copying or rebuilding it.

### Delivery

- `deploy-qualified-pages.yml`
- `deliver-qualified-expo-stores.yml`
- `deploy-pages.yml`
- `package-publish.yml`

For Expo delivery, the qualification artifact is expected to carry a repository-produced `mobile-release.json` that binds source SHA, EAS Build IDs, binary paths, and binary SHA-256 digests. The terminal workflow re-hashes the actual `.ipa` and `.aab` before exact-path submission. This creates one inspectable chain:

```text
source SHA
  -> qualified GitHub artifact digest + signed provenance
  -> mobile-release.json
  -> IPA/AAB digests + EAS Build IDs
  -> exact-path TestFlight / Google Play submission
```

The chain deliberately stops short of silently releasing to public users. Android production can remain draft/staged until caller policy authorizes exposure, and Apple public App Store release remains an App Store Connect lifecycle decision.

### Specialized / legacy lifecycle and release support

- `external-pull.yml`
- `release-template.yml`
- `stage-validation.yml`
- `promote-branches.yml`
- `toolchain-refresh.yml`

### Compatibility only

- `validate-repo.yml`

Repository-local `validate.yml`, `deploy-docs-pages.yml`, and `smoke-reusable-workflows.yml` validate this repository itself and are not reusable capability APIs.

## Compatibility policy

`workflow-standard-v1.3` is frozen. Do not move the tag, publish `workflow-standard-v1.4`, or create a monolithic `workflow-standard-v2` merely to evolve current capabilities. New consumers of the capability line should pin exact commit SHAs until a deliberate capability-specific release exists.
