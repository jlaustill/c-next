/**
 * #1991: 2.2 plans how each struct initializer is written (ADR-014) before
 * 2.3 writes it: a plain designated initializer in a declaration (#992),
 * a compound literal in a ternary arm, an argument or an assignment.
 */
import { describe, it, expect } from "vitest";
import ProgramGeneration from "./ProgramGeneration";
import type TStructInitializerForm from "../../../../cnx/TRANSPILE/2-Plan/types/TStructInitializerForm";

/** 2.2's form for each struct initializer in a whole file, keyed by its first field's value */
function plannedForms(source: string): Map<string, TStructInitializerForm> {
  const plan = ProgramGeneration.planSource(source);
  const forms = new Map<string, TStructInitializerForm>();
  for (const [initializer, form] of plan.structInitializers) {
    const first = initializer.fields[0].value;
    forms.set(first.kind === "literal" ? first.text : first.kind, form);
  }
  return forms;
}

describe("2.2 plans how each struct initializer is written", () => {
  it("writes a declaration's plainly and any other as a compound literal", () => {
    const forms = plannedForms(
      [
        "struct P { u8 x; }",
        "struct Q { P p; u8 y; }",
        "P g <- { x: 1 };",
        "u8 take(P p) { return p.x; }",
        "void f(bool c) {",
        "  P a <- { x: 2 };",
        "  Q q <- { p: { x: 3 }, y: 4 };",
        "  P arr[2] <- [{ x: 5 }, { x: 6 }];",
        "  P b <- (c) ? { x: 7 } : { x: 8 };",
        "  u8 r <- take({ x: 9 });",
        "  a <- { x: 10 };",
        "  for (P i <- { x: 13 }; i.x < 20; i.x +<- 1) {}",
        "}",
        "P h <- (true) ? { x: 11 } : { x: 12 };",
      ].join("\n"),
    );

    expect(Object.fromEntries(forms)).toEqual({
      "1": "designated",
      "2": "designated",
      structInitializer: "designated",
      "3": "designated",
      "5": "designated",
      "6": "designated",
      "7": "compound",
      "8": "compound",
      "9": "compound",
      "10": "compound",
      "11": "designated",
      "12": "designated",
      "13": "compound",
    });
  });
});

describe("2.2 plans a struct literal argument from its initializer's form", () => {
  /** 2.2's argument form for each struct literal argument, keyed by its first field's value */
  function argumentForms(source: string): Map<string, string | undefined> {
    const plan = ProgramGeneration.planSource(source);
    const forms = new Map<string, string | undefined>();
    for (const [expression, argument] of plan.arguments) {
      if (expression.kind !== "structInitializer") continue;
      const first = expression.fields[0].value;
      forms.set(
        first.kind === "literal" ? first.text : first.kind,
        argument.form?.kind,
      );
    }
    return forms;
  }

  // A call in a file-scope initializer is E0909 since #1735, so a struct
  // literal argument is only ever written in a function
  it("takes a compound literal's address (#1530)", () => {
    const forms = argumentForms(
      [
        "struct P { u8 x; }",
        "u8 take(P p) { return p.x; }",
        "void f() {",
        "  u8 r <- take({ x: 2 });",
        "}",
      ].join("\n"),
    );

    expect(Object.fromEntries(forms)).toEqual({
      "2": "literal-address",
    });
  });
});
