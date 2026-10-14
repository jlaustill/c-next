import { describe, expect, it } from "vitest";
import type IAnalyzedFile from "../../../types/IAnalyzedFile";
import AnalyzedFiles from "../AnalyzedFiles";
import type IAnalysis from "../types/IAnalysis";

const ANALYZED = {} as IAnalyzedFile;

const analysis = {
  files: new Map([["a.cnx", ANALYZED]]),
} as unknown as IAnalysis;

describe("AnalyzedFiles", () => {
  it("returns exactly what 2.1 kept of a file", () => {
    expect(AnalyzedFiles.fileOf(analysis, "a.cnx")).toBe(ANALYZED);
  });

  it("names the file 2.1 never kept", () => {
    expect(() => AnalyzedFiles.fileOf(analysis, "b.cnx")).toThrow(
      "keeps every file that produces output (missing b.cnx)",
    );
  });
});
