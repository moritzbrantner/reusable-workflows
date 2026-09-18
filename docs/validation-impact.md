# Validation impact

`validation-impact.yml` is an optional hosted adapter for deciding which **consumer-owned validation units** a change can invalidate.

It does not decide what linting, testing, benchmarking, or release policy means. The consumer repository owns those semantics in a small manifest; this repository only compares exact revisions, resolves the declared dependency closure, and transports the result.

## Manifest

By default the workflow reads `.github/validation-impact.json` from the requested head revision.

```json
{
  "schemaVersion": 1,
  "globalInputs": ["package.json", "bun.lock"],
  "ignoredInputs": ["docs/**", "**/*.md"],
  "units": {
    "core": {
      "inputs": ["src/core/**"]
    },
    "ui": {
      "inputs": ["src/ui/**"],
      "dependsOn": ["core"]
    },
    "e2e": {
      "inputs": ["tests/e2e/**", "playwright.config.ts"],
      "dependsOn": ["ui"]
    }
  }
}
```

Each unit declares repository-relative input globs and optional dependencies on other validation units.

- A direct input change invalidates that unit.
- If an invalidated unit is a dependency of another unit, invalidation propagates through the dependency closure.
- `globalInputs` select the full validation path.
- `ignoredInputs` are explicitly declared as not invalidating validation units.
- Any changed file matching none of those categories fails closed to the full validation path.
- A change to the impact manifest itself also selects full validation.
- Malformed manifests, unknown dependencies, dependency cycles, unavailable revisions, or a non-exact head checkout fail closed.

Supported globs are deliberately small and deterministic: literals, `*`, `**`, and `?`. Patterns are repository-relative and use `/` separators.

## Caller

Pin the reusable workflow to an immutable commit.

```yaml
jobs:
  impact:
    uses: moritzbrantner/reusable-workflows/.github/workflows/validation-impact.yml@<immutable-commit>
    permissions:
      contents: read
    with:
      base_sha: ${{ github.event.pull_request.base.sha }}
      head_sha: ${{ github.event.pull_request.head.sha }}

  impacted-tests:
    needs: impact
    if: ${{ needs.impact.outputs.full_validation == 'true' || contains(fromJSON(needs.impact.outputs.invalidated_units_json), 'tests') }}
    uses: ./.github/workflows/tests.yml
```

The workflow exposes:

- `changed_files_json`
- `invalidated_units_json`
- `reusable_units_json`
- `full_validation`
- `plan_digest`
- `plan_path`

The JSON arrays are sorted and stable so callers can use them in conditions or dynamic matrices.

## Intended validation lifecycle

Impact planning is for iterative PR validation. It complements rather than replaces stronger boundaries:

1. **PR iteration** — run only invalidated validation units.
2. **Integration / merge queue** — prove the exact integration candidate with the repository's required integration checks.
3. **Main / nightly / release** — run broad or exhaustive validation according to caller policy.

The next layer is evidence fingerprint reuse: a validation unit whose declared inputs and execution identity are unchanged can reuse a previous successful receipt rather than execute again. That is intentionally separate from this impact-planning slice.
