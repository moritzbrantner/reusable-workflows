# Implementing The Reusable Workflows

This guide explains how to adopt the reusable workflows from this repository in a consuming project.
Use `README.md` as the contract reference; use this file as the implementation path.

Current stable workflow ref: `workflow-standard-v1.3`.

## 1. Choose The Workflow Split

Start with the smallest workflow set that matches the project.

- Use `fast-validation.yml` on every pull request and default-branch push.
- Add `integration-validation.yml` when the project has service, database, migration, package, or API checks.
- Add `e2e-validation.yml` when user flows need browser, desktop, mobile, Electron, Tauri, or Playwright coverage.
- Add `storybook-validation.yml` for component libraries and apps with Storybook-backed interaction, accessibility, or visual checks.
- Add `link-validation.yml` for static sites, docs, routed web apps, and Pages deployments.
- Add `performance-validation.yml` for slower checks such as Lighthouse, benchmarks, bundle size, and API reports.
- Use `deploy-pages.yml` only for GitHub Pages deployment.
- Use `external-pull.yml` only when a push should notify an external deployment host.
- Use `stage-validation.yml` for branch-stage checks such as `develop`, `nightly`, `beta`, `staging`, and `production`.
- Use `promote-branches.yml` only to promote an exact tested SHA between maintained branches.
- Use `package-publish.yml` for ordinary npm-compatible registry or Cargo publication.
- Use `release-template.yml` for custom app releases or release flows that need repository-specific commands.
- Keep `validate-repo.yml` only for existing scaffold-v2 callers that still need the older combined validation surface.

Do not combine validation, deployment, publishing, and branch promotion in one caller workflow. Keep each lifecycle step in a separate job or file so each job can use the narrowest permissions and secrets.

## 2. Pin The Reusable Workflow Ref

Call workflows with a release tag, not a moving branch:

```yaml
uses: moritzbrantner/reusable-workflows/.github/workflows/fast-validation.yml@workflow-standard-v1.3
```

Update consumers to a newer tag through normal pull requests. Do not point production repositories at `main`.

## 3. Use The Adoption Tool

Use the reference app's `/adoption` page to generate starter caller workflows for common repository
profiles such as web apps, monorepo web apps, component libraries, packages, and Pages sites.
The generator emits complete workflow files with pinned refs, job-level permissions, and explicit
secrets.

To audit an existing consuming repository from the command line, run this repository's checker with
the consumer repo as the root:

```sh
bun scripts/check-adoption.ts --root ../consumer-repo
```

The checker warns by default for migration issues such as `@main` refs, `secrets: inherit`, missing
or weak job permissions, broad monorepo cache paths, and artifact uploads set to `always` outside
the workflows where that is usually intentional. Use strict mode when warnings should fail CI:

```sh
bun scripts/check-adoption.ts --root ../consumer-repo --strict
```

## 4. Configure Repository Permissions

Set default workflow permissions to read-only in the consuming repository when possible.
Then grant job-level permissions for each reusable workflow caller.

Validation jobs usually need:

```yaml
permissions:
  contents: read
  packages: read
```

GitHub Pages deployment needs:

```yaml
permissions:
  actions: read
  contents: read
  pages: write
  id-token: write
  packages: read
```

Package publishing needs:

```yaml
permissions:
  contents: read
  packages: write
  id-token: write
```

Branch promotion needs:

```yaml
permissions:
  contents: write
```

## 5. Pass Secrets Explicitly

Avoid `secrets: inherit`. Pass only the secrets required by that job.

Common cases:

- Use no explicit secrets for normal validation when `github.token` can read dependencies.
- Pass `GH_PACKAGES_TOKEN` or `node_auth_token` only for private package access that `github.token` cannot read.
- Pass `NPM_TOKEN` only to npm publishing jobs.
- Pass `CARGO_REGISTRY_TOKEN` only to Cargo publishing jobs.
- Pass `promotion_token` from `GH_PROMOTION_TOKEN` only to branch promotion jobs.
- Pass `external_pull_url` and `external_pull_token` only to external pull jobs.
- Pass `release_token` only when the release command needs a token different from the default GitHub token.

## 6. Use Project-Local Commands

Reusable workflows run the commands you provide from `working_directory`, which defaults to `.`.
Use the commands that already work locally in the consuming project.

For a Bun web app, a typical fast validation job is:

```yaml
jobs:
  fast-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/fast-validation.yml@workflow-standard-v1.3
    with:
      bun_version: "1.3.14"
      install_command: bun install --frozen-lockfile
      format_command: bun run format:check
      lint_command: bun run lint
      typecheck_command: bun run check-types
      build_command: bun run build
      unit_test_command: bun run test:unit
```

For a package inside a monorepo, scope the working directory and cache path:

```yaml
jobs:
  fast-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/fast-validation.yml@workflow-standard-v1.3
    with:
      working_directory: apps/web
      install_command: bun install --frozen-lockfile
      lint_command: bun run lint
      typecheck_command: bun run check-types
      build_command: bun run build
      unit_test_command: bun run test:unit
      bun_cache_dependency_path: apps/web/bun.lock
```

## 7. Add A Practical Pull Request Caller

A web app with unit, link, and e2e coverage can start with this `.github/workflows/validate.yml`:

