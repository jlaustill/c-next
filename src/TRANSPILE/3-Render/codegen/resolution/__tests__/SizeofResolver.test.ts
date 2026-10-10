/**
 * Tests for SizeofResolver - sizeof expression generation
 *
 * #1445: these used to build mock parse contexts by hand and pass them
 * `as never`, which meant the type checker said nothing about them -- a
 * signature change reported zero errors while every case was wrong. The
 * resolver takes a `TSizeofOperand` now, so the inputs are ordinary values the
 * compiler checks.
 *
 * That also reaches the two cases the old file recorded as unreachable
 * ("the mock structure required is too complex for unit testing"): the
 * expression arm, and the thunk that must not be called.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import SizeofResolver from "../SizeofResolver";
import TranspileState from "../../../../TranspileState";
import TParameterInfo from "../../../../../types/TParameterInfo";
import createMockSymbols from "../../../../../cli/__tests__/codeGenSymbolsHelpers";

/** A parameter in the render-time table, with every flag off by default. */
function declareParameter(
  name: string,
  overrides: Partial<TParameterInfo> = {},
): void {
  state.currentParameters.set(name, {
    name,
    baseType: "u32",
    isArray: false,
    isStruct: false,
    isConst: false,
    isCallback: false,
    isString: false,
    ...overrides,
  });
}

let state = new TranspileState();

describe("SizeofResolver", () => {
  beforeEach(() => {
    state = new TranspileState();
  });

  describe("user-type operand", () => {
    it("throws E0601 for array parameter", () => {
      declareParameter("arr", { isArray: true });

      expect(() =>
        SizeofResolver.generate(
          {
            kind: "user-type",
            text: "arr",
            textBinding: { kind: "parameter" },
          },
          state,
        ),
      ).toThrow("E0601 rejects this in pass 2.1");
    });

    it("generates dereference for pass-by-reference parameter", () => {
      declareParameter("value");

      expect(
        SizeofResolver.generate(
          {
            kind: "user-type",
            text: "value",
            textBinding: { kind: "parameter" },
          },
          state,
        ),
      ).toBe("sizeof(*value)");
    });

    it.each([
      ["struct parameter", { isStruct: true }],
      ["callback parameter", { isCallback: true }],
    ])("passes %s by name, not by dereference", (_label, overrides) => {
      declareParameter("p", overrides);

      expect(
        SizeofResolver.generate(
          { kind: "user-type", text: "p", textBinding: { kind: "parameter" } },
          state,
        ),
      ).toBe("sizeof(p)");
    });

    /**
     * The emitted name is 1.4's (#1934) and arrives on the operand; the
     * resolver must write it, not the source spelling.
     */
    it("uses the emitted name of a shadowing local (ADR-057)", () => {
      expect(
        SizeofResolver.generate(
          {
            kind: "user-type",
            text: "arr",
            textBinding: { kind: "value", cName: "main__arr" },
          },
          state,
        ),
      ).toBe("sizeof(main__arr)");
    });

    /**
     * #1966: a name that binds to a value is that value, even where a
     * parameter of the same name is in the render-time table -- the block-local
     * that shadows it.
     */
    it("measures the value a name binds to, not a same-named parameter", () => {
      declareParameter("cfg", { isStruct: true });

      expect(
        SizeofResolver.generate(
          {
            kind: "user-type",
            text: "cfg",
            textBinding: { kind: "value", cName: "cfg" },
          },
          state,
        ),
      ).toBe("sizeof(cfg)");
    });

    it("holds that a parameter binding is one of the current function's", () => {
      expect(() =>
        SizeofResolver.generate(
          {
            kind: "user-type",
            text: "ghost",
            textBinding: { kind: "parameter" },
          },
          state,
        ),
      ).toThrow("is one of the current function's");
    });
  });

  describe("qualified-type operand", () => {
    /** A thunk that records whether the resolver reached for a type name. */
    function renderSpy(): {
      renderTypeName: () => string;
      calls: () => number;
    } {
      const spy = vi.fn().mockReturnValue("Scope__Type");
      return { renderTypeName: spy, calls: () => spy.mock.calls.length };
    }

    /**
     * #1973: a struct type's field. A value chain never reaches this arm --
     * the walker renders it as an expression (#1972) -- and ADR-023 has not
     * decided this form, so it is written as it is.
     */
    it("writes a struct type's field as written (#1973)", () => {
      const spy = renderSpy();

      const result = SizeofResolver.generate(
        {
          kind: "qualified-type",
          firstName: "Point",
          memberName: "y",
          renderTypeName: spy.renderTypeName,
        },
        state,
      );

      expect(result).toBe("sizeof(Point.y)");
      expect(spy.calls()).toBe(0);
    });

    it("renders the type name when the first identifier is a scope", () => {
      state.symbols = createMockSymbols({
        knownScopes: new Set(["Motor"]),
      });
      const spy = renderSpy();

      const result = SizeofResolver.generate(
        {
          kind: "qualified-type",
          firstName: "Motor",
          memberName: "State",
          renderTypeName: spy.renderTypeName,
        },
        state,
      );

      expect(result).toBe("sizeof(Scope__Type)");
      expect(spy.calls()).toBe(1);
    });
  });

  describe("plain-type operand", () => {
    it("wraps the already-rendered C type name", () => {
      expect(
        SizeofResolver.generate(
          { kind: "plain-type", cTypeName: "uint32_t" },
          state,
        ),
      ).toBe("sizeof(uint32_t)");
    });
  });

  describe("expression operand", () => {
    it("wraps the generated expression", () => {
      expect(
        SizeofResolver.generate(
          {
            kind: "expression",
            simpleIdentifier: null,
            parameter: undefined,
            hasSideEffects: false,
            code: "a + b",
          },
          state,
        ),
      ).toBe("sizeof(a + b)");
    });

    it("throws E0601 when the operand names an array parameter", () => {
      declareParameter("arr", { isArray: true });

      expect(() =>
        SizeofResolver.generate(
          {
            kind: "expression",
            simpleIdentifier: "arr",
            parameter: state.currentParameters.get("arr"),
            hasSideEffects: false,
            code: "arr",
          },
          state,
        ),
      ).toThrow("E0601 rejects this in pass 2.1");
    });

    it("throws E0602 when the operand has side effects", () => {
      expect(() =>
        SizeofResolver.generate(
          {
            kind: "expression",
            simpleIdentifier: null,
            parameter: undefined,
            hasSideEffects: true,
            code: "f()",
          },
          state,
        ),
      ).toThrow("E0602 rejects this in pass 2.1");
    });
  });
});
