# Reusable Workflows Reference

This repository owns shared GitHub Actions Workflow Contracts for Consumer Repositories in the maintained `moritzbrantner/*` family.

The repository also publishes a small React GitHub Pages reference app from `src/`.
That deployment intentionally calls the `deploy-pages.yml` Reusable Workflow. CI also runs the app through the validation, Storybook, Playwright, Unlighthouse, benchmark, bundle-size, Stage Validation, and Compatibility Workflow paths so this repository dogfoods most of the Workflow Contract surface.

Target release tag: `workflow-standard-v1.3`.

For step-by-step consumer setup, see [IMPLEMENTING_WORKFLOWS.md](IMPLEMENTING_WORKFLOWS.md).

The published reference app includes an Adoption Tool at `/adoption` that generates starter Caller
Workflow YAML for common Adoption Profiles and audits pasted workflow YAML for Adoption Diagnostics.
The same checks can run locally with `bun run adoption:check`; use
`bun run adoption:check:strict` when warnings should fail CI.

## Workflow Standard

Use smaller Reusable Workflows by Lifecycle Step instead of one oversized workflow:

- `fast-validation.yml`: PR/default-branch linting, formatting checks, typechecking, build, and unit tests.
- `integration-validation.yml`: integration tests, service/database checks, migration checks, and package/API checks.
- `e2e-validation.yml`: Playwright, browser, Electron, Tauri, or mobile e2e tests with artifacts.
- `storybook-validation.yml`: Storybook build, interaction tests, accessibility checks, and visual checks where present.
- `link-validation.yml`: local or deployed site crawling for broken links, assets, and fragment anchors.
- `performance-validation.yml`: Unlighthouse, benchmarks, bundle-size checks, API reports, and heavier performance suites.
- `deploy-pages.yml`: GitHub Pages build and deployment only.
- `external-pull.yml`: external server notification for pulling the current repo ref/SHA.
- `package-publish.yml`: npm-compatible registry and Cargo/crates.io package publishing only.
- `release-template.yml`: custom app releases or nonstandard release flows only.
- `stage-validation.yml`: branch-stage validation for flows such as `develop`, `nightly`, `beta`, `staging`, and `production`.
- `promote-branches.yml`: exact tested SHA branch promotion with `--force-with-lease`.
- `validate-repo.yml`: `scaffold-v2-initial` Compatibility Workflow for existing callers.

## Versioning And Tags

Published workflow tags are treated as immutable Release Tags. Do not move them after publishing. Additive fixes should ship as a new patch-style tag such as `workflow-standard-v1.3`; breaking input, secret, output, default, or documented behavior changes require a new major Workflow Standard such as `workflow-standard-v2`.

The repo may contain commits after a published tag. Those commits do not affect consumers until a new tag is created and adopted.

Release checklist:

1. Update workflow YAML.
2. Update the Contract Manifest in `contracts/workflows.json`.
3. Update `README.md`, `SCAFFOLD_ALIGNMENT.md`, and the scaffold reference in `monorepo/REUSABLE_WORKFLOWS.md` when scaffold expectations change.
4. Run `bun run validate:contracts`.
5. Run `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12 -color .github/workflows/*.yml`.
6. Confirm `Smoke Reusable Workflows` and `Deploy Docs Pages` pass.
7. Create a new tag and roll it out to consumers through normal PRs.

## Contract Validation

The Contract Manifest lives in `contracts/workflows.json`.

CI runs `scripts/validate-workflow-contracts.ts` to verify:

- Reusable Workflow inputs, secrets, outputs, and job permissions match the Contract Manifest
- `README.md` and `SCAFFOLD_ALIGNMENT.md` document every Reusable Workflow
- the sibling `monorepo/REUSABLE_WORKFLOWS.md` reference is current when that repo is checked out next to this one

## CI Behavior

This repository optimizes CI for fast PR feedback and lower GitHub Actions minutes.
`Validate` runs on pull requests, manual dispatch, and pushes to `main`; feature-branch pushes do not run `Validate` directly.

