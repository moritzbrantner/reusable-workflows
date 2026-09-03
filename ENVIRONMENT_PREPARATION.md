# Environment preparation

`command-validation.yml` and `release-qualification.yml` use environment-v1 as the standard repository preparation seam when the consumer declares both `.repository-environment.toml` and `scripts/codex-environment.sh`.

The preparation order is:

1. Check out the consumer source.
2. Run the optional repository-owned `setup_command` bootstrap hook.
3. If environment-v1 is declared, run `bash scripts/codex-environment.sh setup` from the repository root.
4. Require environment-v1 setup to leave tracked repository state unchanged.
5. Run the repository-owned validation or qualification command.

The bootstrap hook does not replace environment-v1. Its purpose on an environment-v1 repository is to provision prerequisites that the standard setup entrypoint intentionally does not bootstrap itself, such as exact core runtimes installed through a trusted pinned mechanism. On a repository that does not declare environment-v1, the same hook retains its previous role as the optional setup command.

This keeps the generic adapter runtime-neutral: reusable-workflows does not learn how to install Bun, Node, Rust, Python, system packages, or application frameworks. Environment semantics remain repository/environment-v1 owned, while the GitHub adapter only sequences the standard entrypoint and transports outcomes.

`environment-v1-canary.yml` remains the stricter semantic canary. It additionally captures and verifies the environment fingerprint. Normal command validation and release qualification do not duplicate that coding-tooling protocol; they only enforce the standard setup entrypoint and tracked-state boundary.
