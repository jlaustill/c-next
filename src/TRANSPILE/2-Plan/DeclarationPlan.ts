/**
 * 2.2 Plan -- decides what this file's declarations look like, before any is
 * rendered.
 *
 * The companion to `EmissionPlan`, which decides includes and helpers from
 * facts the declarations raise WHILE rendering. Both answers here depend on
 * nothing that rendering produces, so they are settled first and Render reads
 * them instead of interpreting the state they came from.
 *
 * ## It takes the shape of the file, not the file
 *
 * `callbackTypedefsPrecede` is stated over a list of KINDS because that is all
 * the decision needs. #1317 records that 86 modules outside `logic/parser/`
 * import ANTLR contexts with no gate confining them, and a pass outside the
 * parse layer reaching for the tree to answer a question about ORDER would be
 * one more. So Render says what the file looks like and Plan says where the
 * block goes; neither needs the other's inputs.
 *
 * ## Why this absorbed `DeclarationOrder` rather than calling it
 *
 * The order decision lived in its own module, and adding a plan that called it
 * made a THIRD file reasoning about declaration kinds -- which
 * `render-decides-nothing.test.ts` caught immediately, asserting there are
 * exactly two: the decider and the classifier that produces the kinds. The
 * guard was right. §1 gives 2.2 Plan "declarations and order" as one
 * responsibility, and splitting the decider from the plan that carries its
 * answer is two modules for one job -- so the decider is the plan, and the
 * guard still counts two files rather than being widened to three.
 */

import type IDeclarationPlan from "../../transpiler/types/IDeclarationPlan";
import type TDeclarationKind from "../../transpiler/types/TDeclarationKind";
import HeaderOwnership from "./HeaderOwnership";

class DeclarationPlan {
  /**
   * Decide this file's declaration emission.
   *
   * @param kinds every declaration in the file, in source order
   * @param selfIncludeAdded whether this file emitted `#include "own.h"`
   */
  static build(
    kinds: readonly TDeclarationKind[],
    selfIncludeAdded: boolean,
  ): IDeclarationPlan {
    return Object.freeze({
      headerOwnsTypeDefinitions:
        HeaderOwnership.ownsDeclarations(selfIncludeAdded),
      callbackTypedefsPrecede: DeclarationPlan.callbackTypedefsPrecede(kinds),
    });
  }

  /**
   * The index of the declaration the callback typedef block precedes, or null
   * to place it last.
   *
   * ADR-029 typedefs must come after the type declarations they may name and
   * before the first function that may use one (#1212). A file with no function
   * and no scope has nothing for them to precede, and they go at the end --
   * where they are still after every type, which is the half of the rule that
   * still applies.
   *
   * @param kinds every declaration in the file, in source order
   */
  static callbackTypedefsPrecede(
    kinds: readonly TDeclarationKind[],
  ): number | null {
    const at = kinds.findIndex(
      (kind) => kind === "function" || kind === "scope",
    );
    return at === -1 ? null : at;
  }
}

export default DeclarationPlan;
