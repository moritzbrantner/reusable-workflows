const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { globToRegExp, parseManifest } = require("../resolve-validation-impact/resolver.cjs");

const SHA_RE = /^[0-9a-f]{40}$/i;
const UNIT_RE = /^[A-Za-z0-9._-]+$/;

function compareStable(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableUnique(values) {
  return [...new Set(values)].sort(compareStable);
}

function normalizeRepoPath(value, label, allowDot = false) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw new Error(`${label} must be a non-empty repository-relative path.`);
  }
  if (value.includes("\\")) {
    throw new Error(`${label} must use '/' separators.`);
  }

  const normalized = path.posix.normalize(value);
  if (
    (!allowDot && normalized === ".") ||
    normalized.startsWith("/") ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    throw new Error(`${label} must stay inside the repository.`);
  }
  return normalized;
}

function resolveInsideRepository(repoPath, label, allowDot = false) {
  const normalized = normalizeRepoPath(repoPath, label, allowDot);
  const root = path.resolve(process.cwd());
  const resolved = path.resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label} must stay inside the repository.`);
  }
  return { normalized, resolved };
}

function assertCheckedOutHead(sourceSha) {
  if (!SHA_RE.test(sourceSha)) {
    throw new Error("source_sha must be an exact 40-character commit SHA.");
  }
  const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  if (head.status !== 0 || head.stdout.trim().toLowerCase() !== sourceSha.toLowerCase()) {
    throw new Error("checked-out HEAD does not match source_sha.");
  }
}

function collectUnitClosure(units, unitName) {
  if (!(unitName in units)) {
    throw new Error(`validation unit '${unitName}' is not declared by the manifest.`);
  }
  const closure = new Set();
  function visit(name) {
    if (closure.has(name)) return;
    closure.add(name);
    for (const dependency of units[name].dependsOn) visit(dependency);
  }
  visit(unitName);
  return [...closure].sort(compareStable);
}

function listTrackedFiles() {
  const result = spawnSync("git", ["ls-files", "-s", "-z"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || "git ls-files failed").trim());
  }

  const files = [];
  for (const entry of result.stdout.split("\0").filter(Boolean)) {
    const tab = entry.indexOf("\t");
    if (tab < 0) throw new Error("unsupported git ls-files entry.");
    const metadata = entry.slice(0, tab).split(" ");
    const file = entry.slice(tab + 1).replaceAll("\\", "/");
    if (metadata.length !== 3 || metadata[2] !== "0") {
      throw new Error("validation fingerprint requires a clean stage-0 index.");
    }
    files.push({ mode: metadata[0], objectId: metadata[1], path: file });
  }
  return files.sort((left, right) => compareStable(left.path, right.path));
}

function hashGitBlob(objectId) {
  const type = spawnSync("git", ["cat-file", "-t", objectId], { encoding: "utf8" });
  if (type.status !== 0 || type.stdout.trim() !== "blob") {
    throw new Error(`tracked input ${objectId} is not a regular Git blob.`);
  }
  const content = spawnSync("git", ["cat-file", "blob", objectId], {
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (content.status !== 0) {
    throw new Error(`failed to read tracked input blob ${objectId}.`);
  }
  return `sha256:${crypto.createHash("sha256").update(content.stdout).digest("hex")}`;
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(file));
}

function buildFingerprint({
  sourceSha,
  unitName,
  manifestPath,
  manifest,
  workingDirectory,
  setupCommand,
  command,
  environmentIdentity,
}) {
  const closure = collectUnitClosure(manifest.units, unitName);
  const patterns = stableUnique([
    ...manifest.globalInputs,
    ...closure.flatMap((name) => manifest.units[name].inputs),
  ]);
  const tracked = listTrackedFiles();
  const matched = tracked.filter((entry) => matchesAny(entry.path, patterns));
  const inputFiles = matched.map((entry) => ({
    path: entry.path,
    digest: hashGitBlob(entry.objectId),
  }));

  const relevantUnits = {};
  for (const name of closure) {
    relevantUnits[name] = {
      inputs: [...manifest.units[name].inputs],
      dependsOn: [...manifest.units[name].dependsOn],
    };
  }

  const identity = {
    schemaVersion: 1,
    kind: "reusable-workflows/validation-evidence-identity",
    identityVersion: 1,
    unit: unitName,
    unitClosure: closure,
    declaredPatterns: patterns,
    manifest: {
      globalInputs: [...manifest.globalInputs],
      units: relevantUnits,
    },
    execution: {
      workingDirectory,
      setupCommand,
      command,
      environmentIdentity,
      runnerOs: process.env.RUNNER_OS || "",
      runnerArch: process.env.RUNNER_ARCH || "",
    },
    inputFiles,
  };
  const serializedIdentity = JSON.stringify(identity);
  const digest = `sha256:${crypto.createHash("sha256").update(serializedIdentity).digest("hex")}`;

  return {
    schemaVersion: 1,
    kind: "reusable-workflows/validation-evidence-fingerprint",
    source: {
      repository: process.env.GITHUB_REPOSITORY || "",
      sha: sourceSha.toLowerCase(),
    },
    manifestPath,
    available: true,
    reason: "fingerprint-proven",
    fingerprintDigest: digest,
    identity,
  };
}

function fallbackPlan({ sourceSha, unitName, manifestPath, reason }) {
  return {
    schemaVersion: 1,
    kind: "reusable-workflows/validation-evidence-fingerprint",
    source: {
      repository: process.env.GITHUB_REPOSITORY || "",
      sha: SHA_RE.test(sourceSha || "") ? sourceSha.toLowerCase() : "",
    },
    manifestPath,
    available: false,
    reason,
    fingerprintDigest: null,
    identity: null,
  };
}

function actionInput(name, fallback = "") {
  return process.env[`INPUT_${name}`] || fallback;
}

function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  const normalized = String(value ?? "").replace(/[\r\n]+/g, " ");
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${normalized}\n`, "utf8");
}

