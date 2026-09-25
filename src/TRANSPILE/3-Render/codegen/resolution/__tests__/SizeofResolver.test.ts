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
import TParameterInfo from "../../../../../transpiler/types/TParameterInfo";
import createMockSymbols from "../../../../../transpiler/__tests__/codeGenSymbolsHelpers";

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
        SizeofResolver.generate({ kind: "user-type", text: "arr" }, state),
      ).toThrow("E0601 rejects this in pass 2.1");
    });

    it("generates dereference for pass-by-reference parameter", () => {
      declareParameter("value");

      expect(
        SizeofResolver.generate({ kind: "user-type", text: "value" }, state),
      ).toBe("sizeof(*value)");
    });

    it.each([
      ["struct parameter", { isStruct: true }],
      ["callback parameter", { isCallback: true }],
    ])("passes %s by name, not by dereference", (_label, overrides) => {
      declareParameter("p", overrides);

      expect(
        SizeofResolver.generate({ kind: "user-type", text: "p" }, state),
      ).toBe("sizeof(p)");
    });

    /**
     * The emitted name is written out literally, not read back from
     * `emittedLocalName`: asserting against the same call the resolver makes
     * compares the function to itself and passes however the resolver spells
     * the name. Measured -- with the lookup bypassed that shape stayed green.
     */
    it("uses the emitted name of a shadowing local (ADR-057)", () => {
      state.localVariables.add("arr");
      state.registerLocalRename("arr", "main__arr");

      expect(
        SizeofResolver.generate({ kind: "user-type", text: "arr" }, state),
      ).toBe("sizeof(main__arr)");
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

    it("handles struct.member access for local variable", () => {
      state.localVariables.add("myStruct");
      const spy = renderSpy();

      const result = SizeofResolver.generate(
        {
          kind: "qualified-type",
          firstName: "myStruct",
          memberName: "field",
          renderTypeName: spy.renderTypeName,
        },
        state,
      );

      expect(result).toBe("sizeof(myStruct.field)");
      // A member access names no type, so rendering one would register an
      // include for a type the program never mentions.
      expect(spy.calls()).toBe(0);
    });

    it("uses the emitted name when the local shadows a file-scope name", () => {
      state.localVariables.add("cfg");
      state.registerLocalRename("cfg", "main__cfg");

      expect(
        SizeofResolver.generate(
          {
            kind: "qualified-type",
            firstName: "cfg",
            memberName: "x",
            renderTypeName: renderSpy().renderTypeName,
          },
          state,
        ),
      ).toBe("sizeof(main__cfg.x)");
    });

    it("handles struct parameter with arrow notation", () => {
      declareParameter("param", { baseType: "MyStruct", isStruct: true });

      expect(
        SizeofResolver.generate(
          {
            kind: "qualified-type",
            firstName: "param",
            memberName: "field",
            renderTypeName: renderSpy().renderTypeName,
          },
          state,
        ),
      ).toBe("sizeof(param->field)");
    });

    it("handles non-struct parameter with dot notation", () => {
      declareParameter("param", { baseType: "MyStruct" });

      expect(
        SizeofResolver.generate(
          {
            kind: "qualified-type",
            firstName: "param",
            memberName: "field",
            renderTypeName: renderSpy().renderTypeName,
          },
          state,
        ),
      ).toBe("sizeof(param.field)");
    });

    it("treats an unknown first identifier as a global struct variable", () => {
      const spy = renderSpy();

      const result = SizeofResolver.generate(
        {
          kind: "qualified-type",
          firstName: "config",
          memberName: "field",
          renderTypeName: spy.renderTypeName,
        },
        state,
      );

      expect(result).toBe("sizeof(config.field)");
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
            hasSideEffects: true,
            code: "f()",
          },
          state,
        ),
      ).toThrow("E0602 rejects this in pass 2.1");
    });
  });
});
