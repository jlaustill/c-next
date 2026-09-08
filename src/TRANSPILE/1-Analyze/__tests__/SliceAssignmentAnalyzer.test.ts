import { afterEach, describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import SliceAssignmentAnalyzer from "../SliceAssignmentAnalyzer";

/**
 * #1322. ADR-052's slice rules -- E0858 (what may be sliced), E0859 (the span
 * must fold), E0860 (the span must fit), E0861 (the source must fit) --
 * replacing twelve `ArrayHandlers` throws that smuggled `${line}:0` through
 * their own message text.
 *
 * Every case below is decided from the parse tree and the lexical frames; a
 * const offset or length resolves through the program artifact, which
 * `tests/slice-assignment/` exercises end to end.
 */
const errors = (body: string) => {
  const { tree } = CNextSourceParser.parse(`void f() {\n${body}\n}`);
  return new SliceAssignmentAnalyzer().analyze(tree);
};

const codes = (body: string) => errors(body).map((e) => e.code);

afterEach(() => {
  CodeGenState.reset();
});

describe("SliceAssignmentAnalyzer", () => {
  describe("E0858 -- what can be sliced at all", () => {
    // Each row is a different reason the buffer cannot be sliced, and the
    // `says` column is what distinguishes them -- asserting only the code
    // would let any one of these stand in for the others.
    it.each([
      {
        why: "more than one dimension",
        body: "    u8[4][8] grid;\n    grid[0, 4] <- 1;",
        says: "one-dimensional",
      },
      {
        why: "a float element, which would need type punning",
        body: "    f32[4] samples;\n    samples[0, 4] <- 1;",
        says: "'f32'",
      },
      {
        why: "a bool element, which has a width but no byte meaning",
        body: "    bool[4] flags;\n    flags[0, 1] <- 1;",
        says: "'bool'",
      },
      {
        why: "a dimension that does not fold -- reporting a bound would invent one",
        body: "    u8[BUFFER_SIZE] buf;\n    buf[0, 4] <- 1;",
        says: "Cannot determine the size",
      },
    ])("rejects $why", ({ body, says }) => {
      const [found] = errors(body);
      expect(found.code).toBe("E0858");
      expect(found.message).toContain(says);
    });

    it("names the working form when the buffer is multi-dimensional", () => {
      // The help is the actionable half and is specific to this row.
      const [found] = errors("    u8[4][8] grid;\n    grid[0, 4] <- 1;");
      expect(found.helpText).toContain("grid[index][offset, length]");
    });
  });

  describe("E0859 -- the span must fold at compile time", () => {
    it("rejects a runtime offset and a runtime length, at the right subscript", () => {
      const offset = errors(
        "    u8[8] buf;\n    u8 i <- 0;\n    buf[i, 4] <- 1;",
      );
      expect(offset.map((e) => e.code)).toEqual(["E0859"]);
      expect(offset[0].message).toContain("offset must be a compile-time");

      const length = errors(
        "    u8[8] buf;\n    u8 n <- 4;\n    buf[0, n] <- 1;",
      );
      expect(length.map((e) => e.code)).toEqual(["E0859"]);
      expect(length[0].message).toContain("length must be a compile-time");
    });
  });

  describe("E0860 -- the span must fit the buffer", () => {
    it("rejects a negative offset and a non-positive length", () => {
      expect(codes("    u8[8] buf;\n    buf[-1, 4] <- 1;")).toEqual(["E0860"]);
      expect(codes("    u8[8] buf;\n    buf[0, 0] <- 1;")).toEqual(["E0860"]);
    });

    it("requires the BYTE length to divide by the element size", () => {
      const [found] = errors("    u32[4] words;\n    words[0, 6] <- 1;");
      expect(found.code).toBe("E0860");
      expect(found.message).toContain("multiple of the element size (4 bytes)");
    });

    it("compares the span in ELEMENTS, not bytes", () => {
      // 8 bytes of u32 is two elements, so offset 3 of a 4-element buffer
      // overflows by one -- a byte comparison would have accepted it.
      const [found] = errors("    u32[4] words;\n    words[3, 8] <- 1;");
      expect(found.code).toBe("E0860");
      expect(found.message).toContain("= 5 exceeds buffer capacity(4)");
    });

    it("counts a string's terminator as part of its buffer", () => {
      // `string<8>` is `char[9]`, so offset 8 length 1 is the last slot.
      expect(codes('    string<8> s <- "";\n    s[8, 1] <- 1;')).toEqual([]);
      expect(codes('    string<8> s <- "";\n    s[9, 1] <- 1;')).toEqual([
        "E0860",
      ]);
    });
  });

  describe("E0861 -- the source must fit the slice", () => {
    it("rejects a literal too wide for the slice, unsigned or negative", () => {
      const high = errors("    u8[8] buf;\n    buf[0, 1] <- 256;");
      expect(high.map((e) => e.code)).toEqual(["E0861"]);

      // #1085 review: guarding only the unsigned upper bound let a negative
      // literal of any magnitude through, silently truncated.
      const low = errors("    u8[8] buf;\n    buf[0, 1] <- -129;");
      expect(low.map((e) => e.code)).toEqual(["E0861"]);
    });

    it("accepts a literal at each end of the two's-complement range", () => {
      expect(codes("    u8[8] buf;\n    buf[0, 1] <- 255;")).toEqual([]);
      expect(codes("    u8[8] buf;\n    buf[0, 1] <- -128;")).toEqual([]);
    });

    it("rejects a non-integer source value", () => {
      const [found] = errors(
        "    u8[8] buf;\n    f32 x <- 1.5;\n    buf[0, 4] <- x;",
      );
      expect(found.code).toBe("E0861");
      expect(found.message).toContain("must be an integer value");
    });

    it("rejects copying more bytes than the source holds", () => {
      const [found] = errors(
        "    u8[8] buf;\n    u16 small <- 1;\n    buf[0, 4] <- small;",
      );
      expect(found.code).toBe("E0861");
      expect(found.message).toContain("exceeds the source value width");
    });
  });

  it("stays silent on the forms ADR-052 allows", () => {
    // The control set: a whole-buffer index, a valid integer slice, a valid
    // string slice, and a source exactly as wide as the span. The last one was
    // written as `words[1, 8] <- wide` first, which E0861 correctly rejected --
    // a `u32` holds four bytes, not eight. The control caught the test.
    expect(
      codes(
        [
          "    u8[8] buf;",
          "    u32[4] words;",
          '    string<8> s <- "";',
          "    u32 wide <- 7;",
          "    buf[0] <- 1;",
          "    buf[2, 4] <- 9;",
          "    words[1, 4] <- wide;",
          "    s[0, 4] <- 65;",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});
