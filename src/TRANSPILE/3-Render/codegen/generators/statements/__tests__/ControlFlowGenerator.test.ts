/**
 * Unit tests for ControlFlowGenerator
 *
 * #1445 box 3: this file was 360 lines of hand-built fake parse nodes before
 * 33 tests -- including a 21-level `createMockExpression` chain
 * (`ternaryExpression` -> `orExpression` -> ... -> `primaryExpression`) that
 * existed only so `ExpressionUnwrapper` could walk it, and 25 casts to make
 * TypeScript accept the result. The generators take plans now, so the builders
 * are plan literals and the casts are gone.
 *
 * The two stubs that remain are PROXIES that throw on any member the
 * generators do not use. That turns "these are the only things it touches"
 * from a comment into an assertion: a future edit that reaches back through
 * the orchestrator for a tree, or starts reading `input`, fails here rather
 * than silently re-growing the population this slice shrank.
 */

import { describe, it, expect, vi } from "vitest";
import controlFlowGenerators from "../ControlFlowGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import IPlannedFor from "../../../types/IPlannedFor";
import IPlannedForAssignment from "../../../types/IPlannedForAssignment";
import IPlannedForVarDecl from "../../../types/IPlannedForVarDecl";
import IPlannedIf from "../../../types/IPlannedIf";
import IPlannedLoop from "../../../types/IPlannedLoop";
import TestGeneratorState from "../../__tests__/testGeneratorState";

const {
  generateReturn,
  generateIf,
  generateWhile,
  generateDoWhile,
  generateFor,
  generateForever,
  generateForVarDecl,
  generateForAssignment,
} = controlFlowGenerators;

/**
 * A stub that answers only what it was given and throws for anything else.
 *
 * `expect` and vitest probe objects for `then`, `Symbol.toStringTag` and the
 * like, so symbols and `then` come back undefined rather than throwing.
 */
function strictStub<T extends object>(provided: Record<string, unknown>): T {
  return new Proxy(provided, {
    get(target, prop) {
      if (typeof prop === "symbol" || prop === "then") {
        return undefined;
      }
      if (prop in target) {
        return target[prop as string];
      }
      throw new Error(`ControlFlowGenerator must not read .${String(prop)}`);
    },
  }) as T;
}

/** None of the eight generators reads its input; this asserts that. */
const INPUT = strictStub<IGeneratorInput>({});

const STATE: IGeneratorState = TestGeneratorState.create({
  inFunctionBody: true,
});

function createMockOrchestrator(options?: {
  returnType?: string | null;
  tempDeclarations?: string;
  lengthCacheDecls?: string;
}): IOrchestrator {
  return strictStub<IOrchestrator>({
    getCurrentFunctionReturnType: vi.fn(() => options?.returnType ?? null),
    // ADR-057: registration hands back the emitted name; identity here means
    // "nothing shadowed, keep the source name".
    registerLocalVariable: vi.fn((name: string) => name),
    flushPendingTempDeclarations: vi.fn(() => options?.tempDeclarations ?? ""),
    setupLengthCache: vi.fn(() => options?.lengthCacheDecls ?? ""),
    clearLengthCache: vi.fn(),
  });
}

function loop(overrides: Partial<IPlannedLoop> = {}): IPlannedLoop {
  return {
    renderCondition: () => "cond",
    renderBody: () => "{ body }",
    ...overrides,
  };
}

function ifPlan(overrides: Partial<IPlannedIf> = {}): IPlannedIf {
  return {
    lengthCounts: new Map(),
    renderCondition: () => "cond",
    renderThen: () => "{ then }",
    renderElse: null,
    ...overrides,
  };
}

function varDecl(
  overrides: Partial<IPlannedForVarDecl> = {},
): IPlannedForVarDecl {
  return {
    atomic: "",
    volatile: "",
    typeName: "int32_t",
    declaredName: "i",
    renderArrayDimensions: null,
    renderInitializer: null,
    ...overrides,
  };
}

function assignment(
  overrides: Partial<IPlannedForAssignment> = {},
): IPlannedForAssignment {
  return {
    renderTarget: () => "i",
    renderValue: () => "0",
    operatorText: "<-",
    operatorLine: 1,
    ...overrides,
  };
}

