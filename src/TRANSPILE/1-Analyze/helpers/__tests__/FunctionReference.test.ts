import { afterEach, beforeEach, describe, expect, it } from "vitest";

import CNextResolver from "../../../../PARSE/3-Declare/cnext";
import CNextSourceParser from "../../../../transpiler/logic/parser/CNextSourceParser";
import CodeGenState from "../../../../transpiler/state/CodeGenState";
import Program from "../../../../PARSE/4-Resolve/Program";
import SymbolRegistry from "../../../../transpiler/state/SymbolRegistry";
import FunctionReference from "../FunctionReference";

/**
 * #1322. Which C-Next function a spelling denotes, and -- the part that is a
 * DECISION rather than a lookup -- the ORDER the candidates are tried in.
 *
 * ADR-057: inside a scope, a bare `f` means the scope's own `f` when one
 * exists and the global `f` otherwise, and codegen emits `S__f()` for a bare
 * `f()` inside `S` whichever of the two is declared. Two analyzers held that
 * order independently and one held it BACKWARDS, so a bare `f();` inside a
 * scope was checked against the global `f`. Only two scopes -- or a scope and
 * a global -- sharing a name make the order observable at all.
 */
const build = (source: string) => {
  SymbolRegistry.reset();
  const { tree } = CNextSourceParser.parse(source);
  CodeGenState.program = Program.build([CNextResolver.resolve(tree, "a.cnx")]);
};

beforeEach(() => {
  SymbolRegistry.reset();
});

afterEach(() => {
  CodeGenState.reset();
});

describe("FunctionReference.candidates -- the ADR-057 order", () => {
  it("tries the enclosing scope's member before the file-scope name", () => {
    expect(FunctionReference.candidates("f", "S", false)).toEqual([
      "S__f",
      "f",
    ]);
  });

  it("gives a `global.` call exactly one candidate", () => {
    // Falling back to the scope's `f` here would make `global.f` resolve to
    // the very thing the spelling exists to bypass.
    expect(FunctionReference.candidates("f", "S", true)).toEqual(["f"]);
  });

  it("has one candidate at file scope, where there is no scope to prefer", () => {
    expect(FunctionReference.candidates("f", "", false)).toEqual(["f"]);
  });
});

describe("FunctionReference.candidatesForTypeText", () => {
  it("reads an array spelling as its element type", () => {
    expect(FunctionReference.candidatesForTypeText("onDown[4]", "")).toEqual([
      "onDown",
    ]);
  });

  it("binds `this.` to the enclosing scope and nothing else", () => {
    expect(
      FunctionReference.candidatesForTypeText("this.handler", "S"),
    ).toEqual(["S__handler"]);
    // Outside a scope, `this.` names nothing -- E0431 is the rule that says so.
    expect(FunctionReference.candidatesForTypeText("this.handler", "")).toEqual(
      [],
    );
  });

  it("binds `global.` to the file scope, unqualified", () => {
    expect(
      FunctionReference.candidatesForTypeText("global.onDown", "S"),
    ).toEqual(["onDown"]);
  });

  it("transpiles an explicitly qualified path", () => {
    expect(
      FunctionReference.candidatesForTypeText("Outer.Inner.h", ""),
    ).toEqual(["Outer__Inner__h"]);
  });

  it("searches from the enclosing scope for a bare name", () => {
    expect(FunctionReference.candidatesForTypeText("handler", "S")).toEqual([
      "S__handler",
      "handler",
    ]);
  });
});

describe("FunctionReference.ofTypeText -- the order, observed", () => {
  it("resolves a bare name to the SCOPE's function over the global one", () => {
    // The shape that makes the order observable: both exist, and they differ.
    build(
      [
        "u8 handler() { return 1; }",
        "scope S {",
        "    public void handler() {}",
        "}",
      ].join("\n"),
    );
    const found = FunctionReference.ofTypeText("handler", "S");
    expect(found).not.toBeNull();
    expect(FunctionReference.cNameOf(found!)).toBe("S__handler");
  });

  it("falls back to the global one when the scope declares none", () => {
    build("u8 handler() { return 1; }\nscope S {\n    public void go() {}\n}");
    const found = FunctionReference.ofTypeText("handler", "S");
    expect(FunctionReference.cNameOf(found!)).toBe("handler");
  });

  it("takes the global one when the spelling says `global.`", () => {
    build(
      [
        "u8 handler() { return 1; }",
        "scope S {",
        "    public void handler() {}",
        "}",
      ].join("\n"),
    );
    const found = FunctionReference.ofTypeText("global.handler", "S");
    expect(FunctionReference.cNameOf(found!)).toBe("handler");
  });

  it("answers null for a name the program does not declare as a function", () => {
    build("u8 value <- 1;");
    expect(FunctionReference.ofTypeText("value", "")).toBeNull();
    expect(FunctionReference.ofTypeText("missing", "")).toBeNull();
  });

  it("answers null with no program at all, rather than throwing", () => {
    CodeGenState.reset();
    expect(FunctionReference.ofTypeText("handler", "")).toBeNull();
  });
});
