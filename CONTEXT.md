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
A semantic check such as linting, unit tests, integration validation, E2E, accessibility, or benchmarking. A capability says what is checked; it does not encode when it runs.

**Validation Tier / Depth**
A consumer-owned composition of deterministic validation capabilities, such as `fast`, `standard`, `deep`, `release`, or a repository-specific equivalent. `coding-tooling` defaults and consumer configuration own tier definitions.

**Repository Lifecycle**
Caller-owned policy for when a tier runs: local/agent handoff, pull request, `main`, nightly, release candidate, or stable release. Lifecycle does not redefine a capability or tier.

**Coding Tooling Adapter**  
`coding-tooling-validation.yml`, an optional hosted adapter that invokes `coding-tooling`. `coding-tooling` owns tier, operation, capability, and report semantics; this repository owns only the GitHub execution wrapper and report transport.

**Public Contract Adapter**  
`public-contract-validation.yml`, a deliberately thin wrapper around the coding-tooling adapter. It standardizes the canonical `.artifacts/coding-tooling/public-contract.json` artifact path while leaving public-surface discovery, evidence meaning, verification policy, and test-framework choices outside this repository.

**Environment Integrity Canary**  
`environment-v1-canary.yml`, a hosted environment-v1 adapter that captures semantic identity before setup, runs the standard repository setup entrypoint, requires setup to be idempotent over tracked state, verifies the prepared machine against the exact pre-setup identity, and transports short-lived evidence. Environment semantics remain owned by environment-v1 and `coding-tooling`.

**Release Qualification Adapter**  
`release-qualification.yml`, a hosted adapter that qualifies one exact consumer commit through repository-owned commands, builds the candidate once, and transports the artifact plus a receipt containing its source identity and upload digest. It does not publish, deploy, version, or make the release decision.

**Source-first development**  
Development against repository sources, including exact sibling sources where appropriate, without requiring package publication or hosted cross-repository access as a prerequisite.

**Compatibility Release**  
The immutable `workflow-standard-v1.3` tag and its historical contract snapshot. It exists for current callers but does not define the architecture of `main`.

**Capability Release**  
An optional immutable ref published for one or more compatible capability changes. New capability work must not depend on publishing a new monolithic Workflow Standard.

**Generated Capability Manifest**  
Machine-readable metadata derived from the current workflow YAML. Inputs, secrets, outputs, defaults, and permissions are not manually duplicated as an authoritative contract.

**Advanced Capability**  
A capability such as branch promotion, existing stage validation, external deployment notification, custom release automation, or scheduled toolchain refresh that is useful only when a repository actually needs that structure. It is not a default lifecycle model.

## Ownership rules

1. Workflow YAML owns the current hosted interface.
2. Consumer repositories and `coding-tooling` own semantic validation commands, tiers/depth, public-contract evidence, and source-workspace behavior; caller workflows own lifecycle timing.
3. `coding-tooling-validation.yml` may reproduce a `coding-tooling` operation or tier on GitHub, but GitHub access is never a prerequisite for the local path.
4. `public-contract-validation.yml` standardizes report transport and location only; it must not reimplement public-surface or evidence semantics.
5. `environment-v1-canary.yml` owns only the hosted pre/setup/post evidence sequence. It must use the standard environment-v1 setup entrypoint and must not redefine environment identity or repair consumer state.
6. `fast-validation.yml` remains the universal command adapter for consumers that do not use the semantic tooling adapter.
7. `runtime-profiler` or repository tooling owns performance meaning; GitHub workflows transport execution and evidence.
8. Agent contracts and orchestrators may consume results but are not dependencies of any Workflow Capability.
9. Publication and release workflows are terminal, optional operations rather than development prerequisites. Prefer qualifying and promoting an exact commit or artifact over a required chain of promotion branches.
10. `release-qualification.yml` may bind repository-owned qualification/build commands to one exact source SHA and retain the resulting artifact/receipt; release policy and publication remain outside the capability.
11. Concurrency policy belongs in Caller Workflows unless a GitHub API requires capability-local serialization.
12. `toolchain-refresh.yml` owns only hosted freshness orchestration. `platform-upgrader` owns latest-stable discovery and compatibility-hold mutation, environment-v1 owns setup semantics, and the consumer repository owns the full acceptance gate.

## Capability classes

### Preferred core validation

- `fast-validation.yml`
- `coding-tooling-validation.yml`
- `public-contract-validation.yml`
- `environment-v1-canary.yml`

`coding-tooling-validation.yml` delegates consumer-owned semantic operations and tiers to `coding-tooling` and uploads the resulting JSON report. `public-contract-validation.yml` specializes only the operation and canonical artifact path for public-contract measurement. `fast-validation.yml` remains the thin generic command adapter. `environment-v1-canary.yml` is independent of validation depth: it checks that environment construction preserves repository identity and reproduces the semantic environment it was given. The repository smoke fanout dogfoods the public-contract wrapper in observe mode; environment-v1 remains a consumer-owned canary because it requires the consumer's declared setup entrypoint and semantic identity.

### Specialized / transitional validation

- `integration-validation.yml`
- `e2e-validation.yml`
- `storybook-validation.yml`
- `link-validation.yml`
- `performance-validation.yml`

These workflows remain callable, but new design should prefer repository or `coding-tooling` semantics through the preferred core adapters rather than growing their GitHub-specific interfaces.

### Release qualification

- `release-qualification.yml`

The qualification capability checks out the exact caller-supplied source SHA, runs repository-owned qualification and build commands, uploads the built candidate once, and records the source SHA plus artifact digest in its receipt. A publisher or deployment capability should consume that qualified artifact rather than rebuild the candidate.

### Delivery

- `deploy-pages.yml`
- `package-publish.yml`

### Specialized / legacy lifecycle and release support

- `external-pull.yml`
- `release-template.yml`
- `stage-validation.yml`
- `promote-branches.yml`
- `toolchain-refresh.yml`

`stage-validation.yml` is specialized legacy support for an existing branch/stage model, not the preferred lifecycle abstraction. `promote-branches.yml` remains available for consumers that genuinely use promotion branches, not as the default release path. Nightly, beta/release-candidate, and stable normally describe lifecycle or release state rather than deterministic validation capabilities.

`toolchain-refresh.yml` is a maintenance capability for environment-v1 consumers. A caller-owned schedule invokes an immutable workflow ref and an immutable `platform-upgrader` ref. The workflow proposes exact native toolchain pins, prepares the candidate repository environment, delegates acceptance to the consumer-owned full gate, reuses one upgrade branch/PR on success, and restores accepted pins plus publishes a compatibility-hold PR on failure. It never owns semantic validation or floating version policy.

### Compatibility only

- `validate-repo.yml`

`validate.yml`, `deploy-docs-pages.yml`, and `smoke-reusable-workflows.yml` are repository-local Caller Workflows used to validate this repository itself.

## Compatibility policy

`workflow-standard-v1.3` is frozen. Do not move the tag, publish `workflow-standard-v1.4`, or create a monolithic `workflow-standard-v2` merely to evolve current capabilities.

Breaking changes on `main` are allowed when they establish the thinner capability model because existing consumers remain protected by their immutable v1.3 pin. New consumers of the capability line should use immutable commit SHAs until a deliberate capability-specific release exists.
