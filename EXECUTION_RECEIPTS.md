# Execution Receipt v1

Reusable workflows may produce semantic reports with different schemas, but orchestration and dashboards still need a small common transport envelope.

`contracts/execution-receipt-v1.schema.json` defines that envelope. It records only execution identity and evidence transport metadata:

- the capability name and interface version;
- the exact consumer repository and commit SHA that ran;
- the overall execution outcome and named step outcomes;
- evidence roles, artifact names, repository-relative paths where applicable, and normalized `sha256:<digest>` identities;
- the GitHub run ID, run attempt, and caller workflow ref.

The receipt deliberately does **not** copy semantic report contents. For example, `coding-tooling-validation.yml` keeps the coding-tooling JSON report authoritative for findings, tiers, and public-contract evidence, while the receipt points to that report artifact. `release-qualification.yml` keeps qualification policy in repository-owned commands while the receipt identifies the exact qualified artifact. `command-validation.yml` has no semantic report by default, so its receipt records execution identity and outcomes with an empty evidence list.

## Current emitters

- `command-validation.yml`
- `coding-tooling-validation.yml`
- `release-qualification.yml`

Each emitter validates the receipt shape before uploading it. The repository contract validator also locks the shared kind, schema version, required fields, receipt outputs, and validation step so the transport seam cannot silently disappear.

## Compatibility

Execution Receipt v1 belongs to the independent capability line on `main`. It does not modify the frozen `workflow-standard-v1.3` compatibility snapshot.
