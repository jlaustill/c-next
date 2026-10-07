/**
 * TypeValidator.resolveBareIdentifier: the C name a bare identifier emits
 * under, or null to leave it as written.
 *
 * #1668 (C7): which declaration a value name means is the binder's, at the
 * reference, so each case is a real declared program and a position in it
 * rather than a flag saying whether the name is local.
 */
import { describe, it, expect } from "vitest";
import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../../../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../../../PARSE/2-Parse/grammar/CNextParser";
import TypeValidator from "../TypeValidator";
import TranspileState from "../../../TranspileState";
import ParserUtils from "../../../../utils/ParserUtils";
import enterScope from "../../../../cli/__tests__/enterScope";
import testAnalysisContextFor from "../../../1-Analyze/__tests__/testAnalysisContextFor";
import type ISourcePosition from "../../../../utils/types/ISourcePosition";

const SOURCE = `u32 globalCounter <- 0;
void globalFunc() { }
scope Motor {
    u32 speed <- 0;
    u32 maxSpeed <- 0;
    void stop() { }
    public void inside() {
        u32 localVar <- 0;
        localVar <- 1;
        {
            u8 globalCounter <- 0;
        }
        localVar <- 2;
    }
}
void outside() {
    u32 localVar <- 0;
    localVar <- 1;
}`;

/**
 * The program's state, as 2.2 has it inside `scopePath`, and the position of
 * each assignment statement by line -- where a reference in it binds
 */
function setUp(
  scopePath: string | null,
  source = SOURCE,
): {
  state: TranspileState;
  at: (line: number) => ISourcePosition;
} {
  const { tree, context } = testAnalysisContextFor(source);
  const state = new TranspileState();
  state.program = context.program;
  state.symbols = context.symbols;
  state.sourcePath = "test.cnx";
  state.setScopeMembers("Motor", new Set(["speed", "maxSpeed", "stop"]));
  state.knownFunctions = new Set(["globalFunc", "Motor__stop"]);
  enterScope(state, scopePath);

  const positions = new Map<number, ISourcePosition>();
  ParseTreeWalker.DEFAULT.walk(
    new (class extends CNextListener {
      override enterAssignmentStatement = (
        ctx: Parser.AssignmentStatementContext,
      ): void => {
        positions.set(ctx.start!.line, ParserUtils.getPosition(ctx));
      };
    })(),
    tree,
  );
  return {
    state,
    at: (line) => {
      const position = positions.get(line);
      expect(position).toBeDefined();
      return position!;
    },
  };
}

const resolve = (
  name: string,
  scopePath: string | null,
  line: number,
): string | null => {
  const { state, at } = setUp(scopePath);
  return TypeValidator.resolveBareIdentifier(
    name,
    at(line),
    () => false,
    state,
  );
};

describe("TypeValidator.resolveBareIdentifier", () => {
  describe("inside a scope", () => {
    it("returns null for a local variable (no transformation needed)", () => {
      expect(resolve("localVar", "Motor", 9)).toBeNull();
    });

    it("resolves a scope member to its C name", () => {
      expect(resolve("speed", "Motor", 9)).toBe("Motor__speed");
    });

    it("resolves a global variable to itself", () => {
      expect(resolve("globalCounter", "Motor", 9)).toBe("globalCounter");
    });

    it("resolves a global function to itself", () => {
      expect(resolve("globalFunc", "Motor", 9)).toBe("globalFunc");
    });

    it("resolves a scope function to its C name", () => {
      expect(resolve("stop", "Motor", 9)).toBe("Motor__stop");
    });

    it("returns null for an unknown identifier", () => {
      expect(resolve("unknownName", "Motor", 9)).toBeNull();
    });

    it("emits a scope function from its binding, before a same-named global (#1760 review)", () => {
      // No member list and no function list: only the binder can say the
      // name is the scope's function, where the global const would answer
      const { state, at } = setUp(
        "S",
        `const u32 LIMIT <- 8;
scope S {
    u32 LIMIT() { return 2; }
    public void f() {
        u32 v <- 0;
        v <- LIMIT;
    }
}`,
      );
      state.setScopeMembers("S", new Set());
      state.knownFunctions = new Set();
      expect(
        TypeValidator.resolveBareIdentifier("LIMIT", at(6), () => false, state),
      ).toBe("S__LIMIT");
    });

    it("binds a name past a block that shadowed it", () => {
      // `globalCounter` was shadowed by a local in a block that has closed by
      // line 13, so there it is the global again. The regression guard is
      // tests/adr-057/shadow-sibling-block, which runs the program: the old
      // per-function set of local names needs a real walk to populate.
      expect(resolve("globalCounter", "Motor", 13)).toBe("globalCounter");
    });
  });

  describe("outside a scope", () => {
    it("returns null for a local variable", () => {
      expect(resolve("localVar", null, 18)).toBeNull();
    });

    it("returns null for a global variable (no transformation)", () => {
      expect(resolve("globalCounter", null, 18)).toBeNull();
    });
  });
});
