/**
 * 2.2 Plan -- which declarations the included header owns, and this file
 * therefore does not emit.
 *
 * `docs/architecture/README.md` §1 gives 2.2 Plan "declarations and order".
 * `DeclarationPlan` decides the order half and carries this one. A `.c`
 * that includes its own generated header must not also define the types that
 * header defines, or the translation unit declares them twice (#369/#1164).
 *
 * ## The fact and the consequence are different things
 *
 * `selfIncludeAdded` is a FACT about the include list -- "did this file emit
 * `#include "own.h"`?". Whether the header therefore owns a declaration is the
 * CONSEQUENCE, and CLAUDE.md is explicit that sharing the fact is not enough:
 *
 *   Single source of truth means the DECISION, not just the data. Sharing one
 *   detection function (or setting one flag on a shared model) is NOT enough if
 *   each path then re-derives the CONSEQUENCES independently.
 *
 * Five sites derived it independently from that one flag, in four different
 * spellings -- `? "" :` in two declaration generators, `? [] :` inside
 * `StructGenerator`, an `&&` against a per-name predicate for callback
 * typedefs, and a `&& !` inside this pass for the ADR-040 `ISR` typedef. They
 * agreed, which is the problem: nothing held them together except that one
 * rule had been written out five times and nobody had changed it yet.
 *
 * ## What ownership covers, and what it does not
 *
 * It covers the TYPE -- the `typedef` a header can declare and a translation
 * unit may not repeat. It does NOT cover a definition with external linkage and
 * no other home: ADR-029's struct init function is still emitted here, which is
 * why `StructGenerator` suppresses only its type lines rather than returning
 * early. Suppressing the whole generator silently dropped that function once
 * already (#1164), so the distinction is load-bearing rather than tidy.
 */
class HeaderOwnership {
  /**
   * Whether the included header owns the declarations this file would
   * otherwise emit.
   *
   * @param selfIncludeAdded whether this file emitted `#include "own.h"`
   */
  static ownsDeclarations(selfIncludeAdded: boolean): boolean {
    return selfIncludeAdded;
  }
}

export default HeaderOwnership;
