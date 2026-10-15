# Canonical Workflow Profiles

`reusable-workflows` owns the canonical GitHub workflow topology for maintained repositories.

Reusable workflows remain small capabilities. Profiles compose those capabilities into a small number of intentional repository shapes so the fleet does not independently invent workflow names, lifecycle files, and one-off CI structure.

The machine-readable source is [`profiles/workflow-profiles.json`](profiles/workflow-profiles.json).

## Profiles

| Profile       | Canonical roles                                                       |
| ------------- | --------------------------------------------------------------------- |
| `application` | `validate`, optional `pages`, optional `release`                      |
| `library`     | `validate`, optional `pages`, optional `publish`                      |
| `engine-lab`  | `validate`, optional `pages`, optional `evidence`, optional `publish` |
| `service`     | `validate`, optional `deploy`, optional `release`                     |
| `template`    | `validate`, optional `pages`, optional `release`, optional `evidence` |

A repository enables only the roles it actually needs. The profile bounds the allowed topology; it does not require optional roles.

For Pages-enabled repositories, the roles deliberately split verification from delivery:

- `validate` should build the Pages artifact on pull requests and `main` when Pages is an important application surface;
- downstream browser/site checks should consume that same artifact when practical;
- `pages` should run only for delivery-worthy revisions, normally after successful `main` validation, resolve/reuse the exact validated artifact, and deploy it without rebuilding.

The Pages build command remains repository-owned. The profile standardizes the handoff and top-level workflow boundary, not application-specific build semantics.

## Consumer declaration

Maintained consumers record their resolved profile at `.github/workflow-profile.json`. `platform-upgrader workflow-profile-v1` owns reconciliation from this catalog. A resolved declaration records:

- the profile id;
- enabled roles;
- the canonical workflow path for each enabled role;
- a SHA-256 digest of the catalog used for reconciliation;
- explicit extra workflow paths with a reason when a repository genuinely needs an exception.

`coding-tooling workflow-profile audit` checks the declaration against the files in `.github/workflows/` without network access. Missing canonical workflows and undeclared extra workflows are drift.

## Interactive adoption experience

**Owner decision (2026-10-13, `/steer reusable-workflows` question 2 — B: interactive generator).**

New consumer repositories should be able to configure the current workflow profiles on the GitHub Pages reference site, instead of being limited to text instructions or the historical v1.3 generator:

- Choose one of the canonical profiles from `profiles/workflow-profiles.json`, then enable or disable that profile's optional workflow roles. Keep required roles explicit and mandatory.
- Preview the selected roles, their canonical workflow paths, the resulting `.github/workflow-profile.json` declaration, and the repository-local caller workflow files.
- Export the configuration and caller workflows for review and use in the consumer repository. Make unresolved consumer-specific inputs visible rather than silently inventing commands or claiming generated files are validated when they are not.
- Use tested immutable references for reusable workflow calls, consistent with the versioned capability compatibility policy. Do not treat a moving `main` branch as a stable consumer reference.
- Keep the frozen `workflow-standard-v1.3` generator clearly separate and functional for historical consumers. The new experience represents the current canonical profiles rather than changing the old release's contracts.
- Reuse the canonical profile catalog, capability contracts, and migration/audit semantics. The site is an interactive configuration and export surface, not a second policy authority or a replacement for `platform-upgrader` or `coding-tooling`. The selected export is not an automatic GitHub repository edit or pull request.

**Owner decision (2026-10-13, `/steer reusable-workflows` question 3 — A: interactive command entry).**

For every enabled caller workflow that requires repository-specific validation, build, release, or deployment commands, the generator presents editable command fields. Users enter the actual commands explicitly. The preview and export use those entered commands, not guessed framework defaults or a generated template full of purportedly runnable placeholder commands.

The UI must identify required commands that are still missing and must not claim an incomplete export is ready to run. This decision does not authorize command inference from uploaded repository configuration or a direct GitHub repository integration. The consumer remains the authority for command semantics; the generator only composes and serializes the supplied values.

**Owner decision (2026-10-13, `/steer reusable-workflows` question 4 — A: editable CI presets).**

