# SCAFFOLD_ALIGNMENT.md

## Source of truth

The normative Scaffold Contract lives in `monorepo/SCAFFOLD_V2.md`. This repository is authoritative for released reusable Workflow Contracts after they are implemented, validated, documented, and tagged here.

## Repo role

`reusable-workflows` owns the shared GitHub Actions Workflow Contracts consumed by maintained Consumer Repositories, including scaffold-family repos.

## What is local vs shared

Local:

- reusable workflow YAML implementations
- workflow validation for this repository
- release tags such as `scaffold-v2-initial`
- release tags such as `workflow-standard-v1.3`
- the Contract Manifest in `contracts/workflows.json`

Shared:

- Scaffold Contract expectations documented in `monorepo/REUSABLE_WORKFLOWS.md`
- consumer-facing pinned refs used by maintained repos

## Update path

1. Land Scaffold Contract changes in `monorepo` when the change starts from scaffold-family expectations.
2. Implement the Workflow Contract changes here and validate with `actionlint`.
3. Update the Contract Manifest in `contracts/workflows.json`.
4. Run `bun run validate:contracts`.
5. Tag a new reusable-workflows release.
6. Adopt the new tag in consumer repos through normal PRs.

## What must not drift

- workflow input/output contract for `validate-repo.yml`
- workflow input/output contract for `promote-branches.yml`
- workflow input/output contract for `package-publish.yml`
- workflow input/output contract for `release-template.yml`
- workflow input/output contract for `external-pull.yml`
- pinned tag history referenced by maintained repos
- staged workflow contract for `workflow-standard-v1.3`
- `coding-tooling-validation.yml` (private Consumer Repositories only)
- `fast-validation.yml`
- `integration-validation.yml`
- `e2e-validation.yml`
- `storybook-validation.yml`
- `link-validation.yml`
- `performance-validation.yml`
- `deploy-pages.yml`
- `external-pull.yml`
- `package-publish.yml`
- `stage-validation.yml`
- `validate-repo.yml`

## Future v2 alignment

`workflow-standard-v1.3` keeps repeated common inputs because they are part of the released Workflow
Contract. The reference app reports 79 unique input names separately from 279 workflow-specific
input slots to make that distinction visible.

A future `workflow-standard-v2` may reduce the slot count below 200 by removing `validate-repo.yml`
from the main standard, moving concurrency to Caller Workflows, replacing cache booleans with empty
cache dependency paths, removing `artifact_name_suffix`, consolidating Playwright setup into
`install_playwright_browsers`, and requiring callers to put `xvfb-run` directly in commands that
need it. Those changes must not be backported into `workflow-standard-v1.3`.

## Config references

- `.platform-upgrader.json`: not applicable yet for this non-app repo
- `.github/workflows/*.yml`
- `contracts/workflows.json`
- `scripts/validate-workflow-contracts.ts`
- `README.md`
