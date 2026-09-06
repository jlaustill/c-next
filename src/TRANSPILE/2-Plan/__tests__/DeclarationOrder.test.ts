/**
 * #1212/#1449: where the callback typedef block sits.
 *
 * The property is stated over the SHAPE of a file — a list of kinds — because
 * that is all the decision needs. Handing it a parse tree would make a pass
 * outside the parse layer depend on ANTLR to answer a question about order,
 * which is #1317's shape.
 */

import DeclarationOrder from "../DeclarationOrder";
import type TDeclarationKind from "../../../transpiler/types/TDeclarationKind";

const precede = (kinds: TDeclarationKind[]): number | null =>
  DeclarationOrder.callbackTypedefsPrecede(kinds);

describe("DeclarationOrder.callbackTypedefsPrecede", () => {
  it("puts them before the first function", () => {
    expect(precede(["other", "other", "function", "other"])).toBe(2);
  });

  it("puts them before the first scope, which may also use one", () => {
    expect(precede(["other", "scope"])).toBe(1);
  });

  it("takes whichever of the two comes first", () => {
    expect(precede(["scope", "function"])).toBe(0);
    expect(precede(["function", "scope"])).toBe(0);
  });

  // After every type is the half of the rule that still applies when there is
  // no function to come before.
  it.each([
    ["a file of only types", ["other", "other"]],
    ["an empty file", []],
  ] as [string, TDeclarationKind[]][])(
    "places them last in %s",
    (_label, kinds) => {
      expect(precede(kinds)).toBeNull();
    },
  );

  it("is the FIRST function, not the last", () => {
    expect(precede(["function", "other", "function"])).toBe(0);
  });
});
