# Execution Receipt v1

Execution receipts are reserved for capabilities that deliberately persist, move, qualify, promote, or deliver an artifact or other durable cross-workflow reference. They are not part of ordinary command or coding-tooling validation.

`contracts/execution-receipt-v1.schema.json` defines the shared transport envelope. It records execution identity, exact source coordinates, outcomes, evidence references, optional attestations, and optional upstream references without copying domain-specific report contents.

## Ordinary validation boundary

`command-validation.yml` and `coding-tooling-validation.yml` do not emit execution receipts. Their job is deliberately smaller:

```text
checkout
  -> optional repository setup
  -> repository command / coding-tooling operation
  -> real exit outcome
```

A failed coding-tooling run may upload its report and an explicitly requested evidence path for diagnosis. Those files are diagnostic output, not a reusable proof that can cause a later validation run to be skipped.

## Current durable-reference emitters

Execution Receipt v1 remains available where a durable cross-workflow identity is part of the capability itself, including:

- `build-artifact.yml`
- `coding-tooling-score-history.yml`
- `release-qualification.yml`
- `artifact-promotion.yml`
- `deploy-qualified-pages.yml`
- `deliver-qualified-expo-stores.yml`

`release-qualification.yml` additionally emits the exact-source provenance predicate described by `contracts/artifact-provenance-v1.schema.json`. Promotion and terminal delivery verify the qualified artifact and its provenance rather than rebuilding it.

The receipt schema and release/artifact transport contracts remain tested because those workflows cross a real persistence or delivery boundary. Receipt semantics should not spread back into the ordinary validation path.

## Compatibility

Execution Receipt v1 and Artifact Provenance v1 belong to the independent capability line on `main`. They do not modify the frozen `workflow-standard-v1.3` compatibility snapshot.
