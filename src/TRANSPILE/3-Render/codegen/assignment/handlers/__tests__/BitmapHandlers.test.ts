/**
 * Unit tests for BitmapHandlers.
 * Tests bitmap field assignment handler functions.
 */

import { beforeEach, describe, expect, it } from "vitest";

import bitmapHandlers from "../BitmapHandlers";
import AssignmentKind from "../../../../../../types/AssignmentKind";
import type IBitmapFieldLayout from "../../../../../../types/IBitmapFieldLayout";
import IAssignmentContext from "../../../../../2-Plan/types/IAssignmentContext";
import TranspileState from "../../../../../TranspileState";
import HandlerTestUtils from "./handlerTestUtils";
import enterScope from "../../../../../../transpiler/__tests__/enterScope";

/**
 * Create mock context for testing.
 */
function createMockContext(
  overrides: Partial<IAssignmentContext> = {},
): IAssignmentContext {
  // Default resolved values based on first identifier
  const identifiers = overrides.identifiers ?? ["flags", "Running"];
  const resolvedTarget = overrides.resolvedTarget ?? identifiers[0];
  const resolvedBaseIdentifier =
    overrides.resolvedBaseIdentifier ?? identifiers[0];

  const ctx = {
    identifiers,
    ...HandlerTestUtils.subscriptsOf([]),
    isCompound: false,
    cnextOp: "<-",
    cOp: "=",
    generatedValue: "true",
    // #1445: renders, not nodes -- each delegates to the mocked generator the
    // cases already configure, so a case that overrides
    // `generateAssignmentTarget` or `analyzeMemberChainForBitAccess` still
    // controls what this returns.
    renderTarget: () =>
      HandlerTestUtils.planner().generateAssignmentTarget(null as never),
    analyzeTargetForBitAccess: () =>
      HandlerTestUtils.planner().analyzeMemberChainForBitAccess(null as never),
    targetLine: 1,
    hasValue: true,
    valueExpressionType: () => null,
    valueIntegerType: () => null,
    valueHasFloatingOperand: () => false,
    foldValue: () =>
      HandlerTestUtils.planner().tryEvaluateConstant(null as never),
    postfixOps: [],
    hasThis: false,
    hasGlobal: false,
    hasMemberAccess: true,
    hasArrayAccess: false,
    postfixOpsCount: 1,
    memberAccessDepth: 1,
    subscriptDepth: 0,
    isSimpleIdentifier: false,
    isSimpleThisAccess: false,
    isSimpleGlobalAccess: false,
    resolvedTarget,
    resolvedBaseIdentifier,
    // #1452 box 4: a handler reaches 2.3's per-file state through the context
    // it is handed, so the mock context carries the same instance the test
    // set its facts up on.
    state,
    ...overrides,
  } as IAssignmentContext;
  // #1668 (C7): what the target writes, as the binder would bind it
  return {
    ...ctx,
    target: overrides.target ?? HandlerTestUtils.targetOf(state, ctx),
  };
}

let state = new TranspileState();

