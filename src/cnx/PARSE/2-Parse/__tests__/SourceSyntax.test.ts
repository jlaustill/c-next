import { describe, it, expect } from "vitest";
import SourceSyntax from "../SourceSyntax";

describe("SourceSyntax.of (#1991)", () => {
  it("carries the file's comments, for 2.1's MISRA 3.1/3.2 check", () => {
    const syntax = SourceSyntax.of("// leading\nu8 x <- 1; /* trailing */\n");
    expect(syntax.comments.map((comment) => comment.raw)).toEqual([
      "// leading",
      "/* trailing */",
    ]);
  });

  it("carries neither the tree nor its token stream past 1.2", () => {
    const syntax = SourceSyntax.of("u8 x <- 1;\n");
    expect(Object.keys(syntax).sort()).toEqual([
      "comments",
      "declarationCount",
      "formErrors",
      "parseErrors",
      "program",
      "targetDirectives",
    ]);
  });
});
