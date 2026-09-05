import type TSymbol from "./symbols/TSymbol";

/**
 * What ONE FILE DECLARES — the artifact of pass 1.3 Declare (#1472).
 *
 * `docs/architecture/README.md` names this as Declare's output: 1.3 is sole
 * author of identity and declaration, and "after 1.3, nothing may compute a
 * symbol's name". Until this type existed the pass returned a bare `TSymbol[]`,
 * which carried the symbols and nothing about the file that declared them — so
 * every per-file fact had to be recomputed by whoever wanted it, or passed
 * alongside as another parameter.
 *
 * #1382 landed 4 of 6 of #1358's definition of done and refused the other two in
 * writing, because satisfying the wording with a rename — `declare(tree, file,
 * program)` for `resolve(tree, file, externalScopeTypes)` — "moves no decision"
 * and "would have READ as done". This type is the decision that rename would
 * have skipped: the artifact exists, and `declaredScopeTypes` is a fact that
 * moved onto it rather than a parameter that changed name.
 *
 * ## What may live here, and what may not
 *
 * Every field must be **computable with only this file's parse tree open**. That
 * is the whole discriminator, and it is what makes 1.3 a per-file pass: a fact
 * needing a second file belongs to 1.4 Resolve and its `Program`, never here.
 * `declaredScopeTypes` qualifies — it is what THIS file declares. The set of
 * scope types this file can SEE does not, because it is the union across an
 * include closure, and that is a cross-file fact by construction.
 *
 * Keeping the two apart is the point rather than a tidiness: `CNextResolver`
 * previously held one set that was seeded from included files and then filled
 * with local declarations, so "declared here" and "visible here" were the same
 * object and neither could be read back. #1312 is what that costs at the other
 * end of the pipeline — a per-file view and a run-wide table disagreeing, with
 * no way to ask which question a given caller meant.
 */
interface IFileSymbols {
  /** The file these symbols were declared in. */
  readonly sourceFile: string;

  /** Every symbol this file declares. */
  readonly symbols: ReadonlyArray<TSymbol>;

  /**
   * The qualified names of the enums, structs and bitmaps THIS FILE declares
   * inside a scope (ADR-057, collected by Declare's pass 0b).
   *
   * Registers are excluded, matching `CodeGenState.isScopeType`: a register
   * declares a variable at an address, not a type.
   *
   * This is the per-file half of the question `externalScopeTypes` answers
   * across a whole run. A file that reopens a scope declared elsewhere
   * contributes only its own half here (#1333), which is exactly why the seed
   * cannot be reconstructed from any single file and belongs to 1.4.
   */
  readonly declaredScopeTypes: ReadonlySet<string>;
}

export default IFileSymbols;
