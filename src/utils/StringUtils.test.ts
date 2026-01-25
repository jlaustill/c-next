import { describe, it, expect } from "vitest";
import StringUtils from "./StringUtils";

// ========================================================================
// copyWithNull
// ========================================================================
describe("StringUtils.copyWithNull", () => {
  it("generates strncpy with null termination for simple variable", () => {
    expect(StringUtils.copyWithNull("str", '"hello"', 64)).toBe(
      "strncpy(str, \"hello\", 64); str[64] = '\\0';",
    );
  });

  it("generates strncpy with null termination for struct field", () => {
    expect(StringUtils.copyWithNull("config.name", "value", 32)).toBe(
      "strncpy(config.name, value, 32); config.name[32] = '\\0';",
    );
  });

  it("handles expression as value", () => {
    expect(StringUtils.copyWithNull("buf", "getInput()", 128)).toBe(
      "strncpy(buf, getInput(), 128); buf[128] = '\\0';",
    );
  });
});

// ========================================================================
// copy
// ========================================================================
describe("StringUtils.copy", () => {
  it("generates strncpy without null termination", () => {
    expect(StringUtils.copy("arr[0]", '"first"', 64)).toBe(
      'strncpy(arr[0], "first", 64);',
    );
  });

  it("handles complex target expressions", () => {
    expect(StringUtils.copy("data.names[i]", "source", 32)).toBe(
      "strncpy(data.names[i], source, 32);",
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
      'strncpy(result, "Hello", 64);',
      'strncat(result, " World", 64 - strlen(result));',
      "result[64] = '\\0';",
    ]);
  });

  it("generates concatenation with indent", () => {
    const result = StringUtils.concat("msg", "a", "b", 128, "    ");
    expect(result).toEqual([
      "    strncpy(msg, a, 128);",
      "    strncat(msg, b, 128 - strlen(msg));",
      "    msg[128] = '\\0';",
    ]);
  });

  it("handles variable expressions", () => {
    const result = StringUtils.concat("buf", "prefix", "suffix", 256);
    expect(result[0]).toBe("strncpy(buf, prefix, 256);");
    expect(result[1]).toBe("strncat(buf, suffix, 256 - strlen(buf));");
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
      "strncpy(part, source + 5, 10);",
      "part[10] = '\\0';",
    ]);
  });

  it("generates substring extraction with indent", () => {
    const result = StringUtils.substring("sub", "str", "offset", 20, "  ");
    expect(result).toEqual([
      "  strncpy(sub, str + offset, 20);",
      "  sub[20] = '\\0';",
    ]);
  });

  it("handles expression as start position", () => {
    const result = StringUtils.substring("out", "input", "i * 2", 8);
    expect(result[0]).toBe("strncpy(out, input + i * 2, 8);");
  });
});

// ========================================================================
// copyToStructField
// ========================================================================
describe("StringUtils.copyToStructField", () => {
  it("generates strncpy for struct.field with null termination", () => {
    expect(StringUtils.copyToStructField("config", "name", '"test"', 32)).toBe(
      "strncpy(config.name, \"test\", 32); config.name[32] = '\\0';",
    );
  });

  it("handles nested struct path in structName", () => {
    expect(StringUtils.copyToStructField("a.b", "c", "val", 16)).toBe(
      "strncpy(a.b.c, val, 16); a.b.c[16] = '\\0';",
    );
  });
});

// ========================================================================
// copyToArrayElement
// ========================================================================
describe("StringUtils.copyToArrayElement", () => {
  it("generates strncpy for array element", () => {
    expect(StringUtils.copyToArrayElement("names", "0", '"first"', 64)).toBe(
      'strncpy(names[0], "first", 64);',
    );
  });

  it("handles variable index", () => {
    expect(StringUtils.copyToArrayElement("arr", "i", "value", 32)).toBe(
      "strncpy(arr[i], value, 32);",
    );
  });

  it("handles expression index", () => {
    expect(StringUtils.copyToArrayElement("buf", "idx + 1", "src", 128)).toBe(
      "strncpy(buf[idx + 1], src, 128);",
    );
  });
});

// ========================================================================
// copyToStructFieldArrayElement
// ========================================================================
describe("StringUtils.copyToStructFieldArrayElement", () => {
  it("generates strncpy for struct.field[index]", () => {
    expect(
      StringUtils.copyToStructFieldArrayElement(
        "config",
        "names",
        "0",
        '"value"',
        64,
      ),
    ).toBe('strncpy(config.names[0], "value", 64);');
  });

  it("handles variable index", () => {
    expect(
      StringUtils.copyToStructFieldArrayElement(
        "data",
        "items",
        "i",
        "src",
        32,
      ),
    ).toBe("strncpy(data.items[i], src, 32);");
  });

  it("handles nested struct path", () => {
    expect(
      StringUtils.copyToStructFieldArrayElement(
        "app.settings",
        "labels",
        "idx",
        "text",
        128,
      ),
    ).toBe("strncpy(app.settings.labels[idx], text, 128);");
  });
});
