/**
 * 2.2 Plan -- where a generated block sits among the declarations.
 *
 * `docs/architecture/README.md` §1 gives 2.2 Plan "declarations and order".
 * Almost all of that order is fixed and not a per-file decision: the banner,
 * then the self-include, then includes, helpers and declarations, in that
 * sequence for every file. One placement genuinely varies, and it is this one.
 *
 * ## It takes the shape of the file, not the file
 *
 * The obvious signature is `(tree)`, and it is the wrong one. #1317 records
 * that 86 modules outside `logic/parser/` import ANTLR contexts with no gate
 * confining them, and a new pass reaching for the parse tree to answer a
 * question about ORDER would be one more. The question is not "what is in this
 * declaration" -- it is "which declaration is the first that could use a
 * callback typedef", and a list of kinds answers that completely.
 *
 * So Render says what the file looks like and Plan says where the block goes.
 * Neither needs the other's inputs.
 */

import type TDeclarationKind from "../../transpiler/types/TDeclarationKind";

class DeclarationOrder {
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

export default DeclarationOrder;
