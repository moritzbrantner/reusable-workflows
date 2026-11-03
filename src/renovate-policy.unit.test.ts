import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

describe("Renovate dependency update policy", () => {
  test("does not automatically bump the repository's own immutable workflow references", () => {
    const config = JSON.parse(
      readFileSync(new URL("../renovate.json", import.meta.url), "utf8"),
    ) as { packageRules?: Record<string, unknown>[] };

    expect(config.packageRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchManagers: ["github-actions"],
          matchDepNames: ["moritzbrantner/reusable-workflows"],
          enabled: false,
        }),
      ]),
    );
  });
});
