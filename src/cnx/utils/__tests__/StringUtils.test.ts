import { describe, it, expect } from "vitest";
import StringUtils from "../StringUtils";

// ========================================================================
// copyWithNull
// ========================================================================
describe("StringUtils.copyWithNull", () => {
  it("generates strncpy with null termination for simple variable", () => {
    expect(StringUtils.copyWithNull("str", '"hello"', 64)).toBe(
      "(void) strncpy(str, \"hello\", 64); str[64] = '\\0';",
    );
  });

  it("generates strncpy with null termination for struct field", () => {
    expect(StringUtils.copyWithNull("config.name", "value", 32)).toBe(
      "(void) strncpy(config.name, value, 32); config.name[32] = '\\0';",
    );
  });

  it("handles expression as value", () => {
    expect(StringUtils.copyWithNull("buf", "getInput()", 128)).toBe(
      "(void) strncpy(buf, getInput(), 128); buf[128] = '\\0';",
    );
  });
});

// ========================================================================
// concat
// ========================================================================
describe("StringUtils.concat", () => {
  it("generates concatenation without indent", () => {
    const result = StringUtils.concat("result", '"Hello"', '" World"', 64);
    expect(result).toEqual([
      '(void) strncpy(result, "Hello", 64);',
      '(void) strncat(result, " World", 64 - strlen(result));',
      "result[64] = '\\0';",
    ]);
  });

  it("generates concatenation with indent", () => {
    const result = StringUtils.concat("msg", "a", "b", 128, "    ");
    expect(result).toEqual([
      "    (void) strncpy(msg, a, 128);",
      "    (void) strncat(msg, b, 128 - strlen(msg));",
      "    msg[128] = '\\0';",
    ]);
  });

  it("handles variable expressions", () => {
    const result = StringUtils.concat("buf", "prefix", "suffix", 256);
    expect(result[0]).toBe("(void) strncpy(buf, prefix, 256);");
    expect(result[1]).toBe("(void) strncat(buf, suffix, 256 - strlen(buf));");
    expect(result[2]).toBe("buf[256] = '\\0';");
  });
});

// ========================================================================
// substring
// ========================================================================
describe("StringUtils.substring", () => {
  it("generates substring extraction without indent", () => {
    const result = StringUtils.substring("part", "source", "5", 10);
    expect(result).toEqual([
      "(void) strncpy(part, source + 5, 10);",
      "part[10] = '\\0';",
    ]);
  });

  it("generates substring extraction with indent", () => {
    const result = StringUtils.substring("sub", "str", "offset", 20, "  ");
    expect(result).toEqual([
      "  (void) strncpy(sub, str + offset, 20);",
      "  sub[20] = '\\0';",
    ]);
  });

  it("handles expression as start position", () => {
    const result = StringUtils.substring("out", "input", "i * 2", 8);
    expect(result[0]).toBe("(void) strncpy(out, input + i * 2, 8);");
  });
});

// ========================================================================
// literalLength
// ========================================================================
describe("StringUtils.literalLength", () => {
  it("counts simple string without escapes", () => {
    expect(StringUtils.literalLength('"hello"')).toBe(5);
  });

  it("counts empty string", () => {
    expect(StringUtils.literalLength('""')).toBe(0);
  });

  it("counts newline escape as 1 character", () => {
    expect(StringUtils.literalLength('"hello\\n"')).toBe(6);
  });

  it("counts tab escape as 1 character", () => {
    expect(StringUtils.literalLength('"a\\tb"')).toBe(3);
  });

  it("counts backslash escape as 1 character", () => {
    expect(StringUtils.literalLength('"a\\\\b"')).toBe(3);
  });

  it("counts quote escape as 1 character", () => {
    expect(StringUtils.literalLength('"say \\"hi\\""')).toBe(8);
  });

  it("counts multiple escapes correctly", () => {
    expect(StringUtils.literalLength('"\\n\\t\\r"')).toBe(3);
  });

  it("handles mixed content", () => {
    expect(StringUtils.literalLength('"line1\\nline2"')).toBe(11);
  });
});
