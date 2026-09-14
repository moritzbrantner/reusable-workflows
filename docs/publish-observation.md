# Publish Observation action

`.github/actions/publish-observation` is a transport-only composite action for durable CI observations.

It downloads one named artifact from the current workflow run, takes one caller-selected file from that artifact, and publishes it to a caller-selected path on a dedicated repository branch. The action does not parse or reinterpret the file.

## Ownership boundary

Use this when a repository-owned producer has already created normalized evidence and that evidence needs to outlive ordinary workflow artifact retention.

- The caller owns the evidence schema and domain meaning.
- Tools such as Moonlight, runtime-profiler, Unlighthouse, and coding-tooling remain authoritative for their measurements and verdicts.
- The action owns only GitHub artifact download, observation-branch checkout/creation, deterministic file replacement, commit, and push.
- The caller owns concurrency. Use a branch-scoped concurrency group when multiple runs can publish to the same observation branch.
- The caller decides when publication is allowed. For merge evidence, prefer a publication job that depends on every required validation job rather than publishing from an individual benchmark job.

## Example

```yaml
publish-runtime-observation:
  needs: [fast, browser, runtime]
  if: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}
  permissions:
    actions: read
    contents: write
  concurrency:
    group: runtime-observation-${{ github.repository }}
    cancel-in-progress: true
  runs-on: ubuntu-latest
  steps:
    - uses: moritzbrantner/reusable-workflows/.github/actions/publish-observation@<immutable-sha>
      with:
        artifact_name: runtime-evidence
        artifact_source_path: project-evidence.json
        branch: project-observations
        destination_path: evidence/runtime.json
        source_sha: ${{ github.sha }}
        github_token: ${{ github.token }}
```

The action rejects absolute or parent-traversing source/destination paths, validates the observation branch name, fails if the requested artifact file is absent, and never force-pushes an existing observation branch.
