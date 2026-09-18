const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SHA_RE = /^[0-9a-f]{40}$/i;
const UNIT_RE = /^[A-Za-z0-9._-]+$/;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function normalizeRepoPath(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw new Error(`${label} must be a non-empty repository-relative path.`);
  }
  if (value.includes("\\")) {
    throw new Error(`${label} must use '/' separators.`);
  }

  const normalized = path.posix.normalize(value);
  if (
    normalized === "." ||
    normalized.startsWith("/") ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    throw new Error(`${label} must stay inside the repository.`);
  }
  return normalized;
}

function normalizePattern(value, label) {
  const normalized = normalizeRepoPath(value, label);
  if (/[\[\]{}]/.test(normalized)) {
    throw new Error(`${label} uses unsupported glob syntax; use only literals, *, **, and ?.`);
  }
  return normalized;
}

function globToRegExp(pattern) {
  let source = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];

    if (char === "*") {
      if (pattern[index + 1] === "*") {
        if (pattern[index + 2] === "/") {
          source += "(?:[^/]+/)*";
          index += 2;
        } else {
          source += ".*";
          index += 1;
        }
      } else {
        source += "[^/]*";
      }
      continue;
    }

    if (char === "?") {
      source += "[^/]";
      continue;
    }

    source += char.replace(/[.*+?^$()|\\]/g, "\\$&");
  }

  source += "$";
  return new RegExp(source);
}