On ordinary pull requests, only Fast Validation and actionlint run by default.
Costlier validation jobs run after those fast checks pass when a PR has the matching label, when `Validate` is manually dispatched with the matching input, or when code lands on `main`.
Supported PR labels are:

- `ci:full`
- `ci:e2e`
- `ci:storybook`
- `ci:links`
- `ci:perf`

If branch protection or rulesets are enabled, require checks that always run on pull requests:

- `Validate / app-validation`
- `Validate / actionlint`

Do not require `Smoke Reusable Workflows` while it uses path filters.
GitHub leaves path-filtered required workflow checks pending when the workflow does not run.
Keep `Smoke Reusable Workflows` optional, remove its path filters, or add a separate always-running required status job before making it required.

The repository also ships `scripts/check-adoption.ts` for Consumer Repositories. It parses
`.github/workflows/*.yml`, detects calls to `moritzbrantner/reusable-workflows`, warns about moving
refs, inherited secrets, missing or weak job permissions, broad monorepo cache paths, and overly
broad artifact uploads, and exits nonzero only for errors unless `--strict` is passed.

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
- `install_playwright_browsers`
- `install_xvfb`
- `artifact_paths`
- `upload_artifacts_on`
- `artifact_retention_days`
- `artifact_name_suffix`
- `concurrency_group`
- `cancel_in_progress`

`upload_artifacts_on` accepts `failure`, `always`, or `never`. Use `artifact_name_suffix` with a leading separator, for example `-pr-${{ github.run_number }}`.
Validation workflows keep artifacts for 7 days by default; release and package workflows keep their 14-day default unless overridden.
Leave `concurrency_group` empty for reusable Pages deployments unless you need a custom group that is different from the caller workflow's top-level concurrency group.

Playwright-based workflows accept `install_playwright_browsers`, which is passed to `bunx playwright install --with-deps`. Leave it empty to keep Playwright's default behavior, or pass a browser such as `chromium` for faster browser-only jobs.

`package-publish.yml` also accepts `package_manager`, `publish_enabled`, `dry_run`, `publish_command`, npm-specific inputs such as `npm_registry_url`, `npm_scope`, `npm_access`, `npm_tag`, and `npm_provenance`, and Cargo-specific inputs such as `rust_toolchain`, `cargo_registry`, `cargo_package`, and `cargo_locked`. The publish step is skipped unless `publish_enabled` is true.

`performance-validation.yml` also accepts `summary_paths`, a newline-separated list of Markdown files or globs to append to the GitHub Actions run summary. Summaries are independent of uploaded artifacts; keep full raw reports in artifacts and concise human-readable benchmark or performance results in Markdown summaries.
Use `metrics_command` when a performance job should normalize build, bundle, benchmark, or Lighthouse outputs into a durable JSON artifact for dashboards or historical reports.

`link-validation.yml` accepts `start_command`, `link_check_url`, and `link_check_command`. When `start_command` is set, the workflow starts it in the background, waits for `link_check_url`, exposes `LINK_CHECK_URL` and `LINK_CHECK_BASE_URL` to the link-check command, and stops the background process during cleanup. Callers must pass `link_check_command`; the examples use `linkinator` to crawl the configured URL, check fragments, and skip non-local external URLs.

## Common Secrets

Most validation and deploy workflows do not need explicit secrets; they use `github.token` by default.
Pass explicit package auth only when the caller needs access that `github.token` cannot provide, such as cross-repo private GitHub Packages or a custom package registry:

- `node_auth_token`
- `GH_PACKAGES_TOKEN`
- `GH_PROMOTION_TOKEN` as `promotion_token` for `promote-branches.yml`
- `external_pull_url` and `external_pull_token` for `external-pull.yml`
- package publish tokens such as `NPM_TOKEN` or `CARGO_REGISTRY_TOKEN` only in package publish workflows
- release-specific tokens such as `NPM_TOKEN` or `release_token` only in release workflows