The current-profile generator offers an editable starting configuration for when checks run:

- Pull requests: fast repository-owned validation by default.
- `main`: a broader repository-owned confidence check by default.
- Expensive/deep validation: offered as optional manual or scheduled execution, not a mandatory gate or automatic extra workflow.
- Users can inspect and modify triggers and the validation depth associated with each lifecycle stage before previewing or exporting caller workflows. The UI and export must reflect those changes rather than silently retaining preset values.

The preset is a convenience, **not** a new required `fast/standard/deep` tier schema or a fleet-wide trigger policy. Each consumer owns its actual validation tiers/commands, schedules, path filters, and concurrency/cancellation policy; keep those decisions visible and configurable in the generated caller files. Do not move tier semantics into `reusable-workflows`, `coding-tooling` or a newly invented central pipeline DSL.

**Owner decision (2026-10-13, `/steer reusable-workflows` question 5 — A: require completed enabled roles).**

Users may select profiles and roles, edit their commands, and inspect an incomplete configuration in the live preview. Do not allow export of runnable caller workflows or a complete bundle until every enabled role has all its required repository-owned commands and other mandatory inputs supplied and validated at the generator's configuration/schema boundary. Missing values are explicitly identified beside their respective fields and the unavailable export action clearly explains what remains to be completed.

Do not silently fill missing fields with guessed commands, TODO placeholders, or an implicit default. Disabling an optional role removes its requirements; a required role cannot be disabled. Once every enabled role is complete, the export becomes available and contains exactly the reviewed configuration. This gate validates configuration completeness and shape, not whether user-entered commands actually execute successfully.

**Owner decision (2026-10-13, `/steer reusable-workflows` question 6 — A: recommended verified immutable pins).**

For every selected reusable capability, the generator should preselect a known-compatible, verified immutable revision when reliable release and compatibility evidence exists. Show the selected capability, exact revision, and verification basis so users can inspect or replace the recommendation before exporting. The resulting caller workflows must reference the exact selected immutable revision, not the moving `main` branch.

Recommendation is a convenience, not permission to invent a release, claim unverified compatibility, or silently change a user's selection. A replacement revision must be a valid immutable ref for the selected callable capability; check it against the available contract evidence. If the generator has no trustworthy compatible recommendation, disclose that and require the user to supply and validate an immutable revision before export rather than falling back to `@main`.

Keep version selection consistent with independently versioned capability contracts and the compatibility policy. Do not duplicate release authority or add a manually maintained second source of truth for capability interfaces.

**Owner decision (2026-10-13, `/steer reusable-workflows` question 7 — A: Renovate update proposals).**

After a repository adopts exported, immutable capability pins, Renovate should propose compatible updates in reviewable pull requests rather than requiring a return to this generator. Each proposal must preserve the intended callable contract, identify the old and candidate immutable revisions, and run the consumer repository's validation. A breaking or unverified-compatibility change requires an explicit migration, not an ordinary automatic pin update.

The generator should emit Renovate-recognizable immutable workflow references and explain how a consuming repository enables the existing shared Renovate preset. Reuse the policy in `coding-agent-conventions` for cadence, approval, and merge behavior; do not add a second dependency updater or automatic-migration mechanism to this site. No guarantee of compatibility follows from a newer commit SHA or successful syntax parsing alone.

**Owner decision (2026-10-13, `/steer reusable-workflows` question 8 — C: reviewable migration package).**

The interactive generator also serves repositories that already have GitHub Actions workflows. Given an existing repository's actual workflow files and profile declaration where present, a user can choose the desired canonical profile/roles and preview a **reviewable migration package**: the proposed `.github/workflow-profile.json`, new or changed caller workflows, an explicit per-file before/after comparison, and a list of workflows and exceptions that will be preserved or need attention.

