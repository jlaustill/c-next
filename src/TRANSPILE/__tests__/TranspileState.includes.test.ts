/**
 * `TranspileState` -- 2.3 Render's per-file working state (#1452 box 4).
 *
 * These cases moved here with their subject. They were on
 * `CodeGenState.test.ts` while the members were statics; the behavior they
 * pin is unchanged, and the negative controls came with them -- the include
 * funnel must raise ONE flag rather than blanket them, and only the two
 * headers with a claiming emitter record a deferred site.
 */
import { describe, it, expect, beforeEach } from "vitest";
import TranspileState from "../TranspileState";
import ToolchainRequirements from "../../instrumentation/ToolchainRequirements";

describe("TranspileState", () => {
  let state = new TranspileState();

  beforeEach(() => {
    state = new TranspileState();
    ToolchainRequirements.reset();
  });

  describe("requireInclude -- the one include sink (#1449)", () => {
    // Parameterized rather than eight near-identical blocks: that shape is
    // SonarCloud S5976, and the six it replaces were exactly it.
    it.each([
      ["stdint", () => state.needsStdint],
      ["stdbool", () => state.needsStdbool],
      ["string", () => state.needsString],
      ["cmsis", () => state.needsCMSIS],
      ["limits", () => state.needsLimits],
      ["isr", () => state.needsISR],
      ["float_static_assert", () => state.needsFloatStaticAssert],
      ["irq_wrappers", () => state.needsIrqWrappers],
    ] as const)("%s raises its flag and no other", (header, read) => {
      expect(read()).toBe(false);
      state.requireInclude(header);
      expect(read()).toBe(true);
    });

    // Negative control: the funnel must raise ONE flag, not blanket them.
    // Without this the test above passes just as well against a body that
    // sets every flag on any call.
    it("raises only the flag it was asked for", () => {
      state.requireInclude("string");

      expect(state.needsString).toBe(true);
      expect(state.needsStdint).toBe(false);
      expect(state.needsStdbool).toBe(false);
      expect(state.needsCMSIS).toBe(false);
      expect(state.needsLimits).toBe(false);
      expect(state.needsISR).toBe(false);
      expect(state.needsFloatStaticAssert).toBe(false);
      expect(state.needsIrqWrappers).toBe(false);
    });

    // #1143: only the two headers with a claiming emitter are recorded as
    // deferred sites. "isr" is deliberately NOT one --
    // ToolchainRequirements.takeDeferredSites is called for
    // float_static_assert and irq_wrappers alone.
    //
    // #1452 moved the sink to src/instrumentation/, so the observation is made
    // there. The subject is still this funnel: requireInclude decides which
    // headers defer, and that decision is what these four rows pin.
    it.each([
      ["float_static_assert", true],
      ["irq_wrappers", true],
      ["isr", false],
      ["string", false],
    ] as const)("%s deferred-site recorded: %s", (header, recorded) => {
      state.requireInclude(header, 42);

      expect(ToolchainRequirements.takeDeferredSites(header).length > 0).toBe(
        recorded,
      );
    });

    // #1452: the sink's third argument. `requireInclude` briefly took
    // `sourcePath` as a parameter no caller supplied, so every site recorded
    // `""` -- and `ResultPrinter` filters on `sourcePath.length > 0`, so #1143's
    // file:line attribution went dark while the row above stayed green. A
    // `length > 0` assertion cannot see the difference between a located site
    // and an unlocated one, which is why the path is asserted here.
    it("records the file the requirement came from, not just that it came", () => {
      state.sourcePath = "a.cnx";

      state.requireInclude("float_static_assert", 7);

      expect(
        ToolchainRequirements.takeDeferredSites("float_static_assert"),
      ).toEqual([{ sourcePath: "a.cnx", line: 7 }]);
    });
  });

  describe("clamp and safe-division helpers", () => {
    it("markClampOpUsed adds to usedClampOps", () => {
      state.markClampOpUsed("add", "u8");
      expect(state.usedClampOps.has("add_u8")).toBe(true);
    });
    it("markSafeDivOpUsed adds to usedSafeDivOps", () => {
      state.markSafeDivOpUsed("div", "i32");
      expect(state.usedSafeDivOps.has("div_i32")).toBe(true);
    });
  });

  it("registerCallbackFieldType adds to callbackFieldTypes", () => {
    state.registerCallbackFieldType("MyStruct_onClick", "ClickHandler");
    expect(state.callbackFieldTypes.get("MyStruct_onClick")).toBe(
      "ClickHandler",
    );
  });

  describe("Opaque Scope Variable Helpers (Issue #948)", () => {
    it("markOpaqueScopeVariable adds to opaqueScopeVariables", () => {
      state.markOpaqueScopeVariable("MyScope_widget");
      expect(state.isOpaqueScopeVariableAccess("MyScope_widget")).toBe(true);
    });

    it("isOpaqueScopeVariableAccess returns false for unknown variable", () => {
      expect(state.isOpaqueScopeVariableAccess("Unknown_var")).toBe(false);
    });

    it("isOpaqueScopeVariableAccess returns true for marked variable", () => {
      state.markOpaqueScopeVariable("Gui_display");
      expect(state.isOpaqueScopeVariableAccess("Gui_display")).toBe(true);
    });

    it("reset clears opaqueScopeVariables", () => {
      state.markOpaqueScopeVariable("Test_opaque");
      expect(state.isOpaqueScopeVariableAccess("Test_opaque")).toBe(true);

      state.reset();

      expect(state.isOpaqueScopeVariableAccess("Test_opaque")).toBe(false);
    });

    it("handles multiple opaque scope variables", () => {
      state.markOpaqueScopeVariable("Scope1_widget");
      state.markOpaqueScopeVariable("Scope1_display");
      state.markOpaqueScopeVariable("Scope2_handle");

      expect(state.isOpaqueScopeVariableAccess("Scope1_widget")).toBe(true);
      expect(state.isOpaqueScopeVariableAccess("Scope1_display")).toBe(true);
      expect(state.isOpaqueScopeVariableAccess("Scope2_handle")).toBe(true);
      expect(state.isOpaqueScopeVariableAccess("Scope1_other")).toBe(false);
    });

    // Issue #996: An element of an opaque-handle array is itself a pointer.
    it("isOpaqueScopeVariableAccess matches array-element access of an opaque array", () => {
      state.markOpaqueScopeVariable("UI_widgets");

      expect(state.isOpaqueScopeVariableAccess("UI_widgets[i]")).toBe(true);
      expect(state.isOpaqueScopeVariableAccess("UI_widgets[0]")).toBe(true);
    });

    it("isOpaqueScopeVariableAccess does not match subscript of a non-opaque array", () => {
      // Base array name was never marked opaque.
      expect(state.isOpaqueScopeVariableAccess("UI_counts[i]")).toBe(false);
    });

    it("isOpaqueScopeVariableAccess does not match a different array that shares a prefix", () => {
      state.markOpaqueScopeVariable("UI_widgets");

      // "UI_widgetsExtra" is a distinct variable, not a subscript of UI_widgets.
      expect(state.isOpaqueScopeVariableAccess("UI_widgetsExtra")).toBe(false);
    });
  });

  describe("withDeclarationInit()", () => {
    it("sets inDeclarationInit to true during callback", () => {
      state.inDeclarationInit = false;
      let valueInside = false;

      state.withDeclarationInit(() => {
        valueInside = state.inDeclarationInit;
      });

      expect(valueInside).toBe(true);
    });

    it("restores prior value after callback", () => {
      state.inDeclarationInit = false;

      state.withDeclarationInit(() => {
        // inside: true
      });

      expect(state.inDeclarationInit).toBe(false);
    });

    it("restores prior value even when already true", () => {
      state.inDeclarationInit = true;

      state.withDeclarationInit(() => {
        expect(state.inDeclarationInit).toBe(true);
      });

      expect(state.inDeclarationInit).toBe(true);
    });

    it("returns the callback result", () => {
      const result = state.withDeclarationInit(() => "hello");
      expect(result).toBe("hello");
    });

    it("restores prior value on exception", () => {
      state.inDeclarationInit = false;

      expect(() =>
        state.withDeclarationInit(() => {
          throw new Error("test error");
        }),
      ).toThrow("test error");

      expect(state.inDeclarationInit).toBe(false);
    });
  });

  describe("withoutDeclarationInit()", () => {
    it("sets inDeclarationInit to false during callback", () => {
      state.inDeclarationInit = true;
      let valueInside = true;

      state.withoutDeclarationInit(() => {
        valueInside = state.inDeclarationInit;
      });

      expect(valueInside).toBe(false);
    });

    it("restores prior value after callback", () => {
      state.inDeclarationInit = true;

      state.withoutDeclarationInit(() => {
        // inside: false
      });

      expect(state.inDeclarationInit).toBe(true);
    });

    it("restores prior value even when already false", () => {
      state.inDeclarationInit = false;

      state.withoutDeclarationInit(() => {
        expect(state.inDeclarationInit).toBe(false);
      });

      expect(state.inDeclarationInit).toBe(false);
    });

    it("returns the callback result", () => {
      const result = state.withoutDeclarationInit(() => 42);
      expect(result).toBe(42);
    });

    it("restores prior value on exception", () => {
      state.inDeclarationInit = true;

      expect(() =>
        state.withoutDeclarationInit(() => {
          throw new Error("test error");
        }),
      ).toThrow("test error");

      expect(state.inDeclarationInit).toBe(true);
    });

    it("nests correctly with withDeclarationInit", () => {
      state.inDeclarationInit = false;

      state.withDeclarationInit(() => {
        expect(state.inDeclarationInit).toBe(true);

        state.withoutDeclarationInit(() => {
          expect(state.inDeclarationInit).toBe(false);
        });

        expect(state.inDeclarationInit).toBe(true);
      });

      expect(state.inDeclarationInit).toBe(false);
    });
  });

  describe("withoutExpectedType()", () => {
    it("clears expectedType during callback", () => {
      state.expectedType = "u32";
      let typeInside: string | null = "notCleared";

      state.withoutExpectedType(() => {
        typeInside = state.expectedType;
      });

      expect(typeInside).toBeNull();
    });

    it("clears suppressBareEnumResolution during callback", () => {
      state.suppressBareEnumResolution = true;
      let suppressInside = true;

      state.withoutExpectedType(() => {
        suppressInside = state.suppressBareEnumResolution;
      });

      expect(suppressInside).toBe(false);
    });

    it("restores expectedType after callback", () => {
      state.expectedType = "i32";

      state.withoutExpectedType(() => {
        // inside: null
      });

      expect(state.expectedType).toBe("i32");
    });

    it("restores suppressBareEnumResolution after callback", () => {
      state.suppressBareEnumResolution = true;

      state.withoutExpectedType(() => {
        // inside: false
      });

      expect(state.suppressBareEnumResolution).toBe(true);
    });

    it("returns the callback result", () => {
      const result = state.withoutExpectedType(() => 123);
      expect(result).toBe(123);
    });

    it("restores values on exception", () => {
      state.expectedType = "bool";
      state.suppressBareEnumResolution = true;

      expect(() =>
        state.withoutExpectedType(() => {
          throw new Error("test error");
        }),
      ).toThrow("test error");

      expect(state.expectedType).toBe("bool");
      expect(state.suppressBareEnumResolution).toBe(true);
    });

    it("handles null expectedType correctly", () => {
      state.expectedType = null;
      state.suppressBareEnumResolution = false;

      let executed = false;
      state.withoutExpectedType(() => {
        executed = true;
        expect(state.expectedType).toBeNull();
        expect(state.suppressBareEnumResolution).toBe(false);
      });

      expect(executed).toBe(true);
      expect(state.expectedType).toBeNull();
      expect(state.suppressBareEnumResolution).toBe(false);
    });
  });
});
