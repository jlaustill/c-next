import { describe, expect, it } from "vitest";

import Repo from "../utils/Repo";

describe("Repo", () => {
  it("builds the owner/name slug the REST paths are made from", () => {
    // Load-bearing: this string is interpolated into every write path, so a
    // wrong slug writes milestones to a different repository.
    expect(Repo.slug()).toBe("jlaustill/c-next");
  });

  it("names this repository, declared once for every script", () => {
    // `scripts/setup-project.ts` declared the owner separately until #1388, so
    // changing it was a two-file edit.
    expect(Repo.OWNER).toBe("jlaustill");
    expect(Repo.NAME).toBe("c-next");
  });
});
