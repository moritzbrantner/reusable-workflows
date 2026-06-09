/* eslint-disable no-console */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseAllDocuments } from "yaml";

import { checkWorkflowObject, formatAdoptionCheckResultAsJson } from "../src/app/adoption/check";
import type { AdoptionCheckResult, AdoptionDiagnostic } from "../src/app/adoption/types";

type CliOptions = {
  format: "json" | "text";
  root: string;
  strict: boolean;
};

export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    format: "text",
    root: ".",
    strict: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--strict") {
      options.strict = true;
      continue;
    }

    if (arg === "--root") {
      options.root = args[index + 1] ?? ".";
      index += 1;
      continue;
    }

    if (arg === "--format") {
      const format = args[index + 1];

      if (format === "json" || format === "text") {
        options.format = format;
      }

      index += 1;
    }
  }

  return options;
}

export function checkAdoptionAtRoot(root: string): AdoptionCheckResult {
  const workflowsDir = path.resolve(root, ".github", "workflows");
  const diagnostics: AdoptionDiagnostic[] = [];

  if (!existsSync(workflowsDir)) {
    return {
      diagnostics: [
        {
          code: "missing-workflows-directory",
          level: "error",
          message: `Could not find ${path.relative(process.cwd(), workflowsDir)}.`,
          file: workflowsDir,
        },
      ],
    };
  }

  for (const fileName of readdirSync(workflowsDir).filter((file) => /\.ya?ml$/.test(file))) {
    const filePath = path.join(workflowsDir, fileName);

    try {
      const source = readFileSync(filePath, "utf8");

      diagnostics.push(...checkWorkflowSource(source, path.relative(root, filePath)).diagnostics);
    } catch (error) {
      diagnostics.push({
        code: "unreadable-workflow-file",
        level: "error",
        message: error instanceof Error ? error.message : `Could not read ${filePath}.`,
        file: filePath,
      });
    }
  }

  return { diagnostics };
}

export function checkWorkflowSource(source: string, file: string): AdoptionCheckResult {
  const diagnostics: AdoptionDiagnostic[] = [];

  for (const document of parseAllDocuments(source)) {
    for (const error of document.errors) {
      diagnostics.push({
        code: "yaml-parse-error",
        level: "error",
        message: error.message,
        file,
        line: lineForOffset(source, error.pos?.[0]),
      });
    }

    if (document.errors.length > 0) {
      continue;
    }

    const value = document.toJSON() as unknown;

    diagnostics.push(
      ...checkWorkflowObject(value as Parameters<typeof checkWorkflowObject>[0], source, file),
    );
  }

  return { diagnostics };
}

export function formatAdoptionCheckResultAsText(result: AdoptionCheckResult) {
  if (result.diagnostics.length === 0) {
    return "No reusable workflow adoption issues found.";
  }

  return result.diagnostics
    .map((diagnostic) => {
      const location = [diagnostic.file, diagnostic.line].filter(Boolean).join(":");

      return `${diagnostic.level.toUpperCase()} ${diagnostic.code}${location ? ` ${location}` : ""}\n  ${diagnostic.message}`;
    })
    .join("\n");
}

export function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const result = checkAdoptionAtRoot(options.root);
  const output =
    options.format === "json"
      ? formatAdoptionCheckResultAsJson(result)
      : formatAdoptionCheckResultAsText(result);

  console.log(output);

  const hasErrors = result.diagnostics.some((diagnostic) => diagnostic.level === "error");
  const hasWarnings = result.diagnostics.some((diagnostic) => diagnostic.level === "warning");

  if (hasErrors || (options.strict && hasWarnings)) {
    process.exit(1);
  }
}

function lineForOffset(source: string, offset?: number) {
  if (typeof offset !== "number" || offset < 0) {
    return undefined;
  }

  return source.slice(0, offset).split("\n").length;
}

if (import.meta.main) {
  main();
}
