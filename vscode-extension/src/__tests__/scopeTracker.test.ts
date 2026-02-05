import { describe, it, expect } from "vitest";
import ScopeTracker from "../scopeTracker";

const SAMPLE_SOURCE = `
u32 globalVar;

scope Teensy4 {
  u32 pin;

  public void setup() {
    pin <- 13;
  }

  public void loop() {
    // blink
  }
}

void globalFunc() {
  u32 x <- 1;
}
`.trim();

describe("ScopeTracker.getCurrentScope", () => {
  it("returns null at global level (before scope)", () => {
    expect(ScopeTracker.getCurrentScope(SAMPLE_SOURCE, 0)).toBeNull();
  });

  it("returns scope name when inside a scope block", () => {
    // Line 3 is "scope Teensy4 {", line 4 is "  u32 pin;"
    expect(ScopeTracker.getCurrentScope(SAMPLE_SOURCE, 4)).toBe("Teensy4");
  });

  it("returns scope name when inside a nested function within scope", () => {
    // Line 6 (0-indexed) is "    pin <- 13;" inside setup()
    expect(ScopeTracker.getCurrentScope(SAMPLE_SOURCE, 6)).toBe("Teensy4");
  });

  it("returns null after scope closes", () => {
    // Line 14 (0-indexed) is "void globalFunc() {"
    expect(ScopeTracker.getCurrentScope(SAMPLE_SOURCE, 14)).toBeNull();
  });
});

describe("ScopeTracker.getCurrentFunction", () => {
  it("returns null at global level", () => {
    expect(ScopeTracker.getCurrentFunction(SAMPLE_SOURCE, 0)).toBeNull();
  });

  it("returns function name when inside a function", () => {
    // Line 6 (0-indexed) is "    pin <- 13;" inside setup()
    expect(ScopeTracker.getCurrentFunction(SAMPLE_SOURCE, 6)).toBe("setup");
  });

  it("returns function name for global functions", () => {
    // Line 15 (0-indexed) is "  u32 x <- 1;" inside globalFunc()
    expect(ScopeTracker.getCurrentFunction(SAMPLE_SOURCE, 15)).toBe(
      "globalFunc",
    );
  });

  it("returns null between functions", () => {
    // Line 4 is "  u32 pin;" - inside scope but not inside a function
    expect(ScopeTracker.getCurrentFunction(SAMPLE_SOURCE, 4)).toBeNull();
  });
});

describe("ScopeTracker handles comments", () => {
  it("ignores braces inside comments", () => {
    const source = `scope MyScope {
  // This { has braces } in a comment
  u32 field;
}`;
    expect(ScopeTracker.getCurrentScope(source, 2)).toBe("MyScope");
  });

  it("ignores scope keywords inside comments", () => {
    const source = `// scope FakeScope {
u32 globalVar;`;
    expect(ScopeTracker.getCurrentScope(source, 1)).toBeNull();
  });
});
