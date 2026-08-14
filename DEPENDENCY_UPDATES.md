# Dependency update qualification

Dependency automation has two replaceable layers:

1. Dependabot or Renovate detects and proposes a version change.
2. Consumer Repository workflows qualify the proposed change with repository-owned evidence.

The updater never defines completion. Required status checks, tests, audits, and stable benchmark
comparisons do.

## Current rollout state

This repository currently uses Dependabot for GitHub Actions updates. Keep it active until Renovate
is installed and processes an explicit repository configuration.

When switching a Consumer Repository to Renovate:

1. Install the hosted Renovate app for that repository or configure the self-hosted runner.
2. Add `renovate.json` extending `github>moritzbrantner/reusable-workflows`.
3. Confirm the Renovate onboarding or reconfiguration pull request resolves the preset.
4. Disable Dependabot version-update pull requests for the ecosystems Renovate will own.
5. Keep GitHub dependency alerts and repository security review enabled where available.
6. Require the ordinary fast validation check and the applicable dependency-update qualification
   check before enabling any automerge preset.

Do not let Dependabot and Renovate create version-update pull requests for the same ecosystem.

## Renovate Consumer Repository configuration

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github>moritzbrantner/reusable-workflows"]
}
```

The root [`default.json`](default.json) is the conservative shared preset. It groups GitHub Actions
and non-major development dependency updates, routes majors through Dependency Dashboard approval,
and does not automerge.

After a repository has stable required checks, it may explicitly opt into aged patch automerge for
development dependencies:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>moritzbrantner/reusable-workflows",
    "github>moritzbrantner/reusable-workflows:automerge-safe"
  ]
}
```

The opt-in preset waits 14 days and still relies on required status checks. Runtime dependencies,
minor updates, majors, and security-sensitive migrations remain reviewable by default.

## Qualification tier

Private Consumer Repositories can declare:

```json
{
  "schemaVersion": 1,
  "tiers": {
    "dependency-update": [
      "format:check",
      "lint",
      "typecheck",
      "build",
      "test:unit",
      "test:integration",
      "test:e2e",
      "dependencies:audit",
      "benchmark:smoke"
    ]
  },
  "requiredCapabilities": ["lint", "typecheck", "test:unit", "build"],
  "optionalCapabilities": ["test:integration", "test:e2e", "dependencies:audit", "benchmark:smoke"],
  "conventionRefs": ["CI-001", "CI-003", "TEST-002"]
}
```

The private Caller Workflow is documented in
[`PRIVATE_CODING_TOOLING.md`](PRIVATE_CODING_TOOLING.md). Public repositories should express the
same semantic stages with the public command-driven Lifecycle Workflows.

## Benchmark evidence

A dependency benchmark is useful only when it compares the base and candidate under controlled
conditions. The Consumer Repository owns:

- the fixture or workload,
- base and candidate revisions,
- runtime and hardware metadata,
- repetitions and aggregation,
- warning and failure thresholds,
- concise Markdown summary,
- raw machine-readable result artifact.

Start new metrics as non-blocking warnings. Make a metric required only after its normal variance is
known. A failed benchmark is deterministic evidence for review or agent-assisted diagnosis; the
updater should not rewrite application code.

## Merge policy

- Development patch: eligible for opt-in automerge after required checks and release-age delay.
- Development minor: grouped and reviewed until evidence supports a narrower policy.
- Runtime patch or minor: full repository qualification and review by default.
- Major: Dependency Dashboard approval, changelog review, and migration work where needed.
- Security update: expedited review may shorten a cooldown, but any waived gate must be explicit and
  auditable.

Coding agents enter after a check identifies a concrete incompatibility, migration, or performance
regression. They do not decide that an unverified dependency pull request is safe.
