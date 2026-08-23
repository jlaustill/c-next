/**
 * Issue #1143: Folding per-file requirements into a project-level view.
 *
 * A static matrix can only say what C-Next might need. Merging what each file
 * recorded is what lets the transpiler answer what THIS project needs, and
 * point at the lines responsible.
 */
import { describe, it, expect } from "vitest";
import RequirementAggregator from "../RequirementAggregator";
import type IFileResult from "../../transpiler/types/IFileResult";
import type IRecordedRequirement from "../../transpiler/types/IRecordedRequirement";

function fileWith(
  sourcePath: string,
  requirements: readonly IRecordedRequirement[],
): IFileResult {
  return {
    sourcePath,
    code: "",
    success: true,
    errors: [],
    declarationCount: 0,
    requirements,
  };
}

describe("RequirementAggregator.merge", () => {
  it("returns nothing for no files", () => {
    expect(RequirementAggregator.merge([])).toEqual([]);
  });

  it("tolerates a file that recorded nothing", () => {
    const file: IFileResult = {
      sourcePath: "a.cnx",
      code: "",
      success: true,
      errors: [],
      declarationCount: 0,
    };
    expect(RequirementAggregator.merge([file])).toEqual([]);
  });

  it("unions the same requirement across files, keeping every site", () => {
    const merged = RequirementAggregator.merge([
      fileWith("a.cnx", [
        { key: "critical-arm-gnu", sites: [{ sourcePath: "a.cnx", line: 4 }] },
      ]),
      fileWith("b.cnx", [
        { key: "critical-arm-gnu", sites: [{ sourcePath: "b.cnx", line: 9 }] },
      ]),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.key).toBe("critical-arm-gnu");
    expect(merged[0]!.sites).toEqual([
      { sourcePath: "a.cnx", line: 4 },
      { sourcePath: "b.cnx", line: 9 },
    ]);
  });

  it("does not repeat a site recorded by two files", () => {
    // A header included by several files can record the same location more
    // than once; the report should not list it twice.
    const merged = RequirementAggregator.merge([
      fileWith("a.cnx", [
        {
          key: "float-assert-c11",
          sites: [{ sourcePath: "shared.cnx", line: 3 }],
        },
      ]),
      fileWith("b.cnx", [
        {
          key: "float-assert-c11",
          sites: [{ sourcePath: "shared.cnx", line: 3 }],
        },
      ]),
    ]);

    expect(merged[0]!.sites).toEqual([{ sourcePath: "shared.cnx", line: 3 }]);
  });

  it("treats two lines in one file as distinct sites", () => {
    const merged = RequirementAggregator.merge([
      fileWith("a.cnx", [
        {
          key: "float-assert-c11",
          sites: [
            { sourcePath: "a.cnx", line: 3 },
            { sourcePath: "a.cnx", line: 7 },
          ],
        },
      ]),
    ]);

    expect(merged[0]!.sites).toHaveLength(2);
  });

  it("keeps distinct requirements separate", () => {
    const merged = RequirementAggregator.merge([
      fileWith("a.cnx", [
        { key: "baseline-c", sites: [] },
        { key: "float-assert-c11", sites: [{ sourcePath: "a.cnx", line: 2 }] },
      ]),
    ]);
    expect(merged.map((entry) => entry.key).sort()).toEqual([
      "baseline-c",
      "float-assert-c11",
    ]);
  });

  it("orders sites by path then line, so reports do not churn", () => {
    const merged = RequirementAggregator.merge([
      fileWith("x", [
        {
          key: "critical-arm-gnu",
          sites: [
            { sourcePath: "z.cnx", line: 1 },
            { sourcePath: "a.cnx", line: 9 },
            { sourcePath: "a.cnx", line: 2 },
          ],
        },
      ]),
    ]);

    expect(merged[0]!.sites).toEqual([
      { sourcePath: "a.cnx", line: 2 },
      { sourcePath: "a.cnx", line: 9 },
      { sourcePath: "z.cnx", line: 1 },
    ]);
  });

  it("sorts a null line ahead of a numbered one in the same file", () => {
    const merged = RequirementAggregator.merge([
      fileWith("x", [
        {
          key: "critical-arm-gnu",
          sites: [
            { sourcePath: "a.cnx", line: 5 },
            { sourcePath: "a.cnx", line: null },
          ],
        },
      ]),
    ]);

    expect(merged[0]!.sites[0]).toEqual({ sourcePath: "a.cnx", line: null });
  });
});
