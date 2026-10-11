/**
 * Unit tests for StdlibFunctions
 * The single source of truth for what C-Next knows about functions it does not
 * parse: which header declares them, and whether they return a value.
 */
import { describe, it, expect } from "vitest";
import StdlibFunctions from "../StdlibFunctions";

describe("StdlibFunctions", () => {
  describe("header()", () => {
    it("maps a stdio function to its header", () => {
      expect(StdlibFunctions.header("printf")).toBe("stdio.h");
    });

    it("maps across the other supported headers", () => {
      expect(StdlibFunctions.header("malloc")).toBe("stdlib.h");
      expect(StdlibFunctions.header("strlen")).toBe("string.h");
      expect(StdlibFunctions.header("sqrt")).toBe("math.h");
      expect(StdlibFunctions.header("isdigit")).toBe("ctype.h");
      expect(StdlibFunctions.header("digitalWrite")).toBe("Arduino.h");
    });

    it("returns null for an unknown name", () => {
      expect(StdlibFunctions.header("definitelyNotStdlib")).toBeNull();
    });

    it("does not resolve inherited Object properties as functions", () => {
      // A plain-object lookup would answer "constructor" or "toString" here.
      expect(StdlibFunctions.header("constructor")).toBeNull();
      expect(StdlibFunctions.header("toString")).toBeNull();
    });
  });

  describe("isKnown()", () => {
    it("is true for a known function and false otherwise", () => {
      expect(StdlibFunctions.isKnown("fclose")).toBe(true);
      expect(StdlibFunctions.isKnown("nopeNotHere")).toBe(false);
    });

    it("is false for inherited Object properties", () => {
      expect(StdlibFunctions.isKnown("hasOwnProperty")).toBe(false);
    });
  });

  describe("returnsVoid()", () => {
    it("is true for void-returning library functions", () => {
      expect(StdlibFunctions.returnsVoid("free")).toBe(true);
      expect(StdlibFunctions.returnsVoid("perror")).toBe(true);
      expect(StdlibFunctions.returnsVoid("delay")).toBe(true);
      expect(StdlibFunctions.returnsVoid("digitalWrite")).toBe(true);
    });

    it("is false for functions that return a value", () => {
      expect(StdlibFunctions.returnsVoid("printf")).toBe(false);
      expect(StdlibFunctions.returnsVoid("malloc")).toBe(false);
      expect(StdlibFunctions.returnsVoid("strlen")).toBe(false);
    });

    it("is false for an unknown name, which isKnown() distinguishes", () => {
      // Both "returns a value" and "never heard of it" answer false here, so
      // callers must consult isKnown() to tell them apart.
      expect(StdlibFunctions.returnsVoid("nopeNotHere")).toBe(false);
      expect(StdlibFunctions.isKnown("nopeNotHere")).toBe(false);
    });
  });

  describe("internal consistency", () => {
    it("every void-returning name is also a known function", () => {
      // The two tables answer different halves of one question. A name in the
      // void set but absent from the headers table would report returnsVoid()
      // true while isKnown() said false -- so callers checking isKnown() first
      // would treat it as unresolvable and skip it.
      const voidNames = [
        "free",
        "perror",
        "clearerr",
        "rewind",
        "setbuf",
        "exit",
        "abort",
        "srand",
        "qsort",
        "assert",
        "pinMode",
        "digitalWrite",
        "analogWrite",
        "delay",
        "delayMicroseconds",
        "attachInterrupt",
        "detachInterrupt",
        "noInterrupts",
        "interrupts",
      ];
      for (const name of voidNames) {
        expect(StdlibFunctions.returnsVoid(name)).toBe(true);
        expect(StdlibFunctions.isKnown(name)).toBe(true);
      }
    });
  });

  describe("C-Next intrinsics (ADR-051)", () => {
    it("lists the builtins", () => {
      expect(StdlibFunctions.builtinNames().sort()).toEqual([
        "safe_div",
        "safe_mod",
      ]);
    });

    it("reports bool for safe_div and safe_mod", () => {
      expect(StdlibFunctions.builtinReturnType("safe_div")).toBe("bool");
      expect(StdlibFunctions.builtinReturnType("safe_mod")).toBe("bool");
    });

    it("returns null for a non-builtin", () => {
      expect(StdlibFunctions.builtinReturnType("printf")).toBeNull();
    });
  });
});
