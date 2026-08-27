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

**Source-first development**  
Development against repository sources, including exact sibling sources where appropriate, without requiring package publication or hosted cross-repository access as a prerequisite.

**Compatibility Release**  
The immutable `workflow-standard-v1.3` tag and its historical contract snapshot. It exists for current callers but does not define the architecture of `main`.

**Capability Release**  
An optional immutable ref published for one or more compatible capability changes. New capability work must not depend on publishing a new monolithic Workflow Standard.

**Generated Capability Manifest**  
Machine-readable metadata derived from the current workflow YAML. Inputs, secrets, outputs, defaults, and permissions are not manually duplicated as an authoritative contract.

**Advanced Capability**  
A capability such as branch promotion, stage validation, external deployment notification, or custom release automation that is useful only when a repository actually needs that structure.

## Ownership rules

1. Workflow YAML owns the current hosted interface.
2. Consumer repositories own semantic validation commands and source-workspace behavior.
3. `coding-tooling` may execute the same repository checks locally or remotely, but GitHub access is not a prerequisite for the local path.
4. `runtime-profiler` or repository tooling owns performance meaning; GitHub workflows transport execution and evidence.
5. Agent contracts and orchestrators may consume results but are not dependencies of any Workflow Capability.
6. Publication and release workflows are terminal, optional operations rather than development prerequisites.
7. Concurrency policy belongs in Caller Workflows unless a GitHub API requires capability-local serialization.

## Capability classes

### Core validation

- `fast-validation.yml`
- `integration-validation.yml`
- `e2e-validation.yml`
- `storybook-validation.yml`
- `link-validation.yml`
- `performance-validation.yml`

### Delivery

- `deploy-pages.yml`
- `package-publish.yml`

### Advanced

- `external-pull.yml`
- `release-template.yml`
- `stage-validation.yml`
- `promote-branches.yml`

### Compatibility only

- `validate-repo.yml`

`validate.yml`, `deploy-docs-pages.yml`, and `smoke-reusable-workflows.yml` are repository-local Caller Workflows used to validate this repository itself.

## Compatibility policy

`workflow-standard-v1.3` is frozen. Do not move the tag, publish `workflow-standard-v1.4`, or create a monolithic `workflow-standard-v2` merely to evolve current capabilities.

Breaking changes on `main` are allowed when they establish the thinner capability model because existing consumers remain protected by their immutable v1.3 pin. New consumers of the capability line should use immutable commit SHAs until a deliberate capability-specific release exists.
