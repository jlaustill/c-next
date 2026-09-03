/**
 * Unit tests for StructInitFunction
 * Issue #1205: the ADR-029 init function's definition and its header
 * declaration are spelled from one place, so they cannot drift.
 */

import { describe, it, expect } from "vitest";
import StructInitFunction from "../StructInitFunction";

describe("StructInitFunction", () => {
  describe("cName", () => {
    it("suffixes the struct name", () => {
      expect(StructInitFunction.cName("Controller")).toBe("Controller_init");
    });

    it("leaves a scope-qualified name intact", () => {
      expect(StructInitFunction.cName("Timing__Config")).toBe(
        "Timing__Config_init",
      );
    });
  });

  describe("signature", () => {
    it("returns the struct by value and takes no parameters", () => {
      expect(StructInitFunction.signature("Controller")).toBe(
        "Controller Controller_init(void)",
      );
    });
  });

  describe("definition", () => {
    it("assigns each callback field its default function", () => {
      const code = StructInitFunction.definition("Controller", [
        { fieldName: "_handler", callbackType: "onReceive" },
      ]);

      expect(code).toContain("Controller Controller_init(void) {");
      expect(code).toContain("return (Controller){");
      expect(code).toContain("._handler = onReceive");
    });

    it("separates fields with commas and omits the trailing one", () => {
      const code = StructInitFunction.definition("Multi", [
        { fieldName: "a", callbackType: "onA" },
        { fieldName: "b", callbackType: "onB" },
        { fieldName: "c", callbackType: "onC" },
      ]);

      expect(code).toContain(".a = onA,");
      expect(code).toContain(".b = onB,");
      expect(code).toContain(".c = onC\n");
      expect(code).not.toContain(".c = onC,");
    });
  });

  describe("prototypeLines", () => {
    it("emits nothing when no struct got an init function", () => {
      expect(StructInitFunction.prototypeLines([])).toEqual([]);
    });

    it("annotates the block once, whatever its length", () => {
      const lines = StructInitFunction.prototypeLines(["A", "B", "C"]);
      const annotations = lines.filter((l) => l.includes("MISRA C:2012"));

      expect(annotations).toHaveLength(1);
      expect(lines).toHaveLength(4);
    });

    it("names the rule that shaped the output (C-Next compliance standard)", () => {
      const [annotation] = StructInitFunction.prototypeLines(["A"]);

      expect(annotation).toContain("MISRA C:2012 Rule 8.4");
      // MISRA Rule 3.1: a generated comment must not nest a second opener.
      expect(annotation.indexOf("/*")).toBe(annotation.lastIndexOf("/*"));
    });

    it("preserves the order it is given, so the header is deterministic", () => {
      const lines = StructInitFunction.prototypeLines(["Zeta", "Alpha"]);

      expect(lines.slice(1)).toEqual([
        "Zeta Zeta_init(void);",
        "Alpha Alpha_init(void);",
      ]);
    });
  });

  describe("definition and declaration cannot drift", () => {
    // The point of the module. Both consumers build from signature(), so a
    // change to the return type, name or parameter list moves both at once --
    // the .c definition and the .h declaration stay compatible by
    // construction, which is what MISRA C:2012 Rule 8.4 asks for.
    it("declares exactly what the definition defines", () => {
      const signature = StructInitFunction.signature("Sampler");
      const definition = StructInitFunction.definition("Sampler", [
        { fieldName: "handler", callbackType: "onSample" },
      ]);
      const [, prototype] = StructInitFunction.prototypeLines(["Sampler"]);

      expect(definition.startsWith(`${signature} {`)).toBe(true);
      expect(prototype).toBe(`${signature};`);
    });
  });
});
