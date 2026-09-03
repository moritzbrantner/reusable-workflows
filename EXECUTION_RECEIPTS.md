# Execution Receipt v1

Reusable workflows may produce semantic reports with different schemas, but orchestration and dashboards still need a small common transport envelope.

`contracts/execution-receipt-v1.schema.json` defines that envelope. It records only execution identity and evidence transport metadata:

- the capability name and interface version;
- the exact consumer repository and commit SHA that ran;
- the overall execution outcome and named step outcomes;
- evidence roles, artifact names, repository-relative paths where applicable, and normalized `sha256:<digest>` identities;
- optional signed-attestation metadata: predicate type, attestation ID/URL, subject name, and subject digest;
- the GitHub run ID, run attempt, and caller workflow ref.

The receipt deliberately does **not** copy semantic report contents. For example, `coding-tooling-validation.yml` keeps the coding-tooling JSON report authoritative for findings, tiers, and public-contract evidence, while the receipt points to that report artifact. `command-validation.yml` has no semantic report by default, so its receipt records execution identity and outcomes with an empty evidence list.

`release-qualification.yml` additionally emits an exact-source provenance predicate described by `contracts/artifact-provenance-v1.schema.json`. The predicate binds the exact checked-out source SHA to the uploaded qualified-artifact digest and the qualification run. It is signed with GitHub artifact attestations through an exact `actions/attest` pin. This intentionally uses a custom in-toto predicate rather than GitHub's automatic SLSA provenance mode: automatic provenance resolves the OIDC workflow SHA, which may be a synthetic pull-request merge SHA instead of the exact commit qualified by this capability.

## Current emitters

- `command-validation.yml`
- `coding-tooling-validation.yml`
- `release-qualification.yml`

Each emitter validates the receipt shape before uploading it. Release qualification also validates its provenance predicate before attesting the artifact. The repository contract validator locks the shared receipt identity, provenance schema, immutable attestation Action pin, receipt outputs, and provenance outputs so these transport seams cannot silently disappear.

## Compatibility

Execution Receipt v1 and Artifact Provenance v1 belong to the independent capability line on `main`. They do not modify the frozen `workflow-standard-v1.3` compatibility snapshot.
