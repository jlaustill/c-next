import { describe, expect, it } from "vitest";

import AdrIndependence from "../adr-independence/AdrIndependence";

const VOCABULARY = new Set(["CodeGenerator", "SymbolTable"]);

function scan(markdown: string) {
  return AdrIndependence.scanDocument("adr-999-x.md", markdown, VOCABULARY);
}

describe("AdrIndependence.scanDocument", () => {
  it.each([
    ["typescript", "```typescript\nconst a = 1;\n```"],
    ["javascript", "```javascript\nconst a = 1;\n```"],
    ["json", '```json\n{"a": 1}\n```'],
    ["yaml", "```yaml\na: 1\n```"],
    ["bash", "```bash\nnpm run build\n```"],
  ])("flags a %s block", (_language, markdown) => {
    expect(scan(markdown).map((v) => v.kind)).toEqual(["fence"]);
  });

  it.each([
    ["cnx", "```cnx\nu8 x <- 1;\n```"],
    ["c", "```c\nuint8_t x = 1;\n```"],
    ["cpp", "```cpp\nuint8_t x = 1;\n```"],
    ["rust", "```rust\nlet x = 1;\n```"],
    ["ada", "```ada\nX : Integer := 1;\n```"],
  ])("allows a %s block", (_language, markdown) => {
    expect(scan(markdown)).toEqual([]);
  });

  it("allows a plain EBNF production in an antlr block", () => {
    expect(scan("```antlr\nenumMember\n    : IDENTIFIER\n    ;\n```")).toEqual(
      [],
    );
  });

  it.each([
    ["skip", "```antlr\nWS : ' ' -> skip ;\n```"],
    ["channel", "```antlr\nC : '//' -> channel(HIDDEN) ;\n```"],
  ])("flags the ANTLR-only action %s", (_action, markdown) => {
    expect(scan(markdown).map((v) => v.kind)).toEqual(["directive"]);
  });

  it.each([
    ["src/transpiler/Transpiler.ts"],
    ["scripts/adr-matrix.ts"],
    ["src/utils/cache/CacheManager.js"],
  ])("flags the source path %s", (path) => {
    const [violation] = scan(`Resolved in \`${path}\` today.`);
    expect(violation).toMatchObject({ kind: "path", detail: path });
  });

  it("flags a transpiler identifier in prose", () => {
    expect(scan("The CodeGenerator emits this.")).toMatchObject([
      { kind: "identifier", detail: "CodeGenerator" },
    ]);
  });

  it("flags a transpiler identifier used as a section heading", () => {
    // The shape a hand audit missed in eight ADRs (#1403).
    expect(scan("### CodeGenerator").map((v) => v.kind)).toEqual([
      "identifier",
    ]);
  });

  it("reports the line a violation is on", () => {
    const [violation] = scan("intro\n\nThe SymbolTable owns it.");
    expect(violation.line).toBe(3);
  });

  it("does not flag ordinary prose or a short capitalized word", () => {
    expect(scan("A Point struct is Data, not a Register.")).toEqual([]);
  });

  describe("survives-rewrite marker", () => {
    it("suppresses a block claimed with a reason", () => {
      const markdown =
        "<!-- survives-rewrite: how Rust handles this -->\n```typescript\nconst a = 1;\n```";
      expect(scan(markdown)).toEqual([]);
    });

    it("suppresses across blank lines between marker and block", () => {
      const markdown =
        "<!-- survives-rewrite: prior art -->\n\n```typescript\nconst a = 1;\n```";
      expect(scan(markdown)).toEqual([]);
    });

    // Negative controls: the marker must not become a blanket mute.
    it("does NOT suppress without a reason", () => {
      const markdown = "<!-- survives-rewrite: -->\n```typescript\nx\n```";
      expect(scan(markdown).map((v) => v.kind)).toEqual(["fence"]);
    });

    it("does NOT suppress a block it is not adjacent to", () => {
      const markdown =
        "<!-- survives-rewrite: prior art -->\nprose in between\n```typescript\nx\n```";
      expect(scan(markdown).map((v) => v.kind)).toEqual(["fence"]);
    });

    it("does NOT suppress the block after the one it claims", () => {
      const markdown =
        "<!-- survives-rewrite: prior art -->\n```rust\nlet x = 1;\n```\n\n```typescript\nx\n```";
      expect(scan(markdown).map((v) => v.kind)).toEqual(["fence"]);
    });

    it("does NOT suppress a source path outside a fence", () => {
      const markdown =
        "<!-- survives-rewrite: prior art -->\n```rust\nlet x = 1;\n```\nSee `src/a/B.ts`.";
      expect(scan(markdown).map((v) => v.kind)).toEqual(["path"]);
    });
  });
});

describe("AdrIndependence.vocabulary", () => {
  const names = AdrIndependence.vocabulary(process.cwd());

  it("collects real transpiler type names", () => {
    expect(names.has("CodeGenerator")).toBe(true);
    expect(names.has("SymbolTable")).toBe(true);
  });

  it("excludes names too short or too plain to be unambiguous", () => {
    for (const name of names) {
      expect(name.length).toBeGreaterThanOrEqual(
        AdrIndependence.MIN_IDENTIFIER_LENGTH,
      );
      expect(name).toMatch(AdrIndependence.IDENTIFIER_SHAPE);
    }
  });
});
