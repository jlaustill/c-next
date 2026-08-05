/**
 * Issue #1106: indexing a scalar with a second subscript (x[a][b]) is a type
 * error, not a silent bit-index chain (read) / dropped subscript (write).
 *
 * Per ADR-036 each subscript peels one array dimension; per ADR-007 a scalar
 * integer/float may be bit-indexed once. So a base allows at most
 * arrayDimensions + 1 subscript operations. Deeper indexes a non-array value.
 *
 * Issue #1115: ADR-016 lets the same variable be reached bare, via `this.` or
 * via `global.`. All three spell the same over-index, so the tables below run
 * each rule against every spelling — validating only the bare form once left
 * the bad code generation reachable through the prefixes.
 */
import { describe, it, expect, beforeEach } from "vitest";
import Transpiler from "../../../Transpiler";
import MockFileSystem from "../../../__tests__/MockFileSystem";

/** Wrap a body in a scope that owns a scalar and an array member. */
const scoped = (body: string): string =>
  `scope Reg {\n  u8 flags <- 0;\n  u8[16] buffer;\n  ${body}\n}`;

/** A global scalar/array plus a scope to reference them from. */
const withGlobals = (body: string): string =>
  `u8 globalFlags <- 0;\nu8[16] globalBuffer;\nscope Reg {\n  ${body}\n}`;

const REJECTED = [
  {
    name: "a second subscript on a scalar (write)",
    source: "u8 flags <- 0;\nvoid t() { flags[4][3] <- 5; }",
  },
  {
    name: "a second subscript on a scalar (read)",
    source: "u8 flags <- 0;\nvoid t() { u8 x <- flags[4][3]; }",
  },
  {
    name: "a second subscript on a this. scalar (write)",
    source: scoped("void t() { this.flags[4][3] <- 5; }"),
  },
  {
    name: "a second subscript on a this. scalar (read)",
    source: scoped("u8 t() { return this.flags[4][3]; }"),
  },
  {
    name: "a second subscript on a global. scalar (write)",
    source: withGlobals("void t() { global.globalFlags[4][3] <- 5; }"),
  },
  {
    name: "a second subscript on a global. scalar (read)",
    source: withGlobals("u8 t() { return global.globalFlags[4][3]; }"),
  },
];

const ACCEPTED = [
  {
    name: "a bit index on an array element: buffer[i][bit]",
    source:
      "u8[16] buffer;\nvoid t() { buffer[2][3] <- true; bool b <- buffer[2][3]; }",
  },
  {
    name: "a bit range on a scalar: flags[start, width]",
    source: "u8 flags <- 0;\nvoid t() { flags[4, 3] <- 5; }",
  },
  {
    name: "a plain bit index on a scalar: flags[bit]",
    source:
      "u8 flags <- 0;\nvoid t() { flags[3] <- true; bool b <- flags[3]; }",
  },
  {
    name: "a bit range on a this. scalar",
    source: scoped("void t() { this.flags[4, 3] <- 5; }"),
  },
  {
    name: "arrayDimensions + 1 subscripts on a this. array",
    source: scoped("void t() { bool b <- this.buffer[2][3]; }"),
  },
  {
    name: "a bit range on a global. scalar",
    source: withGlobals("void t() { global.globalFlags[4, 3] <- 5; }"),
  },
  {
    name: "arrayDimensions + 1 subscripts on a global. array",
    source: withGlobals("void t() { global.globalBuffer[2][3] <- true; }"),
  },
];

describe("subscript depth validation (#1106)", () => {
  let mockFs: MockFileSystem;

  beforeEach(() => {
    mockFs = new MockFileSystem();
  });

  const transpileSource = async (source: string) => {
    const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);
    return (await transpiler.transpile({ kind: "source", source })).files[0];
  };

  it.each(REJECTED)("rejects $name", async ({ source }) => {
    const result = await transpileSource(source);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.errors)).toContain("is not an array");
  });

  it.each(ACCEPTED)("allows $name", async ({ source }) => {
    const result = await transpileSource(source);
    expect(result.success).toBe(true);
  });

  it("quotes the source spelling, not the resolved symbol", async () => {
    // `Reg_flags` does resolve as a bare name, but nobody writes it — echoing
    // it back would read as a different variable than the one at fault.
    const result = await transpileSource(
      scoped("void t() { this.flags[4][3] <- 5; }"),
    );
    const errors = JSON.stringify(result.errors);
    expect(errors).toContain("this.flags");
    expect(errors).not.toContain("Reg_flags");
  });
});
