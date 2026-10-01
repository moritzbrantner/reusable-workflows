import { describe, expect, test } from "vitest";

import catalog from "../profiles/workflow-profiles.json";

describe("workflow profiles", () => {
  test("defines a small canonical profile set", () => {
    expect(Object.keys(catalog.profiles).sort()).toEqual([
      "application",
      "engine-lab",
      "library",
      "service",
      "template",
    ]);
  });

  test("requires validation and bounds enabled workflow topology", () => {
    for (const [profileId, profile] of Object.entries(catalog.profiles)) {
      expect(profile.roles.validate, `${profileId} must define validate`).toEqual({
        path: ".github/workflows/validate.yml",
        required: true,
      });
      expect(profile.maxEnabledRoles).toBeGreaterThanOrEqual(1);
      expect(profile.maxEnabledRoles).toBeLessThanOrEqual(4);
      expect(Object.keys(profile.roles).length).toBeLessThanOrEqual(profile.maxEnabledRoles);
    }
  });

  test("uses unique canonical workflow paths inside each profile", () => {
    for (const profile of Object.values(catalog.profiles)) {
      const paths = Object.values(profile.roles).map((role) => role.path);
      expect(new Set(paths).size).toBe(paths.length);
      expect(paths.every((path) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(path))).toBe(true);
    }
  });

  test("keeps globally prunable legacy paths outside canonical roles", () => {
    const canonical = new Set(
      Object.values(catalog.profiles).flatMap((profile) =>
        Object.values(profile.roles).map((role) => role.path),
      ),
    );

    expect(new Set(catalog.legacyWorkflowPaths).size).toBe(catalog.legacyWorkflowPaths.length);
    for (const path of catalog.legacyWorkflowPaths) {
      expect(canonical.has(path), `${path} must not be both canonical and legacy`).toBe(false);
    }
  });
});
