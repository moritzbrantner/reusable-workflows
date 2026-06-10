# Workflow Contract Source Of Truth

This repository is authoritative for released reusable Workflow Contracts. The sibling `monorepo` owns the Scaffold Contract and scaffold-family expectations that can feed into this repository, but once Reusable Workflows are implemented, validated, documented, and released here, this repository is the source of truth for those Workflow Contracts.

This distinction is recorded because the existing docs otherwise point in two directions: this repository owns the reusable workflow contracts, while the sibling scaffold docs are normative for scaffold-family repositories. Keeping those authorities separate preserves the scaffold update path without making released consumer contracts depend on another repository's working state.
