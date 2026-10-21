import { describe, expect, it } from "vitest";

import CnxSourceParser from "../CnxSourceParser";

/** #1728, #1991: E0912 is 1.2's, reported with the file's parse errors */
const e0912 = (source: string) =>
  CnxSourceParser.parse(source).formErrors.filter((e) =>
    e.message.startsWith("error[E0912]"),
  );

describe("LiteralForm (E0912)", () => {
  it("reports a leading-zero decimal at its token", () => {
    const found = e0912("u8 x <- 010;\n");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ line: 1, column: 8 });
    expect(found[0].message).toContain("'010'");
  });

  it("reports a suffixed decimal", () => {
    expect(e0912("u8 x <- 010u8;\n")).toHaveLength(1);
  });

  it("leaves zero, hex, binary and plain decimals alone", () => {
    expect(
      e0912("u8 a <- 0;\nu8 b <- 0x10;\nu8 c <- 0b10;\nu8 d <- 10;\n"),
    ).toEqual([]);
  });

  it("does not read a literal in a comment", () => {
    expect(e0912("// 010\nu8 x <- 1;\n")).toEqual([]);
  });
});