function forPlan(overrides: Partial<IPlannedFor> = {}): IPlannedFor {
  return {
    init: null,
    renderCondition: () => "i < 10",
    update: null,
    renderBody: () => "{ body }",
    ...overrides,
  };
}

// #1322: the condition-validation delegation tests are gone with the calls.
// ADR-022's controlling-expression rules -- E0701 (a condition must be a
// comparison) and E0702 (no function call in a condition) -- are authored in
// pass 2.1, which halts before codegen runs. Deleted rather than emptied: an
// `it` that runs the generator and asserts nothing is green whatever the
// generator does. Covered by
// `1-Analyze/__tests__/ControllingExpressionAnalyzer.test.ts`.
describe("ControlFlowGenerator", () => {
  describe("generateReturn", () => {
    it("generates a bare return for the void arm", () => {
      const result = generateReturn(
        { kind: "void" },
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(result.code).toBe("return;");
      expect(result.effects).toEqual([]);
    });

    it("generates return with the rendered expression", () => {
      const result = generateReturn(
        { kind: "value", render: () => "value" },
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(result.code).toBe("return value;");
    });

    // Issue #477 / #1277: the expected type is the ENCLOSING FUNCTION's, which
    // is why it is asked for at render time and handed to the plan rather than
    // captured when the plan was built.
    it("hands the enclosing function's return type to the renderer", () => {
      const render = vi.fn(() => "RED");

      generateReturn(
        { kind: "value", render },
        INPUT,
        STATE,
        createMockOrchestrator({ returnType: "EColor" }),
      );

      expect(render).toHaveBeenCalledWith("EColor");
    });

    it("hands null when the function declares no return type", () => {
      const render = vi.fn(() => "x");

      generateReturn(
        { kind: "value", render },
        INPUT,
        STATE,
        createMockOrchestrator({ returnType: null }),
      );

      expect(render).toHaveBeenCalledWith(null);
    });
  });

  describe("generateIf", () => {
    it("generates a simple if statement", () => {
      const result = generateIf(
        ifPlan(),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(result.code).toBe("if (cond) { then }");
    });

    it("generates an if-else statement", () => {
      const result = generateIf(
        ifPlan({ renderElse: () => "{ otherwise }" }),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(result.code).toBe("if (cond) { then } else { otherwise }");
    });

    it("does not render an else branch that is not there", () => {
      // The plan says `null`, and there is nothing to call -- asserted because
      // rendering a branch that does not exist would register its effects.
      const result = generateIf(
        ifPlan({ renderElse: null }),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(result.code).not.toContain("else");
    });

    // Issue #250: a temp queued by the CONDITION has to be declared in front of
    // the statement, not inside the branch that reads it.
    it("flushes temp declarations before the branches", () => {
      const orchestrator = createMockOrchestrator({
        tempDeclarations: "int32_t tmp = f();",
      });
      const order: string[] = [];

      const result = generateIf(
        ifPlan({
          renderCondition: () => {
            order.push("condition");
            return "cond";
          },
          renderThen: () => {
            order.push("then");
            return "{ then }";
          },
        }),
        INPUT,
        STATE,
        orchestrator,
      );

      expect(result.code.startsWith("int32_t tmp = f();\n")).toBe(true);
      expect(order).toEqual(["condition", "then"]);
    });

    it("sets up the length cache from the plan's counts", () => {
      const orchestrator = createMockOrchestrator({
        lengthCacheDecls: "size_t cnx_len_s = strlen(s);\n",
      });
      const lengthCounts = new Map([["s", 3]]);

      const result = generateIf(
        ifPlan({ lengthCounts }),
        INPUT,
        STATE,
        orchestrator,
      );

      expect(orchestrator.setupLengthCache).toHaveBeenCalledWith(lengthCounts);
      expect(result.code.startsWith("size_t cnx_len_s = strlen(s);\n")).toBe(
        true,
      );
    });

    it("clears the length cache after generating", () => {
      const orchestrator = createMockOrchestrator();

      generateIf(ifPlan(), INPUT, STATE, orchestrator);

      expect(orchestrator.clearLengthCache).toHaveBeenCalledTimes(1);
    });
  });

  describe("generateWhile", () => {
    it("generates a simple while loop", () => {
      const result = generateWhile(
        loop(),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(result.code).toBe("while (cond) { body }");
    });

    it("renders the condition before the body (Issue #250)", () => {
      const order: string[] = [];

      generateWhile(
        loop({
          renderCondition: () => {
            order.push("condition");
            return "cond";
          },
          renderBody: () => {
            order.push("body");
            return "{ body }";
          },
        }),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(order).toEqual(["condition", "body"]);
    });

    it("hoists the condition's temps in front of the loop", () => {
      const result = generateWhile(
        loop(),
        INPUT,
        STATE,
        createMockOrchestrator({ tempDeclarations: "int32_t tmp = f();" }),
      );

      expect(result.code).toBe("int32_t tmp = f();\nwhile (cond) { body }");
    });

    it("returns empty effects", () => {
      expect(
        generateWhile(loop(), INPUT, STATE, createMockOrchestrator()).effects,
      ).toEqual([]);
    });
  });

  describe("generateDoWhile", () => {
    it("generates a simple do-while loop (ADR-027)", () => {
      const result = generateDoWhile(
        loop(),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(result.code).toBe("do { body } while (cond);");
    });

    // The whole difference between the two loop generators, which share one
    // plan shape: `do-while` renders the BODY first, because that is the order
    // the source reads and the order the temps must come out in.
    it("renders the body before the condition", () => {
      const order: string[] = [];

      generateDoWhile(
        loop({
          renderCondition: () => {
            order.push("condition");
            return "cond";
          },
          renderBody: () => {
            order.push("body");
            return "{ body }";
          },
        }),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(order).toEqual(["body", "condition"]);
    });

    it("hoists the condition's temps in front of the loop", () => {
      const result = generateDoWhile(
        loop(),
        INPUT,
        STATE,
        createMockOrchestrator({ tempDeclarations: "int32_t tmp = f();" }),
      );

      expect(result.code).toBe("int32_t tmp = f();\ndo { body } while (cond);");
    });
  });

  describe("generateForever", () => {
    it("lowers to the MISRA Rule 14.3 idiom with its annotation (ADR-068)", () => {
      const result = generateForever(
        { renderBody: () => "{ body }" },
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(result.code).toContain("for (;;) { body }");
      expect(result.code).toContain("14.3");
    });
  });

  describe("generateForVarDecl", () => {
    it("generates a simple variable declaration", () => {
      const result = generateForVarDecl(
        varDecl(),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(result.code).toBe("int32_t i");
    });

    it("generates a declaration with an initializer", () => {
      const result = generateForVarDecl(
        varDecl({ renderInitializer: () => "0" }),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(result.code).toBe("int32_t i = 0");
    });

    // #1277: the declared type IS the initializer's expected type, which is
    // what types a struct literal that no declaration names.
    it("renders the initializer with the declared type as its expected type", () => {
      const renderInitializer = vi.fn(() => "{ 1, 2 }");

      generateForVarDecl(
        varDecl({ typeName: "Point", renderInitializer }),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(renderInitializer).toHaveBeenCalledWith("Point");
    });

    it.each([
      ["atomic", { atomic: "volatile " }, "volatile int32_t i"],
      ["volatile", { volatile: "volatile " }, "volatile int32_t i"],
    ])("carries the %s modifier", (_label, mods, expected) => {
      expect(
        generateForVarDecl(
          varDecl(mods),
          INPUT,
          STATE,
          createMockOrchestrator(),
        ).code,
      ).toBe(expected);
    });

    // ADR-016/ADR-057: registration is what yields the EMITTED name, and it
    // happens before the dimensions and initializer render.
    it("registers the local variable and declares the name it hands back", () => {
      const orchestrator = createMockOrchestrator();
      const order: string[] = [];

      const result = generateForVarDecl(
        varDecl({
          renderInitializer: () => {
            order.push("initializer");
            return "0";
          },
        }),
        INPUT,
        STATE,
        orchestrator,
      );

      expect(orchestrator.registerLocalVariable).toHaveBeenCalledWith("i");
      expect(result.code).toContain(" i");
      expect(order).toEqual(["initializer"]);
    });

    // #1646: the array branch REASSIGNS, so it drops the modifiers the
    // non-array branch carries. Pinned as current behavior, not endorsed --
    // the fix changes emitted C and is tracked on its own card.
    it("drops the modifiers on the array branch (#1646, pre-existing)", () => {
      const result = generateForVarDecl(
        varDecl({
          volatile: "volatile ",
          renderArrayDimensions: () => "[10]",
        }),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(result.code).toBe("int32_t i[10]");
      expect(result.code).not.toContain("volatile");
    });
  });

  describe("generateForAssignment", () => {
    it.each([
      ["<-", "i = 0"],
      ["+<-", "i += 0"],
      ["-<-", "i -= 0"],
      ["*<-", "i *= 0"],
      ["/<-", "i /= 0"],
    ])("maps the %s operator", (operatorText, expected) => {
      expect(
        generateForAssignment(
          assignment({ operatorText }),
          INPUT,
          STATE,
          createMockOrchestrator(),
        ).code,
      ).toBe(expected);
    });

    it("renders the target before the value", () => {
      const order: string[] = [];

      generateForAssignment(
        assignment({
          renderTarget: () => {
            order.push("target");
            return "i";
          },
          renderValue: () => {
            order.push("value");
            return "0";
          },
        }),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(order).toEqual(["target", "value"]);
    });
  });

  describe("generateFor", () => {
    it("generates a for loop with every part", () => {
      const result = generateFor(
        forPlan({
          init: {
            kind: "varDecl",
            plan: varDecl({ renderInitializer: () => "0" }),
          },
          update: assignment({ operatorText: "+<-", renderValue: () => "1" }),
        }),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(result.code).toBe("for (int32_t i = 0; i < 10; i += 1) { body }");
    });

    it("generates a for loop whose init is an assignment", () => {
      const result = generateFor(
        forPlan({ init: { kind: "assignment", plan: assignment() } }),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(result.code).toBe("for (i = 0; i < 10; ) { body }");
    });

    it("generates a for loop with neither init nor update", () => {
      const result = generateFor(
        forPlan(),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(result.code).toBe("for (; i < 10; ) { body }");
    });

    // #1445: the init and the update go through the SAME renderer. They were
    // two code paths with the same three reads and the same operator mapping,
    // which is the duplicate-path anti-pattern at its smallest.
    it("renders the update through the same path as an assignment init", () => {
      const asInit = generateFor(
        forPlan({
          init: {
            kind: "assignment",
            plan: assignment({ operatorText: "+<-" }),
          },
        }),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );
      const asUpdate = generateFor(
        forPlan({ update: assignment({ operatorText: "+<-" }) }),
        INPUT,
        STATE,
        createMockOrchestrator(),
      );

      expect(asInit.code).toContain("for (i += 0;");
      expect(asUpdate.code).toContain("; i += 0)");
    });

    // Issue #250: four clauses, three flush points between them, so each
    // clause's temps land in the right group and none lands inside the body.
    it("renders the clauses in header order with a flush between each", () => {
      const orchestrator = createMockOrchestrator();
      const order: string[] = [];
      const note = (label: string, value: string) => () => {
        order.push(label);
        return value;
      };

      generateFor(
        forPlan({
          init: {
            kind: "assignment",
            plan: assignment({
              renderTarget: note("init", "i"),
              renderValue: () => "0",
            }),
          },
          renderCondition: note("condition", "i < 10"),
          update: assignment({
            renderTarget: note("update", "i"),
            renderValue: () => "1",
          }),
          renderBody: note("body", "{ body }"),
        }),
        INPUT,
        STATE,
        orchestrator,
      );

      expect(order).toEqual(["init", "condition", "update", "body"]);
      expect(orchestrator.flushPendingTempDeclarations).toHaveBeenCalledTimes(
        3,
      );
    });

    it("hoists every clause's temps in front of the loop", () => {
      const result = generateFor(
        forPlan(),
        INPUT,
        STATE,
        createMockOrchestrator({ tempDeclarations: "int32_t tmp = f();" }),
      );

      // Three flushes, each returning the stub's declaration.
      expect(result.code.split("int32_t tmp = f();").length - 1).toBe(3);
      expect(result.code).toContain("for (; i < 10; ) { body }");
    });
  });
});
