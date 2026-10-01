# Canonical Workflow Profiles

`reusable-workflows` owns the canonical GitHub workflow topology for maintained repositories.

Reusable workflows remain small capabilities. Profiles compose those capabilities into a small number of intentional repository shapes so the fleet does not independently invent workflow names, lifecycle files, and one-off CI structure.

The machine-readable source is [`profiles/workflow-profiles.json`](profiles/workflow-profiles.json).

## Profiles

| Profile        | Canonical roles                                                            |
| -------------- | -------------------------------------------------------------------------- |
| `application`  | `validate`, optional `pages`, optional `release`                         |
| `library`      | `validate`, optional `pages`, optional `publish`                         |
| `engine-lab`   | `validate`, optional `pages`, optional `evidence`, optional `publish`    |
| `service`      | `validate`, optional `deploy`, optional `release`                        |
| `template`     | `validate`, optional `pages`, optional `release`, optional `evidence`   |

A repository enables only the roles it actually needs. The profile bounds the allowed topology; it does not require optional roles.

## Consumer declaration

Maintained consumers record their resolved profile at `.github/workflow-profile.json`. `platform-upgrader workflow-profile-v1` owns reconciliation from this catalog. A resolved declaration records:

- the profile id;
- enabled roles;
- the canonical workflow path for each enabled role;
- a SHA-256 digest of the catalog used for reconciliation;
- explicit extra workflow paths with a reason when a repository genuinely needs an exception.

`coding-tooling workflow-profile audit` checks the declaration against the files in `.github/workflows/` without network access. Missing canonical workflows and undeclared extra workflows are drift.

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
