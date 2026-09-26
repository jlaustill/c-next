/**
 * #1177 / #1452 box 5: the symbol table has no hand-maintained teardown.
 *
 * ## The defect
 *
 * `SymbolTable` carried TWELVE index fields and `clear()` listed ELEVEN.
 * `externalDeclarationNames` was added and the teardown was not updated --
 * exactly what #1177 predicted: "adding an index still requires editing
 * `clear()` separately" is one decision written in two places, and the second
 * drifted.
 *
 * It was not inert. Those names are written by `Transpiler` from
 * translation-unit preprocessing recovery and read by `FunctionCallAnalyzer`,
 * where `hasExternalDeclaration(name)` SUPPRESSES a diagnostic. A name
 * recovered in one run therefore silenced a diagnostic in the next, and
 * `ServeCommand` holds a `private static transpiler`, so that second run is a
 * real one. A missing diagnostic, with nothing failing.
 *
 * ## What this pins, and what it deliberately does not
 *
 * Adding the twelfth line would have fixed the instance and left the shape. A
 * run BUILDS its table instead, so there is no teardown to forget: the defect
 * class is removed rather than guarded.
 *
 * That leaves nothing behavioral to assert. "A freshly constructed table is
 * empty" was never false, so a test asserting it would have passed before the
 * fix as readily as after -- decoration, which a first draft of this file was.
 * What CAN regress is someone reintroducing the teardown, so that is what is
 * pinned. Mutation check: add a `clear()` to `SymbolTable` and this goes red.
 */

import { describe, it, expect } from "vitest";
import SymbolTable from "../SymbolTable";

describe("the symbol table has no hand-maintained teardown (#1177)", () => {
  it("declares no reset-style method a new index could be left out of", () => {
    // Aimed at the shape rather than one spelling: any of these is a teardown
    // someone has to remember to extend, which is the decision #1177 is about.
    const surface = Object.getOwnPropertyNames(SymbolTable.prototype);
    const teardown = surface.filter((name) =>
      /^(clear|reset|dispose|teardown)$/.test(name),
    );

    expect(teardown).toEqual([]);
  });

  it("finds the prototype surface at all", () => {
    // Population control. An empty surface satisfies the assertion above and
    // reads exactly like a clean class -- the failure `unknown-carriers.test.ts`
    // shipped with, where the control was satisfied by the arm that did not
    // matter.
    const surface = Object.getOwnPropertyNames(SymbolTable.prototype);

    expect(surface.length).toBeGreaterThan(20);
    expect(surface).toContain("hasExternalDeclaration");
  });
});
