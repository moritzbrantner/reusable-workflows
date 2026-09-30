# Environment preparation

Ordinary command validation is explicit. `command-validation.yml` does not inspect
`.repository-environment.toml` and does not infer an environment setup sequence.

Its execution order is:

1. Check out the consumer source.
2. Run the optional repository-owned `setup_command`, when one is supplied.
3. Run the repository-owned validation command directly.

If a consumer needs environment-v1 preparation before validation, the caller can make that explicit
in `setup_command`, for example `bash scripts/codex-environment.sh setup`. A repository may
instead keep all required preparation inside its own validation command. The reusable adapter does
not choose between those repository-owned approaches.

This keeps `command-validation.yml` runtime-neutral and inspectable: it does not learn how to
install Bun, Node, Rust, Python, system packages, application frameworks, or how to interpret
environment declarations.

Artifact-building and release capabilities retain their existing environment-v1 preparation where
that behavior is part of their established artifact contract. `environment-v1-canary.yml` remains
an optional setup smoke test. Normal validation, builds, and release qualification trust setup and
report the actual command outcome without adding an automatic environment diagnosis.
