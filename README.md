# Reusable Workflows Reference

This repository owns shared GitHub Actions workflow contracts for maintained `moritzbrantner/*` repositories.

The repository also publishes a small React GitHub Pages reference app from `src/`.
That deployment intentionally calls the local `deploy-pages.yml` reusable workflow. CI also runs the app through the staged validation workflows, Storybook, Playwright, Unlighthouse, benchmark, bundle-size, stage, and compatibility paths so this repository dogfoods most of the workflow contract surface.

Target release tag: `workflow-standard-v1`.

## Workflow Standard

Use staged reusable workflows instead of one oversized workflow:

- `fast-validation.yml`: PR/default-branch linting, formatting checks, typechecking, build, and unit tests.
- `integration-validation.yml`: integration tests, service/database checks, migration checks, and package/API checks.
- `e2e-validation.yml`: Playwright, browser, Electron, Tauri, or mobile e2e tests with artifacts.
- `storybook-validation.yml`: Storybook build, interaction tests, accessibility checks, and visual checks where present.
- `performance-validation.yml`: Unlighthouse, benchmarks, bundle-size checks, API reports, and heavier performance suites.
- `deploy-pages.yml`: GitHub Pages build and deployment only.
- `release-template.yml`: package or app release only.
- `stage-validation.yml`: branch-stage validation for flows such as `develop`, `nightly`, `beta`, `staging`, and `production`.
- `promote-branches.yml`: exact tested SHA branch promotion with `--force-with-lease`.
- `validate-repo.yml`: `scaffold-v2-initial` compatibility workflow for existing callers.

## Versioning And Tags

`workflow-standard-v1` is treated as an immutable release tag. Do not move it after publishing. Additive fixes should ship as a new patch-style tag such as `workflow-standard-v1.1`; breaking input, secret, output, default, or behavior changes require `workflow-standard-v2`.

The repo may contain commits after a published tag. Those commits do not affect consumers until a new tag is created and adopted.

Release checklist:

1. Update workflow YAML.
2. Update `contracts/workflows.json`.
3. Update `README.md`, `SCAFFOLD_ALIGNMENT.md`, and the canonical `monorepo/REUSABLE_WORKFLOWS.md` reference.
4. Run `bun run validate:contracts`.
5. Run `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12 -color .github/workflows/*.yml`.
6. Confirm `Smoke Reusable Workflows` and `Deploy Docs Pages` pass.
7. Create a new tag and roll it out to consumers through normal PRs.

## Contract Validation

The machine-readable workflow contract lives in `contracts/workflows.json`.

CI runs `scripts/validate-workflow-contracts.ts` to verify:

- reusable workflow inputs, secrets, outputs, and job permissions match the contract file
- `README.md` and `SCAFFOLD_ALIGNMENT.md` document every reusable workflow
- the sibling `monorepo/REUSABLE_WORKFLOWS.md` reference is current when that repo is checked out next to this one

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
- `bun_cache_dependency_path`
- `npm_cache_dependency_path`
- `cargo_cache_dependency_path`
- `install_playwright`
- `install_xvfb`
- `artifact_paths`
- `upload_artifacts_on`
- `artifact_retention_days`
- `artifact_name_suffix`
- `concurrency_group`
- `cancel_in_progress`

`upload_artifacts_on` accepts `failure`, `always`, or `never`. Use `artifact_name_suffix` with a leading separator, for example `-pr-${{ github.run_number }}`.
Leave `concurrency_group` empty for reusable Pages deployments unless you need a custom group that is different from the caller workflow's top-level concurrency group.

## Common Secrets

Pass explicit secrets from caller workflows:

- `node_auth_token`
- `GH_PACKAGES_TOKEN`
- `GH_PROMOTION_TOKEN` as `promotion_token` for `promote-branches.yml`
- release-specific tokens such as `NPM_TOKEN` or `release_token` only in release workflows

Avoid `secrets: inherit`.

## Common Outputs

- Validation workflows with artifacts expose `artifact_name`.
- `deploy-pages.yml` exposes `page_url`.
- `release-template.yml` exposes `artifact_name` and `release_status`.

## Consumer Examples

### Fast Validation

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
      bun_cache_dependency_path: apps/web/bun.lock
    secrets:
      GH_PACKAGES_TOKEN: ${{ secrets.GH_PACKAGES_TOKEN }}
```

### Integration Validation

```yaml
jobs:
  integration-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/integration-validation.yml@workflow-standard-v1
    with:
      integration_command: bun run test:integration
      migration_command: bun run db:check
      package_check_command: bun run pack:check
      artifact_paths: |
        coverage
        test-results
    secrets:
      GH_PACKAGES_TOKEN: ${{ secrets.GH_PACKAGES_TOKEN }}
