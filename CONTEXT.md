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
`coding-tooling-validation.yml`, an optional hosted adapter that invokes the private `coding-tooling` Action for eligible private Consumer Repositories. `coding-tooling` owns tier and capability semantics; this repository owns only the GitHub execution wrapper and report transport.

**Source-first development**  
Development against repository sources, including exact sibling sources where appropriate, without requiring package publication or hosted cross-repository access as a prerequisite.

**Compatibility Release**  
The immutable `workflow-standard-v1.3` tag and its historical contract snapshot. It exists for current callers but does not define the architecture of `main`.

**Capability Release**  
An optional immutable ref published for one or more compatible capability changes. New capability work must not depend on publishing a new monolithic Workflow Standard.

**Generated Capability Manifest**  
Machine-readable metadata derived from the current workflow YAML. Inputs, secrets, outputs, defaults, and permissions are not manually duplicated as an authoritative contract.

**Advanced Capability**  
A capability such as branch promotion, existing stage validation, external deployment notification, or custom release automation that is useful only when a repository actually needs that structure. It is not a default lifecycle model.

## Ownership rules

1. Workflow YAML owns the current hosted interface.
2. Consumer repositories and `coding-tooling` own semantic validation commands, tiers/depth, and source-workspace behavior; caller workflows own lifecycle timing.
3. `coding-tooling-validation.yml` may reproduce a `coding-tooling` tier on GitHub for eligible private consumers, but GitHub access is never a prerequisite for the local path.
4. `fast-validation.yml` remains the universal command adapter for consumers that do not or cannot use the private Action.
5. `runtime-profiler` or repository tooling owns performance meaning; GitHub workflows transport execution and evidence.
6. Agent contracts and orchestrators may consume results but are not dependencies of any Workflow Capability.
7. Publication and release workflows are terminal, optional operations rather than development prerequisites. Prefer qualifying and promoting an exact commit or artifact over a required chain of promotion branches.
8. Concurrency policy belongs in Caller Workflows unless a GitHub API requires capability-local serialization.

## Capability classes

### Preferred core validation

- `fast-validation.yml`
- `coding-tooling-validation.yml`

`coding-tooling-validation.yml` is preferred for private consumers that already use `coding-tooling`; it delegates a consumer-owned tier to the private Action and uploads the resulting JSON report. `fast-validation.yml` is the thin generic command adapter. This public repository cannot execute the private Action itself, so the adapter is not part of the local smoke fanout.

### Specialized / transitional validation

- `integration-validation.yml`
- `e2e-validation.yml`
- `storybook-validation.yml`
- `link-validation.yml`
- `performance-validation.yml`

These workflows remain callable, but new design should prefer repository or `coding-tooling` semantics through the preferred core adapters rather than growing their GitHub-specific interfaces.

### Delivery

- `deploy-pages.yml`
- `package-publish.yml`

### Specialized / legacy lifecycle and release support

- `external-pull.yml`
- `release-template.yml`
- `stage-validation.yml`
- `promote-branches.yml`

`stage-validation.yml` is specialized legacy support for an existing branch/stage model, not the preferred lifecycle abstraction. `promote-branches.yml` remains available for consumers that genuinely use promotion branches, not as the default release path. Nightly, beta/release-candidate, and stable normally describe lifecycle or release state rather than deterministic validation capabilities.

### Compatibility only

- `validate-repo.yml`

`validate.yml`, `deploy-docs-pages.yml`, and `smoke-reusable-workflows.yml` are repository-local Caller Workflows used to validate this repository itself.

## Compatibility policy

`workflow-standard-v1.3` is frozen. Do not move the tag, publish `workflow-standard-v1.4`, or create a monolithic `workflow-standard-v2` merely to evolve current capabilities.

Breaking changes on `main` are allowed when they establish the thinner capability model because existing consumers remain protected by their immutable v1.3 pin. New consumers of the capability line should use immutable commit SHAs until a deliberate capability-specific release exists.
