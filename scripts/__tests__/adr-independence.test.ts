import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

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

describe("review findings on PR #1405", () => {
  // Each of these failed against the implementation as first written.

  it.each([["tsx"], ["mts"], ["cts"], ["mjs"], ["cjs"], ["jsonc"], ["toml"]])(
    "flags a %s block, which the first fence list missed",
    (language) => {
      expect(scan("```" + language + "\nx\n```").map((v) => v.kind)).toEqual([
        "fence",
      ]);
    },
  );

  it("flags a fence that is opened and never closed", () => {
    // Previously returned [] -- the check only ran on the closing delimiter.
    expect(
      scan("intro\n\n```typescript\nconst a = 1;\nmore").map((v) => v.kind),
    ).toEqual(["fence"]);
  });

  it("treats a four-backtick wrapper as one block, per CommonMark", () => {
    // The wrapper used to capture "`markdown" as its language and consume the
    // inner opener as its own closer. With run lengths honoured it is one
    // `markdown` block whose body happens to contain backticks -- which is how a
    // document demonstrating markdown is written, so its contents are prose and
    // are deliberately NOT scanned as a fence.
    const markdown = "````markdown\n```typescript\nconst a = 1;\n```\n````";
    expect(scan(markdown)).toEqual([]);
  });

  it("does not treat a shorter run as closing a longer fence", () => {
    expect(
      scan("````typescript\nconst a = 1;\n````").map((v) => v.kind),
    ).toEqual(["fence"]);
  });

  it("extends a survives-rewrite claim across the block body", () => {
    // Previously the claim suppressed the fence and left scanLine running, so
    // TypeScript prior art naming a real class still reported an identifier.
    const markdown =
      "<!-- survives-rewrite: prior art -->\n```typescript\nclass CodeGenerator {}\n```";
    expect(scan(markdown)).toEqual([]);
  });

  it("resumes scanning after a claimed block ends", () => {
    const markdown =
      "<!-- survives-rewrite: prior art -->\n```typescript\nclass CodeGenerator {}\n```\n\nThe CodeGenerator emits it.";
    expect(scan(markdown).map((v) => v.kind)).toEqual(["identifier"]);
  });

  it("flags a bare directory citation", () => {
    // Previously skipped: SOURCE_PATH required a file extension.
    const [violation] = scan("Lives under `src/transpiler/logic/analysis/`.");
    expect(violation).toMatchObject({
      kind: "path",
      detail: "src/transpiler/logic/analysis/",
    });
  });

  it("does not flag a user's project tree that merely starts with src/", () => {
    // Negative control: `src/can/` is a prefix of a .cnx path, not a citation.
    expect(scan("`src/can/config.cnx` -> `CNX_SRC_CAN_CONFIG_H`")).toEqual([]);
  });

  it.each([
    ["TSymbol"],
    ["ISymbol"],
    ["IParameterSymbol"],
    ["ESymbolKind"],
    ["TCSymbol"],
    ["IAnalyzerError"],
  ])("collects the I/T/E-prefixed name %s", (name) => {
    expect(AdrIndependence.IDENTIFIER_SHAPE.test(name)).toBe(true);
  });

  it.each([
    ["Point"],
    ["String"],
    ["Register"],
    ["Italian"],
    ["ISR"],
    ["MISRA"],
  ])("still excludes %s", (word) => {
    expect(AdrIndependence.IDENTIFIER_SHAPE.test(word)).toBe(false);
  });

  it("collects names from every declaration form", () => {
    const names = AdrIndependence.vocabulary(process.cwd());
    // `export interface I...` and bare `enum E...` were never collected before.
    expect([...names].some((n) => n.startsWith("I"))).toBe(true);
    expect([...names].some((n) => n.startsWith("T"))).toBe(true);
  });
});

describe("AdrIndependence.run", () => {
  // A throwaway tree, so the assertions do not move when the real corpus does.
  const root = mkdtempSync(join(tmpdir(), "adr-gate-"));
  const decisions = join(root, "docs", "decisions");
  mkdirSync(decisions, { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(
    join(root, "src", "Thing.ts"),
    "export default class CodeGenerator {}\n",
  );
  writeFileSync(
    join(decisions, "adr-001-clean.md"),
    "# Clean\n\n```cnx\nu8 x <- 1;\n```\n",
  );
  writeFileSync(
    join(decisions, "adr-002-dirty.md"),
    "# Dirty\n\nThe CodeGenerator emits it.\n",
  );
  // Neither of these is an ADR, and neither may be scanned.
  writeFileSync(join(decisions, "README.md"), "The CodeGenerator emits it.\n");
  writeFileSync(
    join(decisions, "TEMPLATE.md"),
    "The CodeGenerator emits it.\n",
  );

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const outcome = AdrIndependence.run(root);

  it("counts only files named adr-<digits>", () => {
    expect(outcome.scanned).toBe(2);
  });

  it("reports violations from the ADR that has one", () => {
    expect(outcome.failures).toMatchObject([
      { file: "adr-002-dirty.md", kind: "identifier", detail: "CodeGenerator" },
    ]);
  });

  it("does not scan README.md or TEMPLATE.md, which are not ADRs", () => {
    // Both contain the same violating sentence; neither may be reported.
    expect(outcome.failures.map((v) => v.file)).not.toContain("README.md");
    expect(outcome.failures.map((v) => v.file)).not.toContain("TEMPLATE.md");
  });

  it("builds its vocabulary from the tree it is given, not this repo", () => {
    expect(AdrIndependence.vocabulary(root).has("CodeGenerator")).toBe(true);
    expect(AdrIndependence.vocabulary(root).size).toBe(1);
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