Avoid `secrets: inherit`.

## Common Outputs

- Validation workflows with artifacts expose `artifact_name`.
- `deploy-pages.yml` exposes `page_url`.
- `external-pull.yml` exposes `http_status`.
- `package-publish.yml` exposes `artifact_name` and `publish_status`.
- `release-template.yml` exposes `artifact_name` and `release_status`.

## Consumer Examples

### Fast Validation

```yaml
jobs:
  fast-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/fast-validation.yml@workflow-standard-v1.3
    with:
      lint_command: bun run lint
      typecheck_command: bun run check-types
      build_command: bun run build
      unit_test_command: bun run test:unit
      bun_cache_dependency_path: apps/web/bun.lock
```

### Integration Validation

```yaml
jobs:
  integration-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/integration-validation.yml@workflow-standard-v1.3
    with:
      integration_command: bun run test:integration
      migration_command: bun run db:check
      package_check_command: bun run pack:check
      artifact_paths: |
        coverage
        test-results
```

### E2E Validation

```yaml
jobs:
  e2e-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/e2e-validation.yml@workflow-standard-v1.3
    with:
      build_command: bun run build
      e2e_command: bun run test:e2e
      install_playwright: true
      install_playwright_browsers: chromium
      upload_artifacts_on: always
```

### Storybook Validation

```yaml
jobs:
  storybook-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/storybook-validation.yml@workflow-standard-v1.3
    with:
      storybook_build_command: bun run build-storybook
      storybook_test_command: bun run test-storybook
      accessibility_command: bun run a11y
      visual_command: bun run visual
      upload_artifacts_on: always
```

### Performance Validation

```yaml
jobs:
  performance-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/performance-validation.yml@workflow-standard-v1.3
    with:
      build_command: bun run build
      unlighthouse_command: bun run unlighthouse
      benchmark_command: bun run bench
      bundle_size_command: bun run size
      api_report_command: bun run api-report
      metrics_command: bun run write-metrics
      install_playwright: true
      install_playwright_browsers: chromium
      summary_paths: |
        benchmark-results/*.md
      upload_artifacts_on: always
```

### Link Validation

```yaml
jobs:
  link-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/link-validation.yml@workflow-standard-v1.3
    with:
      build_command: bun run build
      start_command: bun run preview -- --host 127.0.0.1 --port 4173
      link_check_url: http://127.0.0.1:4173
      link_check_command: >
        bunx linkinator "$LINK_CHECK_URL" --recurse --check-fragments
        --skip "^mailto:" --skip "^tel:"
      upload_artifacts_on: failure
```

### Deploy Pages

```yaml
jobs:
  deploy-pages:
    permissions:
      actions: read
      contents: read
      pages: write
      id-token: write
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/deploy-pages.yml@workflow-standard-v1.3
    with:
      build_command: bun run build
```

### External Pull

```yaml
name: Trigger External Pull

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  external-pull:
    permissions:
      contents: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/external-pull.yml@workflow-standard-v1.3
    secrets:
      external_pull_url: ${{ secrets.EXTERNAL_PULL_URL }}
      external_pull_token: ${{ secrets.EXTERNAL_PULL_TOKEN }}
```

### Stage Validation

```yaml
jobs:
  stage-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/stage-validation.yml@workflow-standard-v1.3
    with:
      stage: staging
      staging_command: bun run test:staging
      install_playwright: true
      install_playwright_browsers: chromium
      upload_artifacts_on: always
```

`stage` must be one of `develop`, `nightly`, `beta`, `staging`, or `production`. The selected stage command is required unless `allow_empty_stage_command` is true.

### Promote Branches

```yaml
jobs:
  promote:
    permissions:
      contents: write
    uses: moritzbrantner/reusable-workflows/.github/workflows/promote-branches.yml@workflow-standard-v1.3
    with:
      source_branch: staging
      target_branch: production
      tested_sha: ${{ needs.stage-validation.outputs.tested_sha }}
    secrets:
      promotion_token: ${{ secrets.GH_PROMOTION_TOKEN }}
```

