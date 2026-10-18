import { describe, expect, it } from "vitest";

import Repo from "../utils/Repo";

describe("Repo", () => {
  it("builds the owner/name slug the REST paths are made from", () => {
    // Load-bearing: this string is interpolated into every write path, so a
    // wrong slug writes milestones to a different repository.
    expect(Repo.slug()).toBe("smeltworks/cnx");
  });

  it("names this repository, declared once for every script", () => {
    // `scripts/setup-project.ts` declared the owner separately until #1388, so
    // changing it was a two-file edit. The repository moved to smeltworks/cnx
    // in #2180.
    expect(Repo.OWNER).toBe("smeltworks");
    expect(Repo.NAME).toBe("cnx");
  });
});
