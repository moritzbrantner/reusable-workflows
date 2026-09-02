# Agent-facing GitHub Pages contract

The Pages build publishes a small machine-readable surface for coding agents without introducing a server-side runtime.

## Discovery

```text
https://moritzbrantner.github.io/reusable-workflows/agent-tool.json
```

The discovery document points to the live capability catalog:

```text
https://moritzbrantner.github.io/reusable-workflows/capabilities.json
```

`capabilities.json` is generated from the current `.github/workflows/*.yml` files by the same `generateCapabilityManifest` implementation used by repository validation. It exposes callable workflow inputs, secrets, outputs, job permissions, the independent-capability contract model, and the frozen compatibility-release marker.

The workflow YAML remains the source of truth. The Pages JSON is a read-only distribution view for agents that need to inspect available hosted adapters before editing a consumer repository.

The historical `contracts/workflows.json` snapshot remains frozen for `workflow-standard-v1.3`; it is not reused as the live Pages contract.