describe("BitmapHandlers", () => {
  beforeEach(() => {
    state = new TranspileState();
    HandlerTestUtils.setupMockGenerator(state);
    HandlerTestUtils.setupMockSymbols(state);
  });

  describe("handler registration", () => {
    it("registers all expected bitmap assignment kinds", () => {
      const kinds = bitmapHandlers.map(([kind]) => kind);

      expect(kinds).toContain(AssignmentKind.BITMAP_FIELD_SINGLE_BIT);
      expect(kinds).toContain(AssignmentKind.BITMAP_FIELD_MULTI_BIT);
      expect(kinds).toContain(AssignmentKind.BITMAP_ARRAY_ELEMENT_FIELD);
      expect(kinds).toContain(AssignmentKind.STRUCT_MEMBER_BITMAP_FIELD);
      expect(kinds).toContain(AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD);
      expect(kinds).toContain(
        AssignmentKind.SCOPED_REGISTER_MEMBER_BITMAP_FIELD,
      );
    });

    it("exports exactly 6 handlers", () => {
      expect(bitmapHandlers).toHaveLength(6);
    });
  });

  describe("handleBitmapField (a field of a bitmap value)", () => {
    const VALUE_KINDS = [
      AssignmentKind.BITMAP_FIELD_SINGLE_BIT,
      AssignmentKind.BITMAP_FIELD_MULTI_BIT,
      AssignmentKind.BITMAP_ARRAY_ELEMENT_FIELD,
      AssignmentKind.STRUCT_MEMBER_BITMAP_FIELD,
    ];
    const handlerFor = (kind: AssignmentKind) =>
      bitmapHandlers.find(([k]) => k === kind)![1];
    const write = (ctx: IAssignmentContext) =>
      handlerFor(AssignmentKind.BITMAP_FIELD_SINGLE_BIT)(ctx);

    /** A field write as the planner renders its target and the typer types it */
    const fieldWrite = (
      rendered: string,
      bitmapType: string,
      identifiers: string[],
      generatedValue = "true",
    ): IAssignmentContext => {
      const ctx = createMockContext({ identifiers, generatedValue });
      const before = {
        ...HandlerTestUtils.operandOf("u8", false, false),
        bitmapTypeName: bitmapType,
      };
      return {
        ...ctx,
        renderBitTarget: () => rendered,
        target: {
          ...ctx.target,
          last: { before, subscript: null, property: null, after: null },
        },
      };
    };

    const declareBitmap = (
      bitmapType: string,
      storage: string,
      fields: [string, IBitmapFieldLayout][],
    ) =>
      HandlerTestUtils.setupMockSymbols(state, {
        bitmapBackingType: new Map([[bitmapType, storage]]),
        bitmapFields: new Map([[bitmapType, new Map(fields)]]),
      });

    // #1760 second review: the target was rebuilt from the source spelling,
    // so `fl.C` in a function with a local `fl` wrote the global `fl`
    it.each(VALUE_KINDS)(
      "%s writes the rendered target, not the spelling",
      (kind) => {
        declareBitmap("Sm", "uint8_t", [["C", { offset: 4, width: 4 }]]);
        const ctx = fieldWrite("main__fl", "Sm", ["fl", "C"], "5U");

        expect(handlerFor(kind)(ctx)).toBe(
          "main__fl = (uint8_t)((main__fl & ~(0xFU << 4)) | ((5U & 0xFU) << 4));",
        );
      },
    );

    it("writes through a parameter as it renders", () => {
      declareBitmap("Sm", "uint8_t", [["A", { offset: 0, width: 1 }]]);

      expect(write(fieldWrite("(*s)", "Sm", ["s", "A"]))).toBe(
        "(*s) = (uint8_t)(((*s) & ~(1U << 0)) | (1U << 0));",
      );
    });

    it("shifts a single bit to its offset", () => {
      declareBitmap("StatusFlags", "uint8_t", [
        ["Active", { offset: 3, width: 1 }],
      ]);

      expect(
        write(fieldWrite("flags", "StatusFlags", ["flags", "Active"])),
      ).toContain("<< 3");
    });

    it("throws on unknown bitmap field", () => {
      declareBitmap("StatusFlags", "uint8_t", []);

      expect(() =>
        write(fieldWrite("flags", "StatusFlags", ["flags", "Unknown"])),
      ).toThrow("agree on the bitmap field key");
    });

    it("masks a multi-bit field", () => {
      declareBitmap("StatusFlags", "uint8_t", [
        ["Mode", { offset: 4, width: 3 }],
      ]);

      const result = write(
        fieldWrite("flags", "StatusFlags", ["flags", "Mode"], "3"),
      );

      expect(result).toContain("& ~(0x7U << 4)");
      expect(result).toContain("(3 & 0x7U)");
    });

    it("shifts in 32 bits when the bitmap is backed by 32 (#1668)", () => {
      declareBitmap("Rgb", "uint32_t", [["Red", { offset: 16, width: 8 }]]);

      expect(write(fieldWrite("color", "Rgb", ["color", "Red"], "64"))).toBe(
        "color = (color & ~((uint32_t)0xFFU << 16)) | ((64 & (uint32_t)0xFFU) << 16);",
      );
    });

    // #1322: compound assignment on a bitmap field is E0857 in pass 2.1, and
    // ADR-034's overflow rule is E0881 there too; the pipeline halts before
    // these handlers run. Covered by
    // `1-Analyze/__tests__/CompoundAssignmentAnalyzer.test.ts`.
  });

  describe("handleRegisterMemberBitmapField (REGISTER_MEMBER_BITMAP_FIELD)", () => {
    const getHandler = () =>
      bitmapHandlers.find(
        ([kind]) => kind === AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD,
      )?.[1];

    it("generates register member bitmap field assignment", () => {
      HandlerTestUtils.setupMockSymbols(state, {
        bitmapBackingType: new Map([["MotorCtrl", "uint8_t"]]),
        bitmapFields: new Map([
          ["MotorCtrl", new Map([["Running", { offset: 0, width: 1 }]])],
        ]),
        registerMemberTypes: new Map([["MOTOR__CTRL", "MotorCtrl"]]),
      });
      const ctx = createMockContext({
        identifiers: ["MOTOR", "CTRL", "Running"],
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("MOTOR__CTRL =");
      expect(result).toContain("& ~(1U << 0)");
    });

    it("writes a write-only member without reading it (#1776)", () => {
      HandlerTestUtils.setupMockSymbols(state, {
        bitmapBackingType: new Map([["MotorCtrl", "uint8_t"]]),
        bitmapFields: new Map([
          ["MotorCtrl", new Map([["Running", { offset: 0, width: 1 }]])],
        ]),
        registerMemberTypes: new Map([["MOTOR__CTRL", "MotorCtrl"]]),
        registerMemberAccess: new Map([["MOTOR__CTRL", "wo"]]),
      });
      const ctx = createMockContext({
        identifiers: ["MOTOR", "CTRL", "Running"],
      });

      const result = getHandler()!(ctx);

      // The scoped spelling already wrote plainly; this one read the member
      expect(result).toBe("MOTOR__CTRL = (uint8_t)(1U << 0);");
    });
  });

  describe("handleScopedRegisterMemberBitmapField (SCOPED_REGISTER_MEMBER_BITMAP_FIELD)", () => {
    const getHandler = () =>
      bitmapHandlers.find(
        ([kind]) => kind === AssignmentKind.SCOPED_REGISTER_MEMBER_BITMAP_FIELD,
      )?.[1];

    it("generates this-prefixed scoped register bitmap field", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockSymbols(state, {
        bitmapBackingType: new Map([["ICR1Bits", "uint8_t"]]),
        bitmapFields: new Map([
          ["ICR1Bits", new Map([["LED", { offset: 6, width: 2 }]])],
        ]),
        registerMemberTypes: new Map([["Motor__GPIO7__ICR1", "ICR1Bits"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "ICR1", "LED"],
        hasThis: true,
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("Motor__GPIO7__ICR1 =");
      expect(result).toContain("<< 6");
    });

    it("generates scope-prefixed register bitmap field", () => {
      HandlerTestUtils.setupMockGenerator(state, {});
      HandlerTestUtils.setupMockSymbols(state, {
        bitmapBackingType: new Map([["ICR1Bits", "uint8_t"]]),
        bitmapFields: new Map([
          ["ICR1Bits", new Map([["LED", { offset: 6, width: 2 }]])],
        ]),
        registerMemberTypes: new Map([["Motor__GPIO7__ICR1", "ICR1Bits"]]),
      });
      const ctx = createMockContext({
        identifiers: ["Motor", "GPIO7", "ICR1", "LED"],
        hasThis: false,
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("Motor__GPIO7__ICR1 =");
    });

    // #1322a: the `'this' outside a scope` guard this asserted is deleted. It
    // was unreachable -- `this.x <- 5` at file scope is a PARSE error, so the
    // assignment never reaches codegen -- and this test reached it only by
    // calling the handler directly with state production cannot produce. A test
    // that is a dead branch's only caller is what keeps the branch alive.

    it("generates write-only pattern for wo register", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockSymbols(state, {
        bitmapBackingType: new Map([["SetBits", "uint8_t"]]),
        bitmapFields: new Map([
          ["SetBits", new Map([["LED", { offset: 0, width: 1 }]])],
        ]),
        registerMemberTypes: new Map([["Motor__GPIO7__SET", "SetBits"]]),
        registerMemberAccess: new Map([["Motor__GPIO7__SET", "wo"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "SET", "LED"],
        hasThis: true,
      });

      const result = getHandler()!(ctx);

      // Write-only should not use RMW pattern
      expect(result).not.toContain("& ~");
      expect(result).toContain("Motor__GPIO7__SET =");
    });

    it("generates write-only pattern for w1s register", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockSymbols(state, {
        bitmapBackingType: new Map([["SetBits", "uint8_t"]]),
        bitmapFields: new Map([
          ["SetBits", new Map([["LED", { offset: 3, width: 1 }]])],
        ]),
        registerMemberTypes: new Map([["Motor__GPIO7__SET", "SetBits"]]),
        registerMemberAccess: new Map([["Motor__GPIO7__SET", "w1s"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "SET", "LED"],
        hasThis: true,
      });

      const result = getHandler()!(ctx);

      expect(result).not.toContain("& ~");
      expect(result).toContain("<< 3");
    });

    it("generates write-only pattern for w1c register", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockSymbols(state, {
        bitmapBackingType: new Map([["ClearBits", "uint8_t"]]),
        bitmapFields: new Map([
          ["ClearBits", new Map([["LED", { offset: 5, width: 1 }]])],
        ]),
        registerMemberTypes: new Map([["Motor__GPIO7__CLR", "ClearBits"]]),
        registerMemberAccess: new Map([["Motor__GPIO7__CLR", "w1c"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "CLR", "LED"],
        hasThis: true,
      });

      const result = getHandler()!(ctx);

      expect(result).not.toContain("& ~");
      expect(result).toContain("<< 5");
    });
  });
});