function publishOutputs(plan, fingerprintPath) {
  setOutput("fingerprint_available", String(plan.available));
  setOutput("fingerprint_digest", plan.fingerprintDigest || "");
  setOutput("fingerprint_path", fingerprintPath);
  setOutput(
    "unit_closure_json",
    JSON.stringify(plan.identity?.unitClosure || []),
  );
  setOutput(
    "input_files_json",
    JSON.stringify((plan.identity?.inputFiles || []).map((entry) => entry.path)),
  );
  setOutput("reason", plan.reason);
}

function writeSummary(plan) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const rows = [
    ["Unit", plan.identity?.unit || actionInput("UNIT_NAME") || "unavailable"],
    ["Fingerprint available", String(plan.available)],
    ["Fingerprint", plan.fingerprintDigest || "unavailable"],
    ["Input files", String(plan.identity?.inputFiles?.length || 0)],
    ["Reason", plan.reason],
  ];
  const markdown = [
    "### Validation evidence fingerprint",
    "",
    "| Field | Value |",
    "| --- | --- |",
    ...rows.map(([label, value]) => `| ${label} | ${String(value).replaceAll("|", "\\|")} |`),
    "",
  ].join("\n");
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
}

function main() {
  const sourceSha = actionInput("SOURCE_SHA");
  const unitName = actionInput("UNIT_NAME");
  const manifestInput = actionInput("MANIFEST_PATH", ".github/validation-impact.json");
  const workingDirectoryInput = actionInput("WORKING_DIRECTORY", ".");
  const setupCommand = actionInput("SETUP_COMMAND");
  const command = actionInput("COMMAND");
  const environmentIdentity = actionInput("ENVIRONMENT_IDENTITY");
  const outputInput = actionInput(
    "OUTPUT_PATH",
    ".artifacts/reusable-workflows/validation-evidence-fingerprint.json",
  );

  let manifestPath = manifestInput;
  let outputPath = "";
  let plan;
  try {
    if (!UNIT_RE.test(unitName)) {
      throw new Error("unit_name contains unsupported characters.");
    }
    assertCheckedOutHead(sourceSha);
    const manifestLocation = resolveInsideRepository(manifestInput, "manifest_path");
    const outputLocation = resolveInsideRepository(outputInput, "output_path");
    const workingDirectory = resolveInsideRepository(
      workingDirectoryInput,
      "working_directory",
      true,
    ).normalized;
    manifestPath = manifestLocation.normalized;
    outputPath = outputLocation.normalized;
    const manifest = parseManifest(
      JSON.parse(fs.readFileSync(manifestLocation.resolved, "utf8")),
    );

    plan = buildFingerprint({
      sourceSha,
      unitName,
      manifestPath,
      manifest,
      workingDirectory,
      setupCommand,
      command,
      environmentIdentity,
    });
    fs.mkdirSync(path.dirname(outputLocation.resolved), { recursive: true });
    fs.writeFileSync(outputLocation.resolved, JSON.stringify(plan, null, 2), "utf8");
  } catch (error) {
    plan = fallbackPlan({
      sourceSha,
      unitName,
      manifestPath,
      reason: `fingerprint-unavailable: ${error instanceof Error ? error.message : String(error)}`,
    });
    try {
      const outputLocation = resolveInsideRepository(outputInput, "output_path");
      outputPath = outputLocation.normalized;
      fs.mkdirSync(path.dirname(outputLocation.resolved), { recursive: true });
      fs.writeFileSync(outputLocation.resolved, JSON.stringify(plan, null, 2), "utf8");
    } catch {
      outputPath = "";
    }
  }

  publishOutputs(plan, outputPath);
  writeSummary(plan);
}

module.exports = {
  buildFingerprint,
  collectUnitClosure,
  fallbackPlan,
  stableUnique,
};

if (require.main === module) {
  main();
}
