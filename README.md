# Reusable Workflows Reference

This folder is a documentation-only reference pack for a dedicated private repository that owns shared GitHub workflows. It is not a second live workflow repository inside this monorepo.

## What this reference pack includes

- `validate-repo.yml` for shared validation
- `promote-branches.yml` for branch promotion
- `release-template.yml` for release orchestration
- first pinned ref: `scaffold-v2-initial`

## How to use it

1. Create a new private repository for shared workflows.
2. Copy the files in this folder into that repository.
3. Tag the first release as `scaffold-v2-initial`.
4. Consume the workflows from downstream repos with pinned `uses:` references.
5. Let Dependabot update workflow refs instead of copying YAML bodies around.
