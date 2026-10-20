import { describe, it, expect } from "vitest";
import IncludePath from "../IncludePath";

// #2272/#1473: a quoted include resolves from the including file's directory
describe("IncludePath.relative", () => {
  it("names a file beside the directory by its basename", () => {
    expect(IncludePath.relative("/out/lib", "/out/lib/a.h")).toBe("a.h");
  });

  it("climbs out of the directory with forward slashes", () => {
    expect(IncludePath.relative("/out/src/lib", "/out/include/lib/a.h")).toBe(
      "../../include/lib/a.h",
    );
  });
});
