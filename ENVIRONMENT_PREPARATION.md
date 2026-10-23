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

## System packages

Workflows and bespoke consumer jobs install Ubuntu packages through
`.github/actions/install-system-packages`, never through a bare `apt-get` or
`playwright install --with-deps`. GitHub-hosted runners pull from `azure.archive.ubuntu.com`,
which intermittently trickles at a few KB/s and pushes jobs into `timeout-minutes`. The action:

1. skips packages the runner image already provides (dpkg-installed, or a command of the same
   name on `PATH`, such as the image's `cmake`), and does not touch apt when nothing is missing;
2. restores the resolved `.deb` files from `actions/cache`, keyed by the runner image and the exact
   package URIs, so warm runs download nothing from the Ubuntu pool;
3. time-boxes `apt-get update` (120 s) and the download (`download_timeout_seconds`, 300 s), and on a
   stall drops the Azure mirror for `archive.ubuntu.com` before one retry;
4. skips `man-db` trigger processing, which dominates dpkg time on runners.

```yaml
- uses: moritzbrantner/reusable-workflows/.github/actions/install-system-packages@<sha>
  with:
    packages: ffmpeg
    environment_file: .repository-environment.toml # adds [system].apt
    playwright_browsers: chromium # adds Playwright's Linux deps; then run `playwright install chromium`
```

Run `playwright install <browsers>` without `--with-deps` after the action. Jobs that call
`scripts/codex-environment.sh setup` pass `environment_file` first so the script finds its apt
packages already installed.
