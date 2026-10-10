# Agent CI environment pilot

Tracking issue: [#107](https://github.com/moritzbrantner/reusable-workflows/issues/107).
Review the results on **2026-10-18**. This is a **non-required, non-reusable** GitHub Actions experiment; production workflows and their consumer-owned validation commands remain unchanged.

## What is tested now

[agent-ci-environment-pilot.yml](../../.github/workflows/agent-ci-environment-pilot.yml) executes the **same committed Node 24 + deterministic dependency-closure smoke fixture** in four environments:

| Job            | Actual environment                                                        | Preparation measured                          |
| -------------- | ------------------------------------------------------------------------- | --------------------------------------------- |
| `ubuntu`       | Native GitHub-hosted Ubuntu 24.04                                         | actions/setup-node 24                         |
| `devcontainer` | Microsoft prebuilt JavaScript/Node Dev Container **image**, by OCI digest | OCI image pull + startup (run by host Docker) |
| `ubuntu-nix`   | GitHub-hosted Ubuntu 24.04 with a pinned Nix development shell            | Nix installer + `nix develop`                 |
| `nixos-vm`     | **Genuine NixOS guest** in QEMU/KVM on a GitHub-hosted Ubuntu machine     | Nix installer + NixOS test build/VM boot      |

The NixOS job is deliberately **not** called a GitHub-hosted NixOS runner, and Ubuntu with Nix is deliberately **not** called NixOS. GitHub does not publish a standard hosted NixOS runner image. The guest is verified from `/etc/os-release` as `ID=nixos`; the container must report `ID=debian`, and the host and Ubuntu+Nix report `ID=ubuntu`. Every task asserts Node major version 24 and yields a deterministic fixture/workload SHA-256.

The Dev Container image is `mcr.microsoft.com/devcontainers/javascript-node@sha256:ef380643327dafe138722179c1ac86477a4b1f643c3a2c83d3baa1b8ea226166`. It was identified from the Microsoft artifact registry as the immutable `24-bookworm` image. The Nixpkgs source is commit `4975466d324710c576dc11ad614684e6bd8cad8e` plus the committed `flake.lock`. These are intentionally experiment-specific toolchain inputs, not new versions for consumers.

**This is a feasibility and first-test-latency probe, not an agent productivity benchmark.** The initial smoke does not execute `bun run validate:semantic`, exercise an entire work-loop issue, or reproduce all the CPU/memory resources available to a native NixOS runner. The NixOS VM necessarily includes nested virtualization overhead and may not fit a standard hosted runner's disk/time limits. A pinned image run through `docker run` probes the prebuilt Dev Container image, but not the full Dev Containers CLI creation/features lifecycle. These gaps must be closed before declaring a winner.

## How to collect evidence

- A change to this experimental workflow or directory on `main` starts one pilot automatically. Also use **Actions → Agent CI Environment Pilot → Run workflow** to collect independent attempts; PRs exercise three lower-cost arms, while the NixOS VM runs only on `main` or manual dispatch.
- Read the **job-level duration** from the GitHub Actions jobs API, not just the smoke's `runtimeMs`. Steps explicitly separate setup, pull/build, and smoke, and the `ci-environment-*` artifacts retain immutable-input provenance, raw logs and the runner image variable.
- Use **different fresh runners** for cold samples. Compare at least **five successful independent samples per candidate**, and five genuinely cache-warm fresh-runner runs if a persisted-cache strategy is introduced. Re-running the smoke twice within one job is _not_ a fresh-runner warm sample.
- Collect source SHA, runner image and resources, OCI index digest, Nixpkgs commit, runtime versions, cold/warm classification, queue delay, job duration, summed runner-minutes, pull/install/boot duration, time to first passing test, failures and retries, and GitHub run/job URLs. Count image creation/storage and any dedicated-runner cost rather than ignoring them.
- Compare correctness only if all candidates run **the same source and assertions**. Mark a candidate **unavailable** when it fails installation, KVM admission, cache acquisition, version validation, or task execution. Do not quietly fall back to a different environment.
- For coding-agent throughput, follow up with the existing **repository-owned `bun run validate:semantic` contract**, and ideally identical task packets, acceptance contracts, and code changes. Require matching Bun/toolchain versions and full validation semantics first. A fast toy smoke alone cannot demonstrate agent task productivity.

## Decision rule

No fleet-wide migration follows automatically. On 2026-10-18, publish raw evidence links, a short table with failures and cold/warm cost, and one of **retain / reject / inconclusive** for each candidate. Existing required checks, Pages, release promotion, source identity, and consumer profiles remain authoritative throughout. NixOS VM and prebuilt Dev Container may be valuable for isolated agent workloads even if their end-to-end startup is slower than an ordinary Ubuntu runner; make that judgment from the measured task and context-reuse horizon, not installer time alone.