`tested_sha` must resolve to a commit reachable from `source_branch`, and `target_branch` must not contain commits outside that tested commit.

Use `package-publish.yml` for standard npm and Cargo package publication. Keep `release-template.yml` for custom app releases, signed desktop releases, GitHub Releases, or package flows that need repository-specific release commands.

### Package Publish npm

```yaml
jobs:
  publish:
    permissions:
      contents: read
      packages: write
      id-token: write
    uses: moritzbrantner/reusable-workflows/.github/workflows/package-publish.yml@workflow-standard-v1.3
    with:
      package_manager: npm
      publish_enabled: true
      validate_command: bun run check-types && bun run test
      build_command: bun run build
      npm_access: public
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Package Publish Cargo

```yaml
jobs:
  publish:
    permissions:
      contents: read
      packages: write
      id-token: write
    uses: moritzbrantner/reusable-workflows/.github/workflows/package-publish.yml@workflow-standard-v1.3
    with:
      package_manager: cargo
      publish_enabled: true
      validate_command: cargo test --locked
      build_command: cargo package --locked
      cargo_package: my-crate
    secrets:
      CARGO_REGISTRY_TOKEN: ${{ secrets.CARGO_REGISTRY_TOKEN }}
```

### Release Template

```yaml
jobs:
  release:
    permissions:
      contents: write
      packages: write
      id-token: write
    uses: moritzbrantner/reusable-workflows/.github/workflows/release-template.yml@workflow-standard-v1.3
    with:
      release_type: app
      validate_command: bun run check-types && bun run build
      build_command: bun run build
      release_command: bun run release
      artifact_paths: dist
    secrets:
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
    uses: moritzbrantner/reusable-workflows/.github/workflows/validate-repo.yml@workflow-standard-v1.3
    with:
      lint_command: bun run lint
      typecheck_command: bun run check-types
      test_command: bun run test
      build_command: bun run build
```

Prefer the staged workflows for new consumers. Keep `validate-repo.yml` for compatibility with existing scaffold-v2 callers.

## Project Defaults

Web apps and templates should use `fast-validation` on PRs, add `integration-validation` where service or database checks matter, run `link-validation` on PRs or default-branch pushes for site routes and anchors, run `e2e-validation` on PRs for UI-heavy apps or on default/staging branches for smaller sites, run `performance-validation` through schedules or manual dispatch, and use `deploy-pages` only for Pages deployment.

UI libraries and component packages should use `fast-validation` and `storybook-validation` on PRs, then browser/visual/performance checks on PRs or schedules depending on stability.

Desktop, Tauri, and Electron projects should run fast validation on PRs, keep slower desktop e2e on default/beta/staging branches, and reserve signed release builds for tags or manual release workflows.

Rust or mixed Rust projects should keep domain-specific Rust checks, use `cache_cargo`, and run benchmarks through scheduled or manual performance workflows.

Packages should use `package-publish.yml` for ordinary npm or Cargo publication, with `publish_enabled` set only in tag, release, or manual publish callers.

Static sites and simple projects should keep PR validation small, usually build-only plus lint/test when present, and run Pages deployment separately from validation.

## Release Tags

- `scaffold-v2-initial`: initial validation, release, and branch-promotion contract.
- `scaffold-v2-validated`: validation workflow documentation and actionlint coverage.
- `scaffold-v2-release-auth`: release token fallback update.
- `workflow-standard-v1`: staged validation, Pages deployment, release, and promotion contract.
- `workflow-standard-v1.1`: additive link-validation workflow contract.
- `workflow-standard-v1.2`: additive package-publish workflow contract for npm and Cargo publication.
- `workflow-standard-v1.3`: additive Playwright browser selection and shorter validation artifact retention defaults.

See `SCAFFOLD_ALIGNMENT.md` for how this repository's Workflow Contracts align with the sibling Scaffold Contract.
