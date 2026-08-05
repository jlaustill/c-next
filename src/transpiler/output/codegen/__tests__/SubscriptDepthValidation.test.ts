/**
 * Issue #1106: indexing a scalar with a second subscript (x[a][b]) is a type
 * error, not a silent bit-index chain (read) / dropped subscript (write).
 *
 * Per ADR-036 each subscript peels one array dimension; per ADR-007 a scalar
 * integer/float may be bit-indexed once. So a base allows at most
 * arrayDimensions + 1 subscript operations. Deeper indexes a non-array value.
 */
import { describe, it, expect, beforeEach } from "vitest";
import Transpiler from "../../../Transpiler";
import MockFileSystem from "../../../__tests__/MockFileSystem";

describe("subscript depth validation (#1106)", () => {
  let mockFs: MockFileSystem;

  beforeEach(() => {
    mockFs = new MockFileSystem();
  });

  const transpileSource = async (source: string) => {
    const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);
    return (await transpiler.transpile({ kind: "source", source })).files[0];
  };

  it("rejects a second subscript on a scalar (write)", async () => {
    const result = await transpileSource(
      "u8 flags <- 0;\nvoid t() { flags[4][3] <- 5; }",
    );
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.errors)).toContain("is not an array");
  });

  it("rejects a second subscript on a scalar (read)", async () => {
    const result = await transpileSource(
      "u8 flags <- 0;\nvoid t() { u8 x <- flags[4][3]; }",
    );
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.errors)).toContain("is not an array");
  });

  it("allows a bit index on an array element: buffer[i][bit]", async () => {
    const result = await transpileSource(
      "u8[16] buffer;\nvoid t() { buffer[2][3] <- true; bool b <- buffer[2][3]; }",
    );
    expect(result.success).toBe(true);
  });

  it("allows a bit range on a scalar: flags[start, width]", async () => {
    const result = await transpileSource(
      "u8 flags <- 0;\nvoid t() { flags[4, 3] <- 5; }",
    );
    expect(result.success).toBe(true);
  });

  it("allows a plain bit index on a scalar: flags[bit]", async () => {
    const result = await transpileSource(
      "u8 flags <- 0;\nvoid t() { flags[3] <- true; bool b <- flags[3]; }",
    );
    expect(result.success).toBe(true);
  });

  /**
   * ADR-016 lets the same variable be reached bare or via `this.`. Both spell
   * the same over-index, so both must be rejected — validating only the bare
   * form would leave the bad code generation reachable through the prefix.
   */
  describe("this.-prefixed access (ADR-016)", () => {
    const SCOPE = (body: string) =>
      `scope Reg {\n  u8 flags <- 0;\n  u8[16] buffer;\n  ${body}\n}`;

    it("rejects a second subscript on a this. scalar (write)", async () => {
      const result = await transpileSource(
        SCOPE("void t() { this.flags[4][3] <- 5; }"),
      );
      expect(result.success).toBe(false);
      expect(JSON.stringify(result.errors)).toContain("is not an array");
    });

    it("rejects a second subscript on a this. scalar (read)", async () => {
      const result = await transpileSource(
        SCOPE("u8 t() { return this.flags[4][3]; }"),
      );
      expect(result.success).toBe(false);
      expect(JSON.stringify(result.errors)).toContain("is not an array");
    });

    it("quotes the source spelling, not the generated symbol", async () => {
      // `Reg_flags[start, width]` would be invalid C-Next, so the diagnostic
      // must say `this.flags` — what the developer actually wrote.
      const result = await transpileSource(
        SCOPE("void t() { this.flags[4][3] <- 5; }"),
      );
      const errors = JSON.stringify(result.errors);
      expect(errors).toContain("this.flags");
      expect(errors).not.toContain("Reg_flags");
    });

    it("allows a bit range on a this. scalar", async () => {
      const result = await transpileSource(
        SCOPE("void t() { this.flags[4, 3] <- 5; }"),
      );
      expect(result.success).toBe(true);
    });

    it("allows arrayDimensions + 1 subscripts on a this. array", async () => {
      const result = await transpileSource(
        SCOPE("void t() { bool b <- this.buffer[2][3]; }"),
      );
      expect(result.success).toBe(true);
    });
  });
});
