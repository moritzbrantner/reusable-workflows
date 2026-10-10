import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parse } from "yaml";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const workflow = parse(source(".github/workflows/agent-ci-environment-pilot.yml"));

test("environment experiment cannot silently become a required or callable capability", () => {
  expect(workflow.name).toBe("Agent CI Environment Pilot");
  expect(workflow.on).toHaveProperty("workflow_dispatch");
  expect(workflow.on).not.toHaveProperty("schedule");
  expect(workflow.on).not.toHaveProperty("workflow_call");
  expect(workflow.on.push.branches).toEqual(["main"]);
  expect(workflow.on.push.paths).toEqual([
    ".github/workflows/agent-ci-environment-pilot.yml",
    "experiments/ci-environments/**",
  ]);
  for (const job of Object.values(workflow.jobs) as Array<{ "runs-on": string; permissions: object }>) {
    expect(job["runs-on"]).toBe("ubuntu-24.04");
    expect(job.permissions).toEqual({ contents: "read" });
  }
});

test("four candidate jobs exercise one smoke, with a real isolated NixOS guest", () => {
  expect(Object.keys(workflow.jobs).sort()).toEqual([
    "devcontainer",
    "nixos-vm",
    "ubuntu",
    "ubuntu-nix",
  ]);
  const jobs = JSON.stringify(workflow.jobs);
  expect(jobs).toContain("smoke.mjs");
  expect(jobs).toContain("fixture.json");
  expect(jobs).toContain("smoke.mjs fixture.json debian 24");
  expect(jobs).toContain("fixture.json ubuntu 24");
  expect(workflow.jobs["nixos-vm"].if).toContain("github.event_name != 'pull_request'");
  const flake = source("experiments/ci-environments/flake.nix");
  expect(flake).toContain("pkgs.testers.runNixOSTest");
  expect(flake).toContain('machine.wait_for_unit("multi-user.target")');
  expect(flake).toContain("fixture.json} nixos 24");
  expect(flake).toContain("pkgs.nodejs_24");
});

test("the prebuilt container and Nixpkgs inputs are immutable", () => {
  expect(workflow.jobs.devcontainer.env.PILOT_IMAGE).toMatch(
    /^mcr\.microsoft\.com\/devcontainers\/javascript-node@sha256:[0-9a-f]{64}$/,
  );
  expect(workflow.jobs.devcontainer.steps.some((step: { run?: string }) =>
    step.run?.includes('docker pull "$PILOT_IMAGE"'),
  )).toBe(true);
  const lock = JSON.parse(source("experiments/ci-environments/flake.lock"));
  expect(lock.nodes.nixpkgs.locked.rev).toBe("4975466d324710c576dc11ad614684e6bd8cad8e");
  expect(source("experiments/ci-environments/flake.nix")).toContain(lock.nodes.nixpkgs.locked.rev);
});

test("smoke fixture is deterministic and declares expected dependency order", () => {
  const fixture = JSON.parse(source("experiments/ci-environments/fixture.json"));
  expect(fixture.schemaVersion).toBe(1);
  expect(fixture.expectedOrder).toEqual(["prepare", "inspect", "validate", "report"]);
  expect(fixture.requested).toEqual(["inspect", "report"]);
});