function normalizePatternList(value, label) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of glob strings.`);
  }
  return stableUnique(value.map((item, index) => normalizePattern(item, `${label}[${index}]`)));
}

function detectDependencyCycle(units) {
  const visiting = new Set();
  const visited = new Set();

  function visit(name, chain) {
    if (visiting.has(name)) {
      throw new Error(\n        `validation impact dependencies contain a cycle: ${[...chain, name].join(" -> ")}`,\n      );
    }
    if (visited.has(name)) {
      return;
    }

    visiting.add(name);
    for (const dependency of units[name].dependsOn) {
      visit(dependency, [...chain, name]);
    }
    visiting.delete(name);
    visited.add(name);
  }

  for (const name of Object.keys(units).sort()) {
    visit(name, []);
  }
}

function parseManifest(value) {
  if (!isRecord(value)) {
    throw new Error("validation impact manifest must contain a JSON object.");
  }
  if (value.schemaVersion !== 1) {
    throw new Error("validation impact manifest schemaVersion must be 1.");
  }
  if (!isRecord(value.units) || Object.keys(value.units).length === 0) {
    throw new Error("validation impact manifest must declare at least one validation unit.");
  }

  const units = {};
  for (const name of Object.keys(value.units).sort()) {
    if (!UNIT_RE.test(name)) {
      throw new Error(`validation unit '${name}' must match ${UNIT_RE}.`);
    }

    const unit = value.units[name];
    if (!isRecord(unit)) {
      throw new Error(`validation unit '${name}' must be an object.`);
    }

    const inputs = normalizePatternList(unit.inputs, `units.${name}.inputs`);
    const dependsOn = unit.dependsOn === undefined ? [] : unit.dependsOn;
    if (!Array.isArray(dependsOn) || dependsOn.some((item) => typeof item !== "string")) {
      throw new Error(`units.${name}.dependsOn must be an array of unit names.`);
    }

    const normalizedDependencies = stableUnique(dependsOn);
    if (inputs.length === 0 && normalizedDependencies.length === 0) {
      throw new Error(`validation unit '${name}' must declare inputs and/or dependencies.`);
    }

    units[name] = {
      inputs,
      dependsOn: normalizedDependencies,
    };
  }

  for (const [name, unit] of Object.entries(units)) {
    for (const dependency of unit.dependsOn) {
      if (!(dependency in units)) {
        throw new Error(`validation unit '${name}' depends on unknown unit '${dependency}'.`);
      }
      if (dependency === name) {
        throw new Error(`validation unit '${name}' cannot depend on itself.`);
      }
    }
  }

  detectDependencyCycle(units);

  return {
    schemaVersion: 1,
    globalInputs: normalizePatternList(value.globalInputs, "globalInputs"),
    ignoredInputs: normalizePatternList(value.ignoredInputs, "ignoredInputs"),
    units,
  };
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(file));
}

function buildPlan({
  baseSha,
  headSha,
  manifestPath,
  changedFiles,
  unitNames,
  invalidatedUnits,
  directInvalidatedUnits = [],
  dependencyInvalidatedUnits = [],
  reusableUnits = [],
  ignoredFiles = [],
  unclassifiedFiles = [],
  globalFiles = [],
  fullValidation,
  reasons,
}) {
  return {
    schemaVersion: 1,
    kind: "reusable-workflows/validation-impact-plan",
    source: {
      baseSha: typeof baseSha === "string" ? baseSha.toLowerCase() : "",
      headSha: typeof headSha === "string" ? headSha.toLowerCase() : "",
      manifestPath,
    },
    changedFiles: stableUnique(changedFiles),
    units: stableUnique(unitNames),
    invalidatedUnits: stableUnique(invalidatedUnits),
    directInvalidatedUnits: stableUnique(directInvalidatedUnits),
    dependencyInvalidatedUnits: stableUnique(dependencyInvalidatedUnits),
    reusableUnits: stableUnique(reusableUnits),
    ignoredFiles: stableUnique(ignoredFiles),
    unclassifiedFiles: stableUnique(unclassifiedFiles),
    globalFiles: stableUnique(globalFiles),
    fullValidation: Boolean(fullValidation),
    reasons: stableUnique(reasons),
  };
}

function fallbackPlan({
  baseSha,
  headSha,
  manifestPath,
  changedFiles = [],
  unitNames = [],
  reason,
}) {
  return buildPlan({
    baseSha,
    headSha,
    manifestPath,
    changedFiles,
    unitNames,
    invalidatedUnits: unitNames,
    fullValidation: true,
    reasons: [reason],
  });
}

function resolveImpactPlan({ baseSha, headSha, manifestPath, changedFiles, manifest }) {
  const normalizedChangedFiles = stableUnique(
    changedFiles.map((file, index) => normalizeRepoPath(file, `changedFiles[${index}]`)),
  );
  const unitNames = Object.keys(manifest.units).sort();

  if (!SHA_RE.test(baseSha) || !SHA_RE.test(headSha)) {
    return fallbackPlan({
      baseSha,
      headSha,
      manifestPath,
      changedFiles: normalizedChangedFiles,
      unitNames,
      reason: "invalid-revision",
    });
  }

  if (normalizedChangedFiles.includes(manifestPath)) {
    return fallbackPlan({
      baseSha,
      headSha,
      manifestPath,
      changedFiles: normalizedChangedFiles,
      unitNames,
      reason: "impact-manifest-changed",
    });
  }

  const globalFiles = normalizedChangedFiles.filter((file) =>
    matchesAny(file, manifest.globalInputs),
  );
  if (globalFiles.length > 0) {
    return buildPlan({
      baseSha,
      headSha,
      manifestPath,
      changedFiles: normalizedChangedFiles,
      unitNames,
      invalidatedUnits: unitNames,
      directInvalidatedUnits: unitNames,
      globalFiles,
      fullValidation: true,
      reasons: ["global-input-changed"],
    });
  }

  const direct = new Set();
  const ignoredFiles = [];
  const unclassifiedFiles = [];

  for (const file of normalizedChangedFiles) {
    let matchedUnit = false;
    for (const [name, unit] of Object.entries(manifest.units)) {
      if (matchesAny(file, unit.inputs)) {
        direct.add(name);
        matchedUnit = true;
      }
    }

    if (matchedUnit) {
      continue;
    }
    if (matchesAny(file, manifest.ignoredInputs)) {
      ignoredFiles.push(file);
      continue;
    }
    unclassifiedFiles.push(file);
  }

  if (unclassifiedFiles.length > 0) {
    return buildPlan({
      baseSha,
      headSha,
      manifestPath,
      changedFiles: normalizedChangedFiles,
      unitNames,
      invalidatedUnits: unitNames,
      directInvalidatedUnits: [...direct],
      ignoredFiles,
      unclassifiedFiles,
      fullValidation: true,
      reasons: ["unclassified-input"],
    });
  }

  const invalidated = new Set(direct);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, unit] of Object.entries(manifest.units)) {
      if (invalidated.has(name)) {
        continue;
      }
      if (unit.dependsOn.some((dependency) => invalidated.has(dependency))) {
        invalidated.add(name);
        changed = true;
      }
    }
  }

  const dependencyInvalidated = [...invalidated].filter((name) => !direct.has(name));
  const reusable = unitNames.filter((name) => !invalidated.has(name));

  return buildPlan({
    baseSha,
    headSha,
    manifestPath,
    changedFiles: normalizedChangedFiles,
    unitNames,
    invalidatedUnits: [...invalidated],
    directInvalidatedUnits: [...direct],
    dependencyInvalidatedUnits: dependencyInvalidated,
    reusableUnits: reusable,
    ignoredFiles,
    fullValidation: false,
    reasons: invalidated.size > 0 ? ["declared-input-changed"] : ["no-validation-input-changed"],
  });
}

function assertCheckedOutHead(headSha) {
  if (!SHA_RE.test(headSha)) {
    throw new Error("head_sha must be an exact 40-character commit SHA.");
  }

  const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  const currentHead = head.status === 0 ? head.stdout.trim().toLowerCase() : "";
  if (currentHead !== headSha.toLowerCase()) {
    throw new Error(\n      `checkout HEAD ${currentHead || "<unavailable>"} does not match requested head ${headSha.toLowerCase()}.`,\n    );
  }
}

function readChangedFiles(baseSha, headSha) {
  for (const revision of [baseSha, headSha]) {
    const probe = spawnSync("git", ["cat-file", "-e", `${revision}^{commit}`], {
      encoding: "utf8",
    });
    if (probe.status !== 0) {
      throw new Error(`git commit ${revision} is unavailable in the checkout.`);
    }
  }

  const diff = spawnSync(
    "git",
    ["diff", "--name-only", "--no-renames", "-z", baseSha, headSha, "--"],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (diff.status !== 0) {
    throw new Error((diff.stderr || "git diff failed").trim());
  }

  return diff.stdout
    .split("\0")
    .filter(Boolean)
    .map((file) => file.replaceAll("\\", "/"));
}

function resolveInsideRepository(repoPath, label) {
  const normalized = normalizeRepoPath(repoPath, label);
  const root = path.resolve(process.cwd());
  const resolved = path.resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label} must stay inside the repository.`);
  }
  return { normalized, resolved };
}