```yaml
name: Validate

on:
  pull_request:
  push:
    branches:
      - main

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  fast-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/fast-validation.yml@workflow-standard-v1.3
    with:
      install_command: bun install --frozen-lockfile
      format_command: bun run format:check
      lint_command: bun run lint
      typecheck_command: bun run check-types
      build_command: bun run build
      unit_test_command: bun run test:unit

  link-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/link-validation.yml@workflow-standard-v1.3
    with:
      build_command: bun run build
      start_command: bun run preview -- --host 127.0.0.1 --port 4173
      link_check_url: http://127.0.0.1:4173
      upload_artifacts_on: failure

  e2e-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/e2e-validation.yml@workflow-standard-v1.3
    with:
      build_command: bun run build
      e2e_command: bunx playwright test
      install_playwright: true
      install_playwright_browsers: chromium
      upload_artifacts_on: always
```

Use `needs:` only when a job depends on another job's completion or output. Independent validation jobs should fan out in parallel.

## 8. Add Pages Deployment Separately

Keep Pages deployment out of pull request validation.
Create a separate `.github/workflows/deploy-pages.yml` caller:

```yaml
name: Deploy Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

concurrency:
  group: pages-${{ github.ref }}
  cancel-in-progress: false

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
      install_command: bun install --frozen-lockfile
      build_command: bun run build
      artifact_path: dist
```

The reusable workflow exposes `page_url` if a downstream job needs the deployed URL:

```yaml
needs: deploy-pages
```

Then read:

```yaml
${{ needs.deploy-pages.outputs.page_url }}
```

## 9. Add External Pull Only For Pull-Based Hosts

Use `external-pull.yml` when an external server receives a webhook-like request and pulls the current ref itself.
Configure these repository secrets in the consumer:

- `EXTERNAL_PULL_URL`
- `EXTERNAL_PULL_TOKEN`

Caller:

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

The endpoint receives JSON with repository, owner, repository URL, ref, ref name, SHA, workflow, run ID, run attempt, run URL, actor, and event name.
It must return a `2xx` status. Any non-`2xx` response fails the job.

## 10. Add Performance Checks Deliberately

Performance checks are useful but often slower and noisier than fast validation.
Run them on schedules, manual dispatch, default-branch pushes, or selected pull requests.

```yaml
name: Performance

on:
  workflow_dispatch:
  schedule:
    - cron: "18 3 * * 1"

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
      metrics_command: bun run write-metrics
      install_playwright: true
      install_playwright_browsers: chromium
      summary_paths: |
        benchmark-results/*.md
      upload_artifacts_on: always
```

Use `summary_paths` for concise Markdown summaries. Keep full raw reports in `artifact_paths`.

## 11. Publish Packages From Tags Or Manual Dispatch

Keep `publish_enabled` false in dry runs and validation-only calls.
Set it to true only in tag, release, or manual publish workflows.

npm example:

```yaml
name: Publish npm Package

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:

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
      install_command: npm ci
      validate_command: npm test
      build_command: npm run build
      npm_access: public
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Cargo example:

```yaml
name: Publish Cargo Package

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:

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

## 12. Use Stage Validation And Promotion Together

For staged branches, validate the source branch first, then promote the exact tested SHA.

```yaml
name: Promote Staging To Production

on:
  workflow_dispatch:
    inputs:
      tested_sha:
        description: Tested commit SHA from staging
        required: true

jobs:
  stage-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/stage-validation.yml@workflow-standard-v1.3
    with:
      stage: staging
      staging_command: bun run test:staging
      upload_artifacts_on: always

  promote:
    needs: stage-validation
    permissions:
      contents: write
    uses: moritzbrantner/reusable-workflows/.github/workflows/promote-branches.yml@workflow-standard-v1.3
    with:
      source_branch: staging
      target_branch: production
      tested_sha: ${{ inputs.tested_sha }}
    secrets:
      promotion_token: ${{ secrets.GH_PROMOTION_TOKEN }}
```

`tested_sha` must be reachable from `source_branch`, and `target_branch` must not contain commits outside that tested commit.

## 13. Validate The Consumer Setup

Before merging a consumer implementation:

1. Run the project commands locally.
2. Confirm each caller job has job-level `permissions`.
3. Confirm the workflow uses `@workflow-standard-v1.3`.
4. Confirm no caller uses `secrets: inherit`.
5. Confirm private package tokens are passed only where needed.
6. Confirm `working_directory` and cache dependency paths match monorepo layout.
7. Run actionlint against the consumer workflows.
8. Open a pull request and verify artifacts upload only according to `upload_artifacts_on`.

## Common Mistakes

- Calling reusable workflows from a step. Reusable workflows must be called at the job level with `jobs.<job_id>.uses`.
- Using `main` instead of a release tag. Pin to `workflow-standard-v1.3`.
- Passing every secret to every job. Pass only the explicit secrets required by the selected workflow.
- Running publish or release jobs on pull requests. Keep publishing behind tags, releases, or manual dispatch.
- Forgetting `pages: write` and `id-token: write` for Pages deployment.
- Forgetting `contents: write` and a promotion token for `promote-branches.yml`.
- Setting `working_directory` without also adjusting cache dependency paths in monorepos.
- Uploading large artifacts on every PR by default. Prefer `failure` unless the artifact is intentionally reviewed.
