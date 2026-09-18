# Validation evidence reuse

`validation-evidence.yml` is an optional exact-source validation adapter for repositories that have already declared validation-unit input/dependency semantics in `.github/validation-impact.json`.

It does not infer which tests are equivalent or safe to reuse. The caller selects one declared validation unit and supplies the repository-owned validation command.

## Fingerprint

A reusable fingerprint is derived from:

- the selected validation unit and its dependency closure;
- top-level `globalInputs`;
- the exact tracked Git blob bytes matching those declared patterns;
- the setup command and validation command;
- the working directory;
- exact reusable validation-adapter revision;
- runner OS/architecture and GitHub runner image version;
- an optional caller-owned `environment_identity`.

The exact source SHA is recorded in the execution receipt but is deliberately not part of the reusable fingerprint. This allows a validation result to survive commits that change only inputs unrelated to that validation unit.

Changes to unrelated validation units also do not invalidate the selected unit's fingerprint.

## Fail-safe reuse

Cross-run reuse is disabled by default. When the caller explicitly sets `reuse_across_runs: true`, the workflow looks for a retained successful `validation-evidence` execution receipt with the same full fingerprint.

Reuse occurs only after the retained receipt, producer run, repository, unit name, fingerprint digest, and artifact coordinates are verified.

Any uncertainty executes validation normally:

- fingerprint unavailable or malformed manifest;
- artifact lookup failure;
- no retained candidate;
- expired artifact;
- receipt download failure;
- digest or coordinate mismatch;
- invalid prior receipt;
- a declared input that is a symlink, submodule, or another non-regular Git entry.

A failed reuse lookup is therefore a performance miss, not a correctness failure.

## Example

```yaml
jobs:
  unit-evidence:
    permissions:
      actions: read
      contents: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/validation-evidence.yml@<immutable-sha>
    with:
      source_sha: ${{ github.event.pull_request.head.sha }}
      unit_name: unit
      setup_command: bun install --frozen-lockfile
      command: bun run test:unit
      environment_identity: bun-1.4.0
      reuse_across_runs: true
```

Callers should keep toolchain/configuration files in the validation impact manifest's relevant unit inputs or `globalInputs`. `environment_identity` is for additional caller-owned state that cannot be represented by tracked repository files.

## Relationship to impact planning

`validation-impact.yml` answers which units a change invalidates.

`validation-evidence.yml` answers whether a selected unit already has a verified successful result for the same declared evidence identity.

The intended PR loop is:

```text
change
  -> impact plan
  -> select invalidated unit
  -> validation evidence fingerprint
  -> verified receipt hit: reuse
  -> otherwise: execute validation and write receipt
```

Broad integration, nightly, and release boundaries remain caller-owned and may deliberately execute more validation than the PR iteration path.