function serializePlan(plan) {
  return JSON.stringify(plan, null, 2);
}

function digestPlan(serializedPlan) {
  return `sha256:${crypto.createHash("sha256").update(serializedPlan).digest("hex")}`;
}

function setOutput(name, value) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) {
    return;
  }
  fs.appendFileSync(output, `${name}=${value}\n`, "utf8");
}

function publishOutputs(plan, planPath, digest) {
  setOutput("changed_files_json", JSON.stringify(plan.changedFiles));
  setOutput("invalidated_units_json", JSON.stringify(plan.invalidatedUnits));
  setOutput("reusable_units_json", JSON.stringify(plan.reusableUnits));
  setOutput("full_validation", String(plan.fullValidation));
  setOutput("plan_digest", digest);
  setOutput("plan_path", planPath);
}

function writeSummary(plan, digest) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  const rows = [
    ["Changed files", String(plan.changedFiles.length)],
    ["Invalidated units", plan.invalidatedUnits.join(", ") || "none"],
    ["Reusable units", plan.reusableUnits.join(", ") || "none"],
    ["Full validation", String(plan.fullValidation)],
    ["Reason", plan.reasons.join(", ")],
    ["Plan digest", digest],
  ];
  const markdown = [
    "### Validation impact",
    "",
    "| Field | Value |",
    "| --- | --- |",
    ...rows.map(([label, value]) => `| ${label} | ${value.replaceAll("|", "\\|")} |`),
    "",
  ].join("\n");
  fs.appendFileSync(summaryPath, markdown, "utf8");
}

function main() {
  const baseSha = process.env.INPUT_BASE_SHA || "";
  const headSha = process.env.INPUT_HEAD_SHA || "";
  const manifestInput = process.env.INPUT_MANIFEST_PATH || ".github/validation-impact.json";
  const outputInput =
    process.env.INPUT_OUTPUT_PATH || ".artifacts/reusable-workflows/validation-impact.json";

  let manifestPath = manifestInput;
  let planPath = outputInput;
  let plan;

  try {
    const manifestLocation = resolveInsideRepository(manifestInput, "manifest_path");
    const outputLocation = resolveInsideRepository(outputInput, "output_path");
    manifestPath = manifestLocation.normalized;
    planPath = outputLocation.normalized;

    try {
      assertCheckedOutHead(headSha);
    } catch (error) {
      plan = fallbackPlan({
        baseSha,
        headSha,
        manifestPath,
        reason: `head-checkout-unavailable: ${\n          error instanceof Error ? error.message : String(error)\n        }`,
      });
    }

    let parsedManifest;
    try {
      const rawManifest = JSON.parse(fs.readFileSync(manifestLocation.resolved, "utf8"));
      parsedManifest = parseManifest(rawManifest);
    } catch (error) {
      if (plan) {
        parsedManifest = undefined;
      } else {
        plan = fallbackPlan({
        baseSha,
        headSha,
        manifestPath,
          reason: `invalid-manifest: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    if (!plan) {
      let changedFiles;
      try {
        changedFiles = readChangedFiles(baseSha, headSha);
      } catch (error) {
        plan = fallbackPlan({
          baseSha,
          headSha,
          manifestPath,
          unitNames: Object.keys(parsedManifest.units),
          reason: `compare-unavailable: ${error instanceof Error ? error.message : String(error)}`,
        });
      }

      if (!plan) {
        plan = resolveImpactPlan({
          baseSha,
          headSha,
          manifestPath,
          changedFiles,
          manifest: parsedManifest,
        });
      }
    }

    const serialized = serializePlan(plan);
    fs.mkdirSync(path.dirname(outputLocation.resolved), { recursive: true });
    fs.writeFileSync(outputLocation.resolved, serialized, "utf8");
    const digest = digestPlan(serialized);
    publishOutputs(plan, planPath, digest);
    writeSummary(plan, digest);
  } catch (error) {
    plan = fallbackPlan({
      baseSha,
      headSha,
      manifestPath,
      reason: `resolver-error: ${error instanceof Error ? error.message : String(error)}`,
    });
    const serialized = serializePlan(plan);
    const digest = digestPlan(serialized);
    publishOutputs(plan, "", digest);
    writeSummary(plan, digest);
    process.stderr.write(`Validation impact resolver fell back to full validation: ${plan.reasons[0]}\n`);
  }
}

module.exports = {
  digestPlan,
  globToRegExp,
  parseManifest,
  resolveImpactPlan,
  serializePlan,
};

if (require.main === module) {
  main();
}
