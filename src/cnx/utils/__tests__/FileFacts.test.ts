import { describe, expect, it } from "vitest";
import type IFileIncludes from "../../PARSE/1-Discover/types/IFileIncludes";
import type IOutputPaths from "../../PARSE/1-Discover/types/IOutputPaths";
import type TRunFacts from "../../PARSE/2-Parse/types/TRunFacts";
import type ICodeGenSymbols from "../../types/ICodeGenSymbols";
import type IProgram from "../../types/IProgram";
import FileFacts from "../FileFacts";

const SYMBOLS = {} as ICodeGenSymbols;
const INCLUDES = {} as IFileIncludes;
const OUTPUTS = {} as IOutputPaths;

const program = {
  codeGenSymbolsFor: (path: string) => (path === "a.cnx" ? SYMBOLS : undefined),
} as unknown as IProgram;

const discovery = {
  includes: new Map([["a.cnx", INCLUDES]]),
  outputs: new Map([["a.cnx", OUTPUTS]]),
} as unknown as TRunFacts;

describe("FileFacts", () => {
  it("returns exactly what 1.4 and 1.1 recorded for a file", () => {
    expect(FileFacts.symbolsFor(program, "a.cnx")).toBe(SYMBOLS);
    expect(FileFacts.includesOf(discovery, "a.cnx")).toBe(INCLUDES);
    expect(FileFacts.outputsOf(discovery, "a.cnx")).toBe(OUTPUTS);
  });

  it("names the file a pass never recorded", () => {
    expect(() => FileFacts.symbolsFor(program, "b.cnx")).toThrow(
      "b.cnx's included",
    );
    expect(() => FileFacts.includesOf(discovery, "b.cnx")).toThrow(
      "records the includes of every file it discovers (missing b.cnx)",
    );
    expect(() => FileFacts.outputsOf(discovery, "b.cnx")).toThrow(
      "names the outputs of every file it discovers (missing b.cnx)",
    );
  });
});
