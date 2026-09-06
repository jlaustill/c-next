import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import ThisOutsideScopeAnalyzer from "../ThisOutsideScopeAnalyzer";

/**
 * #1322, the first relocation. `this` outside a `scope` was rejected from FOUR
 * places in `output/` -- `CodeGenerator`, `BaseIdentifierBuilder`, and
 * `PostfixExpressionGenerator` twice -- each throwing the identical string, and
 * each reaching the user as `1:0` because a codegen throw carries no position.
 *
 * It is the right first family to move for three reasons: the rule is purely
 * syntactic, so it needs no symbol state at all; four copies collapse to one
 * decision, which is what the relocation constraint requires; and both routes
 * to it are reachable, verified by probe rather than assumed --
 * `u32 x <- this.count;` at file scope AND inside a top-level function each
 * produced the diagnostic before this analyzer existed.
 */
const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new ThisOutsideScopeAnalyzer().analyze(tree);
};

describe("ThisOutsideScopeAnalyzer", () => {
  it("rejects `this` in a file-scope initializer, with a real position", () => {
    // The position is the point of the card: this reported `1:0` from codegen.
    const found = errors("u32 count <- 0;\nu32 shadow <- this.count;");
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0431");
    expect(found[0].line).toBe(2);
    expect(found[0].column).toBeGreaterThan(0);
  });

  it("rejects `this` inside a top-level function", () => {
    const found = errors(
      "u32 count <- 0;\nu32 main() {\n    u32 x <- this.count;\n    return x;\n}",
    );
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(3);
  });

  it("rejects `this` in an assignment target outside a scope", () => {
    // `AssignmentTargetContext` carries its own THIS token, so a walk that
    // only visited expressions would miss the write path entirely.
    const found = errors(
      "u32 count <- 0;\nu32 main() {\n  this.count <- 5;\n  return 0;\n}",
    );
    expect(found).toHaveLength(1);
  });

  it("accepts `this` inside a scope method", () => {
    const source = [
      "scope Motor {",
      "    u32 speed <- 0;",
      "    public u32 read() {",
      "        return this.speed;",
      "    }",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("accepts `this.Type` in a type position inside a scope", () => {
    // `ScopedTypeContext` is the third context carrying THIS. It is legal in a
    // scope and must not be reported there.
    const source = [
      "scope Motor {",
      "    enum State { IDLE, RUNNING }",
      "    public u32 read() {",
      "        this.State s <- this.State.IDLE;",
      "        return 0;",
      "    }",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("reports each offending `this` separately, unlike the throw it replaces", () => {
    // A throw aborts at the first occurrence. An analyzer sees the file, which
    // is a behavior change worth asserting rather than discovering in a
    // regenerated snapshot.
    const found = errors("u32 a <- 0;\nu32 b <- this.a;\nu32 c <- this.a;");
    expect(found).toHaveLength(2);
    expect(found.map((e) => e.line)).toEqual([2, 3]);
  });

  it("says what to write instead", () => {
    const [found] = errors("u32 count <- 0;\nu32 shadow <- this.count;");
    expect(found.helpText).toContain("global.");
  });
});
