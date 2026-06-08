# SCAFFOLD_ALIGNMENT.md

## Canonical source

The normative scaffold contract lives in `monorepo/SCAFFOLD_V2.md`.

## Repo role

`reusable-workflows` owns the shared GitHub Actions workflow contracts consumed by the maintained scaffold-family repos.

## What is local vs shared

Local:

- reusable workflow YAML implementations
- workflow validation for this repository
- release tags such as `scaffold-v2-initial`
- release tags such as `workflow-standard-v1.2`
- machine-readable workflow contracts in `contracts/workflows.json`

Shared:

- the workflow contract expectations documented in `monorepo/REUSABLE_WORKFLOWS.md`
- consumer-facing pinned refs used by maintained repos

## Update path

1. Land workflow contract changes in `monorepo`.
2. Implement them here and validate with `actionlint`.
3. Update `contracts/workflows.json`.
4. Run `bun run validate:contracts`.
5. Tag a new reusable-workflows release.
6. Adopt the new tag in consumer repos through normal PRs.

## What must not drift

- workflow input/output contract for `validate-repo.yml`
- workflow input/output contract for `promote-branches.yml`
- workflow input/output contract for `package-publish.yml`
- workflow input/output contract for `release-template.yml`
- pinned tag history referenced by maintained repos
- staged workflow contract for `workflow-standard-v1.2`
- `fast-validation.yml`
- `integration-validation.yml`
- `e2e-validation.yml`
- `storybook-validation.yml`
- `link-validation.yml`
- `performance-validation.yml`
- `deploy-pages.yml`
- `package-publish.yml`
- `stage-validation.yml`
- `validate-repo.yml`

## Config references

- `.platform-upgrader.json`: not applicable yet for this non-app repo
- `.github/workflows/*.yml`
- `contracts/workflows.json`
- `scripts/validate-workflow-contracts.ts`
- `README.md`
