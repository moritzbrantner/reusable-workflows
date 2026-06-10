# Workflow Contract

This context defines the language for the reusable GitHub Actions workflow contracts owned by this repository.

## Language

**Workflow Contract**:
The versioned callable promise exposed by this repository's reusable GitHub Actions workflows. It includes inputs, secrets, outputs, permissions, defaults, and documented execution behavior.
_Avoid_: Using contract to mean only a YAML file or only `contracts/workflows.json`

**Contract Manifest**:
The machine-readable registry in `contracts/workflows.json` for workflow interfaces and permissions. It is the validated data slice of the broader Workflow Contract.
_Avoid_: Workflow schema, contract file

**Reusable Workflow**:
A `.github/workflows/*.yml` file that exposes `workflow_call` for consumer repositories.
_Avoid_: Reusable contract, shared workflow

**Caller Workflow**:
A workflow that invokes a Reusable Workflow with `jobs.<id>.uses`.
_Avoid_: Local caller, consumer workflow

**Consumer Repository**:
A repository that adopts this repository's Reusable Workflows.
_Avoid_: Maintained repository, scaffold-family repository

**Workflow Standard**:
A versioned contract family, such as `workflow-standard-v1.3`, that groups compatible Reusable Workflows.

**Release Tag**:
An immutable Git tag that Consumer Repositories pin to when adopting a Workflow Standard.
_Avoid_: Moving branch, `main` ref for production consumers

**Adoption Tool**:
The generator and audit surface for consumer workflow adoption. It creates starter Caller Workflow files and reports Adoption Diagnostics.

**Adoption Profile**:
A common Consumer Repository shape, such as web app, monorepo web app, component library, package, or Pages site.

**Adoption Diagnostic**:
A warning or error emitted while auditing consumer workflow YAML.

**Lifecycle Step**:
A distinct CI or release responsibility owned by a Reusable Workflow, such as validation, deployment, publishing, release, or branch promotion.
_Avoid_: Pipeline stage

**Stage**:
A named branch or deployment lane used by Stage Validation, such as `develop`, `nightly`, `beta`, `staging`, or `production`.
_Avoid_: Pipeline stage, GitHub Environment

**Branch Promotion**:
Advancing an exact tested SHA from one branch or ref to another with safeguards.
_Avoid_: Merge, deployment

**Compatibility Workflow**:
A Reusable Workflow retained for existing scaffold-v2 callers while new consumers use the smaller staged workflows.
_Avoid_: Legacy workflow

**Scaffold Contract**:
The sibling `monorepo` scaffold-family contract that this repository aligns with where relevant, without overriding this repository's released Workflow Contracts.

## Reusable Workflows

**Fast Validation**:
The Reusable Workflow for formatting, linting, typechecking, builds, and unit tests that should finish early in pull request feedback.

**Integration Validation**:
The Reusable Workflow for service checks, database checks, migration checks, package checks, and integration test suites.

**E2E Validation**:
The Reusable Workflow for browser, desktop, mobile, Electron, Tauri, or Playwright-style end-to-end validation.

**Storybook Validation**:
The Reusable Workflow for Storybook builds, interaction tests, accessibility checks, and visual validation.

**Link Validation**:
The Reusable Workflow for crawling local or deployed sites to find broken links, missing assets, and fragment anchor failures.

**Performance Validation**:
The Reusable Workflow for slower performance-oriented checks such as Unlighthouse, benchmarks, bundle size, API reports, and normalized metrics.

**Deploy Pages**:
The Reusable Workflow for building and deploying a GitHub Pages artifact.

**External Pull**:
The Reusable Workflow for notifying an external deployment host to pull the current repository ref and SHA.

**Package Publish**:
The Reusable Workflow for ordinary npm-compatible registry or Cargo package publication.

**Release Template**:
The Reusable Workflow skeleton for repository-specific release flows that need validation, build, publish, and artifact upload commands.

**Stage Validation**:
The Reusable Workflow for running a command selected by Stage.

**Promote Branches**:
The Reusable Workflow for Branch Promotion between maintained branches.

**Validate Repo**:
The Compatibility Workflow for existing scaffold-v2 repositories that still use the older combined validation surface.