```

### E2E Validation

```yaml
jobs:
  e2e-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/e2e-validation.yml@workflow-standard-v1
    with:
      build_command: bun run build
      e2e_command: bun run test:e2e
      install_playwright: true
      upload_artifacts_on: always
    secrets:
      GH_PACKAGES_TOKEN: ${{ secrets.GH_PACKAGES_TOKEN }}
```

### Storybook Validation

```yaml
jobs:
  storybook-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/storybook-validation.yml@workflow-standard-v1
    with:
      storybook_build_command: bun run build-storybook
      storybook_test_command: bun run test-storybook
      accessibility_command: bun run a11y
      visual_command: bun run visual
      upload_artifacts_on: always
    secrets:
      GH_PACKAGES_TOKEN: ${{ secrets.GH_PACKAGES_TOKEN }}
```

### Performance Validation

```yaml
jobs:
  performance-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/performance-validation.yml@workflow-standard-v1
    with:
      build_command: bun run build
      unlighthouse_command: bun run unlighthouse
      benchmark_command: bun run bench
      bundle_size_command: bun run size
      api_report_command: bun run api-report
      upload_artifacts_on: always
    secrets:
      GH_PACKAGES_TOKEN: ${{ secrets.GH_PACKAGES_TOKEN }}
```

### Deploy Pages

```yaml
jobs:
  deploy-pages:
    permissions:
      contents: read
      pages: write
      id-token: write
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/deploy-pages.yml@workflow-standard-v1
    with:
      build_command: bun run build
      artifact_path: dist
    secrets:
      GH_PACKAGES_TOKEN: ${{ secrets.GH_PACKAGES_TOKEN }}
```

### Stage Validation

```yaml
jobs:
  stage-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/stage-validation.yml@workflow-standard-v1
    with:
      stage: staging
      staging_command: bun run test:staging
      install_playwright: true
      upload_artifacts_on: always
    secrets:
      GH_PACKAGES_TOKEN: ${{ secrets.GH_PACKAGES_TOKEN }}
```

`stage` must be one of `develop`, `nightly`, `beta`, `staging`, or `production`. The selected stage command is required unless `allow_empty_stage_command` is true.

### Promote Branches

```yaml
jobs:
  promote:
    permissions:
      contents: write
    uses: moritzbrantner/reusable-workflows/.github/workflows/promote-branches.yml@workflow-standard-v1
    with:
      source_branch: staging
      target_branch: production
      tested_sha: ${{ needs.stage-validation.outputs.tested_sha }}
    secrets:
      promotion_token: ${{ secrets.GH_PROMOTION_TOKEN }}
```

`tested_sha` must resolve to a commit reachable from `source_branch`, and `target_branch` must not contain commits outside that tested commit.

### Release Template

```yaml
jobs:
  release:
    permissions:
      contents: write
      packages: write
      id-token: write
    uses: moritzbrantner/reusable-workflows/.github/workflows/release-template.yml@workflow-standard-v1
    with:
      release_type: npm
      validate_command: bun run check-types && bun run build
      build_command: bun run build
      release_command: bun publish
      artifact_paths: dist
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
      GH_PACKAGES_TOKEN: ${{ secrets.GH_PACKAGES_TOKEN }}
      release_token: ${{ secrets.GITHUB_TOKEN }}
```

### Validate Repo Compatibility

```yaml
jobs:
  validate:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/validate-repo.yml@workflow-standard-v1
    with:
      lint_command: bun run lint
      typecheck_command: bun run check-types
      test_command: bun run test
      build_command: bun run build
    secrets:
      GH_PACKAGES_TOKEN: ${{ secrets.GH_PACKAGES_TOKEN }}
```

Prefer the staged workflows for new consumers. Keep `validate-repo.yml` for compatibility with existing scaffold-v2 callers.

## Project Defaults

Web apps and templates should use `fast-validation` on PRs, add `integration-validation` where service or database checks matter, run `e2e-validation` on PRs for UI-heavy apps or on default/staging branches for smaller sites, run `performance-validation` through schedules or manual dispatch, and use `deploy-pages` only for Pages deployment.

UI libraries and component packages should use `fast-validation` and `storybook-validation` on PRs, then browser/visual/performance checks on PRs or schedules depending on stability.

Desktop, Tauri, and Electron projects should run fast validation on PRs, keep slower desktop e2e on default/beta/staging branches, and reserve signed release builds for tags or manual release workflows.

Rust or mixed Rust projects should keep domain-specific Rust checks, use `cache_cargo`, and run benchmarks through scheduled or manual performance workflows.

Static sites and simple projects should keep PR validation small, usually build-only plus lint/test when present, and run Pages deployment separately from validation.

## Release Tags

- `scaffold-v2-initial`: initial validation, release, and branch-promotion contract.
- `scaffold-v2-validated`: validation workflow documentation and actionlint coverage.
- `scaffold-v2-release-auth`: release token fallback update.
- `workflow-standard-v1`: staged validation, Pages deployment, release, and promotion contract.

See `SCAFFOLD_ALIGNMENT.md` for the maintained repo-family contract for this repository.
