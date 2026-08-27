# Dependency Update Policy

Dependency automation is independent from the reusable-workflow architecture.

An updater proposes a version change. Repository-owned checks decide whether that change is acceptable.

## One updater per ecosystem

Use Dependabot or Renovate for a given ecosystem, not both. During a migration, keep the existing updater active until the replacement is installed and has successfully processed its repository configuration; then disable overlapping version-update pull requests.

Security alerts may remain enabled independently from version-update automation.

## Qualification

Dependency pull requests should run the same repository-owned validation used for ordinary changes. Additional checks may be enabled when they provide relevant evidence, such as:

- integration or e2e tests;
- dependency/security audits;
- API compatibility checks;
- controlled benchmark comparisons.

The updater does not define completion and should not rewrite application code merely because a check failed. A concrete incompatibility can instead become normal agent-assisted migration work.

Private repositories that use `coding-tooling` may express this evidence as a `dependency-update` tier and run it through `coding-tooling-validation.yml`. This keeps the semantic tier identical between local execution and GitHub qualification. Public repositories can run equivalent repository-owned commands through the generic workflow capabilities.

## Renovate defaults

A future shared Renovate preset should be conservative:

- do not automerge by default;
- group low-risk development dependency updates where useful;
- keep major updates explicitly reviewable;
- require normal repository checks;
- allow an opt-in aged patch-automerge policy only after the relevant checks are stable;
- keep runtime and security-sensitive updates reviewable unless a repository chooses a narrower policy.

The private `coding-tooling` Action is an optional qualification mechanism, not a prerequisite for dependency automation. Local/source validation, the updater, and hosted qualification remain separable layers.

## Benchmark evidence

A dependency benchmark is useful only when base and candidate are measured under controlled conditions. The repository owns the fixture/workload, repetitions, aggregation, runtime metadata, thresholds, and interpretation. GitHub workflows may execute or transport this evidence; `runtime-profiler` or repository tooling should own its semantics.
