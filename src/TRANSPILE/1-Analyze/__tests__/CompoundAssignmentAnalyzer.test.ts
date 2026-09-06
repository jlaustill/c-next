import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import CompoundAssignmentAnalyzer from "../CompoundAssignmentAnalyzer";

/**
 * #1322. A compound operator (`+<-`, `|<-`, …) is a read-modify-write, and
 * C-Next only implements it where the target is a whole storage location. On a
 * bit index, a bit range, a slice, a bitmap field or a string it is rejected.
 *
 * This was **six** throws with four message variants -- `AccessPatternHandlers`,
 * `BitAccessHandlers`, `AssignmentHandlerUtils`, `BitmapHandlers`,
 * `StringHandlers`, `ArrayHandlers` -- and `validateNotCompound` was defined
 * twice, verbatim, in two of them. The largest duplicate group in the audit.
 *
 * ## The distinction that makes it a 2.1 rule rather than a syntactic one
 *
 * `arr[0] +<- 2` is ACCEPTED and `flags[0] +<- 1` is REJECTED. The syntax is
 * identical; what differs is whether the base is an array. Probed, not assumed.
 *
 * So the rule needs to know a declaration's ARRAY-NESS, which is exactly what
 * `IDeclaredVar.dimensions` records -- and why this family could not move before
 * the keystone commit.
 */
const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new CompoundAssignmentAnalyzer().analyze(tree);
};

const inMain = (body: string): string =>
  `u32 main() {\n${body}\n    return 0;\n}`;

describe("CompoundAssignmentAnalyzer", () => {
  it("rejects a compound operator on a bit index of a scalar", () => {
    const found = errors(inMain("    u32 flags <- 0;\n    flags[0] +<- 1;"));
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0857");
    expect(found[0].message).toContain("bit");
  });

  it("accepts the same syntax on an array element", () => {
    // THE control the whole rule turns on. `arr[0]` and `flags[0]` are the same
    // production; only the declaration tells them apart. A check that keyed on
    // syntax alone would reject this, and it is ordinary C-Next.
    expect(errors(inMain("    u32[4] arr;\n    arr[0] +<- 2;"))).toEqual([]);
  });

  it("rejects a bit range, whatever the base", () => {
    // Two subscript expressions is a range or a slice; neither is a single
    // storage location, so the base's array-ness does not rescue it.
    expect(
      errors(inMain("    u32 flags <- 0;\n    flags[0, 4] +<- 3;")),
    ).toHaveLength(1);
    expect(errors(inMain("    u8[8] buf;\n    buf[0, 4] +<- 1;"))).toHaveLength(
      1,
    );
  });

  it("rejects a compound operator on a string", () => {
    const found = errors(inMain('    string<8> s <- "hi";\n    s +<- "x";'));
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain("string");
  });

  it("accepts a plain assignment to any of them", () => {
    // The rule is about the OPERATOR. Every target above is fine with `<-`.
    expect(
      errors(
        inMain(
          [
            "    u32 flags <- 0;",
            "    flags[0] <- true;",
            "    flags[0, 4] <- 5;",
            '    string<8> s <- "hi";',
            '    s <- "bye";',
          ].join("\n"),
        ),
      ),
    ).toEqual([]);
  });

  it("accepts a compound operator on a plain scalar and a struct field", () => {
    const source = [
      "struct Point { u32 x; u32 y; }",
      "u32 main() {",
      "    u32 n <- 0;",
      "    n +<- 1;",
      "    Point p;",
      "    p.x <- 1;",
      "    p.x +<- 2;",
      "    return 0;",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("reports each offending assignment, not just the first", () => {
    const found = errors(
      inMain("    u32 flags <- 0;\n    flags[0] +<- 1;\n    flags[1] +<- 1;"),
    );
    expect(found).toHaveLength(2);
  });

  it("says nothing about a base it cannot resolve", () => {
    // An undeclared name is another diagnostic's to report, and this must not
    // guess. The first version returned `declared?.stringCapacity !== null`,
    // which is TRUE for an unresolved base -- `undefined !== null` -- so it
    // would have called every undeclared target a string.
    expect(errors(inMain("    undeclared +<- 1;"))).toEqual([]);
  });

  it("accepts a subscript on a struct field that is an array", () => {
    // REGRESSION. The first version asked only the BASE variable's array-ness,
    // so `bytes.data[0] +<- 5` -- where `bytes` is a struct and `data` is its
    // `u8[8]` field -- was reported as a bit index. Three real fixtures caught
    // it. The subscript's shape comes from the field, not the variable.
    //
    // Struct field dimensions come from `CodeGenState.symbols`, which is not
    // populated in a unit test, so this asserts the CONSERVATIVE half of the
    // rule: an unestablished shape never rejects. `tests/array-struct-member/`
    // exercises the resolved half end to end.
    const source = [
      "struct Buf { u8[8] data; }",
      "u32 main() {",
      "    Buf b;",
      "    b.data[0] +<- 5;",
      "    return 0;",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("carries a real position", () => {
    const [found] = errors(inMain("    u32 flags <- 0;\n    flags[0] +<- 1;"));
    expect(found.line).toBe(3);
    expect(found.column).toBeGreaterThan(0);
  });
});
