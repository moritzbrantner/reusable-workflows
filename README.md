# Reusable Workflows Reference

This repository owns shared GitHub Actions workflow contracts for maintained `moritzbrantner/*` repositories.

## Workflow Standard

Target release tag: `workflow-standard-v1`.

Use staged reusable workflows instead of one oversized workflow:

- `fast-validation.yml`: PR/default-branch linting, formatting checks, typechecking, build, and unit tests.
- `integration-validation.yml`: integration tests, service/database checks, migration checks, and package/API checks.
- `e2e-validation.yml`: Playwright, browser, Electron, Tauri, or mobile e2e tests with failure artifacts.
- `storybook-validation.yml`: Storybook build, interaction tests, accessibility checks, and visual checks where present.
- `performance-validation.yml`: Unlighthouse, benchmarks, bundle-size checks, API reports, and heavier performance suites.
- `deploy-pages.yml`: GitHub Pages build and deployment only.
- `release-template.yml`: package or app release only.
- `stage-validation.yml`: branch-stage validation for flows such as `develop`, `nightly`, `beta`, `staging`, and `production`.
- `promote-branches.yml`: exact tested SHA branch promotion with `--force-with-lease`.

`validate-repo.yml` remains available as the `scaffold-v2-initial` compatibility workflow for existing callers.

## Common Inputs

Most validation workflows accept:

- `working_directory`
- `node_version`
- `bun_version`
- `install_command`
- `pre_command` or the legacy `pre_validate_command`
- stage-specific command inputs
- `post_command` or the legacy `post_validate_command`
- `timeout_minutes`
- `cache_bun`
- `cache_node`
- `cache_cargo`
- `install_playwright`
- `install_xvfb`
- `artifact_paths`
- `concurrency_group`
- `cancel_in_progress`

## Common Secrets

Pass explicit secrets from caller workflows:

- `node_auth_token`
- `GH_PACKAGES_TOKEN`
- `GH_PROMOTION_TOKEN` as `promotion_token` for `promote-branches.yml`
- release-specific tokens such as `NPM_TOKEN` or `release_token` only in release workflows

Avoid `secrets: inherit`.

## Project Defaults

Web apps and templates should use `fast-validation` on PRs, add `integration-validation` where service or database checks matter, run `e2e-validation` on PRs for UI-heavy apps or on default/staging branches for smaller sites, run `performance-validation` through schedules or manual dispatch, and use `deploy-pages` only for Pages deployment.

UI libraries and component packages should use `fast-validation` and `storybook-validation` on PRs, then browser/visual/performance checks on PRs or schedules depending on stability.

Desktop, Tauri, and Electron projects should run fast validation on PRs, keep slower desktop e2e on default/beta/staging branches, and reserve signed release builds for tags or manual release workflows.

Rust or mixed Rust projects should keep domain-specific Rust checks, use `cache_cargo`, and run benchmarks through scheduled or manual performance workflows.

Static sites and simple projects should keep PR validation small, usually build-only plus lint/test when present, and run Pages deployment separately from validation.

## How to use it

Consume workflows from downstream repos with pinned `uses:` references:

```yaml
jobs:
  fast-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/fast-validation.yml@workflow-standard-v1
    with:
      lint_command: bun run lint
      typecheck_command: bun run check-types
      build_command: bun run build
      unit_test_command: bun run test:unit
    secrets:
      GH_PACKAGES_TOKEN: ${{ secrets.GH_PACKAGES_TOKEN }}
```

Let Dependabot update reusable workflow refs instead of copying YAML bodies around.

## Release Tags

- `scaffold-v2-initial`: initial validation, release, and branch-promotion contract.
- `workflow-standard-v1`: staged validation, Pages deployment, release, and promotion contract.

See `SCAFFOLD_ALIGNMENT.md` for the maintained repo-family contract for this repository.