- Derive profile reconciliation, legacy-path eligibility, and exception preservation from the **existing `platform-upgrader workflow-profile-v1` contract**, not an independent browser migration authority. The site may present the proposal and export its reviewable files; applying migrations remains the responsibility of the consumer and `platform-upgrader`.
- Preserve unknown existing workflows and valid reasoned exceptions. Do not assume a file can be deleted from its name or because the desired profile differs. Propose removal only for a catalog-declared obsolete managed path after verifying it is neither enabled nor excepted; keep every proposed removal visible for review, never silent.
- Retain repository-owned command and lifecycle semantics unless the user explicitly changes them. Required missing input and unresolved migration conflicts remain visible and prevent exporting a package represented as complete, consistently with question 5. Do not invent substitute commands, treat a structural audit as proof of runtime parity, or drop unmatched existing jobs.
- Export proposed changes and explicit preserved files/exceptions for human review; **do not** write to GitHub, open a pull request, or automatically apply or delete files. Provide a way to use the existing migration tooling when adopting the package.
- Keep the same canonical profile catalog, immutable capability pins, and v1.3 compatibility boundary as the new-repository path. How existing repository files enter the generator is not settled by this decision.

**Owner decision (2026-10-13, `/steer reusable-workflows` question 9 — B: read-only public GitHub URL).**

For existing-repository migration, users enter a **public GitHub repository URL**. The generator retrieves that repository's actual workflow files from `.github/workflows/` and its `.github/workflow-profile.json` declaration when present, then uses those retrieved files as the input to the reviewable migration preview described in question 8. Show which repository and source revision supplied the files, so the before/after proposal can be reproduced and is not confused with a later repository change.

The import is read-only: no GitHub authorization, private repository access, filesystem upload, write permission, direct pull request, or automatic migration is part of this experience. Public-only availability and fetch failures (missing repository/files, API limits, network errors) must be explicit; never treat failed or partial discovery as an empty repository or silently generate a complete migration from incomplete evidence. Existing workflows and reasoned exceptions still follow the `platform-upgrader` preservation rules.

**Owner decision (2026-10-13, `/steer reusable-workflows` question 10 — A: default branch only).**

For a public GitHub URL import, inspect **only the repository's reported default branch**. Do not offer a branch, tag, or commit selector in the generator and do not assume the default branch is named `main`.

Resolve that default branch to an exact commit SHA before collecting the workflow files and optional profile declaration. Read every file from that same immutable source commit, and show both the branch name and resolved SHA in the migration preview and export so the proposal is reproducible even if the default branch advances afterward. A new import may resolve a newer default-branch head, but must never silently replace the inspected revision inside an existing proposal.

Unsupported revision-specific URLs, missing default-branch data, or an inconsistent/partial fetch must produce an explicit error rather than silently inspecting a different revision or reporting an empty repository.

**Owner decision (2026-10-13, `/steer reusable-workflows` question 11 — A: preserve existing required check names).**

An existing-repository migration should retain the names and identity of currently required GitHub Actions checks wherever feasible, so branch-protection and ruleset requirements continue to match. The migration preview must show a before/after mapping for existing required workflow and job check names where those requirements are known.

If a requested profile or workflow restructuring necessarily changes a required check, surface the exact old/new names and the required manual branch-protection update; do not claim the migration is drop-in safe. A missing read-only view of branch protection must be reported as **unverified**, not as evidence that no required checks exist. Do not duplicate expensive validations merely to keep a familiar check name; prefer preserving check names on the actual intended validation jobs, and distinguish compatibility labels from validation semantics.

**Status:** Owner-approved product direction; current Pages implementation and independent browser acceptance are still pending.

## Ownership

- repository-owned commands and `coding-tooling` own validation semantics;
- reusable workflow capabilities own GitHub-specific execution and transport;
- this catalog owns canonical workflow topology and filenames;
- `platform-upgrader` applies profile migrations;
- `coding-tooling` reports drift;
- repository-local exceptions remain possible but must be explicit.

Profiles do not replace reusable capabilities. They stop every repository from independently deciding how those capabilities are split into workflow files.

## Deletion safety

Profile convergence does not delete arbitrary unknown workflows. The initial catalog exposes only a narrow list of globally obsolete workflow paths that `platform-upgrader` may prune after a profile is explicitly selected. Any other extra workflow remains in place and is reported as drift until a human or agent records an exception or deliberately migrates it.
