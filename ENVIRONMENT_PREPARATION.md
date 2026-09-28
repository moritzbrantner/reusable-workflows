# Environment preparation

`command-validation.yml` and `release-qualification.yml` use environment-v1 as the standard repository preparation seam when the consumer declares both `.repository-environment.toml` and `scripts/codex-environment.sh`.

The normal execution order is:

1. Check out the consumer source.
2. Run the optional repository-owned `setup_command` bootstrap hook.
3. If environment-v1 is declared, run `bash scripts/codex-environment.sh setup` from the repository root.
4. Run the repository-owned validation, build, or qualification command directly.
5. Report the repository command result. Investigate the runner or environment separately if a concrete failure calls for it.

The bootstrap hook does not replace environment-v1. Its purpose on an environment-v1 repository is to provision prerequisites that the standard setup entrypoint intentionally does not bootstrap itself. On a repository that does not declare environment-v1, the same hook retains its previous role as the optional setup command.

This keeps the generic adapter runtime-neutral: reusable-workflows does not learn how to install Bun, Node, Rust, Python, system packages, or application frameworks. Environment semantics remain repository/environment-v1 owned, while the GitHub adapter only sequences the standard entrypoint and transports outcomes.

`environment-v1-canary.yml` is an optional setup smoke test. It runs the declared setup command without deriving fingerprints or checking runner identity. Normal validation, builds, and release qualification trust setup and report the actual command outcome without adding an automatic environment diagnosis.
