# Scaffold Alignment

This repository no longer defines a workflow family that every scaffold should reproduce.

Scaffolds should expose repository-owned commands first and may then add whichever GitHub Workflow Capabilities are useful for that template.

## Default guidance

A new scaffold may start with only `fast-validation.yml`. Add integration, e2e, Storybook, link, performance, deployment, or publication capabilities only when the generated repository actually needs them.

Caller workflows own repository policy such as triggers, concurrency, path filters, and which capabilities are required checks.

## Source-first repositories

Scaffolds that support sibling-source or development-mode dependencies must keep that mode independent of GitHub-hosted publication and private cross-repository checkout. The local/source path is authoritative for development; hosted workflows are optional adapters.

## Compatibility

`workflow-standard-v1.3` remains immutable for existing scaffold-v2 consumers. `validate-repo.yml` is compatibility-only and should not be emitted by new scaffolds.

There is no planned monolithic `workflow-standard-v2`. New scaffold changes should compose independent capabilities and pin immutable revisions.

## Contract ownership

The current `.github/workflows/*.yml` files own their callable interfaces. `contracts/workflows.json` is the frozen v1.3 compatibility snapshot, not a second source of truth for `main`.

Use `bun run contracts:generate` when current capability metadata is needed.
