# Environment preparation

`command-validation.yml` and `release-qualification.yml` use environment-v1 as the standard repository preparation seam when the consumer declares both `.repository-environment.toml` and `scripts/codex-environment.sh`.

The normal execution order is:

1. Check out the consumer source.
2. Run the optional repository-owned `setup_command` bootstrap hook.
3. If environment-v1 is declared, run `bash scripts/codex-environment.sh setup` from the repository root.
4. Run the repository-owned validation, build, or qualification command directly.
5. Only when setup or the repository command fails, inspect whether environment preparation changed tracked repository state as diagnostic evidence.

The bootstrap hook does not replace environment-v1. Its purpose on an environment-v1 repository is to provision prerequisites that the standard setup entrypoint intentionally does not bootstrap itself, such as exact core runtimes installed through a trusted pinned mechanism. On a repository that does not declare environment-v1, the same hook retains its previous role as the optional setup command.

This keeps the generic adapter runtime-neutral: reusable-workflows does not learn how to install Bun, Node, Rust, Python, system packages, or application frameworks. Environment semantics remain repository/environment-v1 owned, while the GitHub adapter only sequences the standard entrypoint and transports outcomes.

`environment-v1-canary.yml` remains the stricter semantic canary. It captures and verifies the environment fingerprint on its own scheduled/manual lifecycle. Normal command validation, validation evidence, artifact builds, and release qualification do not spend that semantic verification cost on successful runs. Their tracked-state check is failure-only diagnostic evidence and never overrides the original command outcome.
