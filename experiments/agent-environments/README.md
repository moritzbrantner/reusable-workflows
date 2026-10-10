# Autonomous coding-agent environment pilot

Tracking: [reusable-workflows #106](https://github.com/moritzbrantner/reusable-workflows/issues/106).

This is an **opt-in, manual experiment**, not a new reusable workflow API, production validation gate or recommendation to migrate consumers. GitHub Actions offers three environments on the same Ubuntu 24.04 hosted VM class:

| Candidate        | Real execution environment                             | Provisioning included                                                |
| ---------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| **ubuntu**       | Host Ubuntu 24.04 with Node 24                         | Checkout, tool selection, test                                       |
| **devcontainer** | Digest-pinned Microsoft Dev Container on Ubuntu/Docker | Checkout, pinned CLI installation, image pull, container start, test |
| **nixos-vm**     | Actual pinned NixOS guest under QEMU/KVM on Ubuntu     | Host Nix installation, NixOS build, VM boot, test                    |

**NixOS VM is not a native hosted NixOS runner.** GitHub does not provide a standard NixOS runner label. The guest uses three virtual CPUs and 4 GiB of memory within the Ubuntu host. Nested virtualization and NixOS provisioning overhead are part of the recorded cost. When KVM is unavailable, the job writes an explicit **unavailable** receipt. It never calls Ubuntu plus a Nix dev shell a NixOS result.

## Fixture and evidence

Every candidate executes the same committed **probe-check.mjs** (three Node-native tests) and **probe.mjs** on **fixture.json**. The fixture exercises deterministic test selection and fail-closed unknown dependencies. The recorder binds the result to the SHA-256 of the fixture, the tested GitHub commit, job ID, runner image, environment identity and elapsed durations.

The NixOS guest's exact host time-to-first-test cannot be established from its boot log, so that field is **null** rather than invented. Actual GitHub job durations and billed runner minutes must be collected separately.

**This small probe does not measure end-to-end agent task productivity.** It isolates provisioning and a fixed correctness check; no conclusion about coding-agent token cost or task throughput follows from it.

Each run uses a new GitHub-hosted runner. We do not configure persistent workspace, Docker-layer or Nix-store caches. Repeated invocations are therefore **fresh-runner samples**, not controlled warm-run samples.

## Execution

After the experimental workflow is available on the default branch, open GitHub **Actions → Agent Environment Pilot (manual, non-required) → Run workflow** and choose **all** or one environment. There is no scheduled CI, no registry write, and no change to production workflow gates.

To validate the fixture and result parser locally, run the three commands from the repository root:

- node --test experiments/agent-environments/probe-check.mjs
- node --test experiments/agent-environments/record-check.mjs
- node experiments/agent-environments/probe.mjs

The Dev Container is pinned to the September 2026 Microsoft javascript-node 24-bookworm OCI digest and the CLI is pinned to version 0.89.0. The NixOS VM uses the committed flake.lock. These are deliberate, immutable pilot inputs.

## Remaining acceptance before choosing any production default

1. Confirm the actual NixOS guest boots and emits the same passing fixture marker. Missing VM capability must remain unavailable rather than silently passing.
2. Replay an actual agent issue/implementation and a representative repository-owned semantic validation slice in all candidates, at comparable source revisions and hardware limits.
3. Collect at least five independent cold and five provenance-controlled warm samples per variant where feasible, including setup/image build cost, failure/retry rate, test time, agent task throughput and runner minutes.
4. Publish raw run URLs and median/p95 comparisons, then recommend a candidate or explicitly declare the experiment **inconclusive**.

Rollback: remove this opt-in workflow and the experiment directory. No reusable workflow API, pinned compatibility tag or consumer CI needs changing.
