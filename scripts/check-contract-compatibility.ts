/* eslint-disable no-console */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  type GeneratedCapabilityManifest,
  generateCapabilityManifest,
  readRepositoryWorkflowSources,
} from "./generate-workflow-manifest";

// Intentional, migrated-away removals of a published callable workflow path.
export type RetiredWorkflows = Record<string, { replacement: string; migration: string }>;

type Workflows = GeneratedCapabilityManifest["workflows"];
type Field = Record<string, unknown>;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const breakingGuidance =
  "publish the breaking interface as a separately versioned workflow file (for example name-v2.yml) and keep this contract until consumers migrate";

function field(value: unknown): Field {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Field)
    : {};
}

function isRequired(value: unknown) {
  return field(value).required === true;
}

function hasDefault(value: unknown) {
  return "default" in field(value);
}

function compareParameters(
  label: string,
  kind: "input" | "secret",
  base: Record<string, unknown>,
  head: Record<string, unknown>,
  errors: string[],
) {
  for (const [name, baseValue] of Object.entries(base)) {
    if (!(name in head)) {
      errors.push(`${label}: ${kind} '${name}' was removed or renamed`);
      continue;
    }
    const headValue = head[name];
    if (!isRequired(baseValue) && isRequired(headValue)) {
      errors.push(`${label}: ${kind} '${name}' changed from optional to required`);
    }
    if (kind === "input") {
      const baseType = field(baseValue).type;
      const headType = field(headValue).type;
      if (baseType !== headType) {
        errors.push(
          `${label}: input '${name}' changed type from ${String(baseType)} to ${String(headType)}`,
        );
      }
      if (
        hasDefault(baseValue) !== hasDefault(headValue) ||
        JSON.stringify(field(baseValue).default) !== JSON.stringify(field(headValue).default)
      ) {
        errors.push(
          `${label}: input '${name}' changed default from ${JSON.stringify(field(baseValue).default)} to ${JSON.stringify(field(headValue).default)}`,
        );
      }
    }
  }

  for (const [name, headValue] of Object.entries(head)) {
    if (!(name in base) && isRequired(headValue) && !hasDefault(headValue)) {
      errors.push(`${label}: new ${kind} '${name}' is required; add it as optional instead`);
    }
  }
}

/** Returns breaking-change diagnostics for head against an immutable published base. */
export function compareCapabilityContracts(
  base: Workflows,
  head: Workflows,
  retired: RetiredWorkflows = {},
): string[] {
  const errors: string[] = [];

  for (const [workflowPath, baseContract] of Object.entries(base)) {
    const headContract = head[workflowPath];
    if (!headContract) {
      if (!(workflowPath in retired)) {
        errors.push(
          `${workflowPath}: callable workflow was removed or renamed; ${breakingGuidance}, or record its replacement and migration in contracts/retired-workflows.json`,
        );
      }
      continue;
    }

    const contractErrors: string[] = [];
    compareParameters(
      workflowPath,
      "input",
      baseContract.inputs,
      headContract.inputs,
      contractErrors,
    );
    compareParameters(
      workflowPath,
      "secret",
      baseContract.secrets,
      headContract.secrets,
      contractErrors,
    );
    for (const name of Object.keys(baseContract.outputs)) {
      if (!(name in headContract.outputs)) {
        contractErrors.push(`${workflowPath}: output '${name}' was removed or renamed`);
      }
    }
    errors.push(...contractErrors.map((error) => `${error}; ${breakingGuidance}`));
  }

  for (const [workflowPath, entry] of Object.entries(retired)) {
    if (!entry.replacement || !entry.migration) {
      errors.push(
        `contracts/retired-workflows.json: ${workflowPath} needs replacement and migration`,
      );
    }
  }

  return errors;
}

function git(args: string[]) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

export function readWorkflowSourcesAt(revision: string): Record<string, string> {
  const files = git(["ls-tree", "--name-only", `${revision}:.github/workflows`])
    .split("\n")
    .filter((fileName) => fileName.endsWith(".yml"));
  return Object.fromEntries(
    files.map((fileName) => {
      const relativePath = path.join(".github", "workflows", fileName);
      return [relativePath, git(["show", `${revision}:${relativePath}`])];
    }),
  );
}

export function main() {
  const baseIndex = process.argv.indexOf("--base");
  const baseRef = baseIndex >= 0 ? process.argv[baseIndex + 1] : "origin/main";
  if (!baseRef) {
    console.error("usage: check-contract-compatibility.ts [--base <ref>]");
    process.exit(2);
  }
  // Compare against the published revision this change branched from, not later default-branch work.
  const base = git(["merge-base", baseRef, "HEAD"]).trim();
  const retired = JSON.parse(
    readFileSync(path.join(root, "contracts", "retired-workflows.json"), "utf8"),
  ) as RetiredWorkflows;

  const errors = compareCapabilityContracts(
    generateCapabilityManifest(readWorkflowSourcesAt(base)).workflows,
    generateCapabilityManifest(readRepositoryWorkflowSources()).workflows,
    retired,
  );

  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  console.log(`Callable workflow contracts remain compatible with published revision ${base}.`);
}

if (import.meta.main) {
  main();
}
