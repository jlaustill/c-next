/**
 * ADR-057: which C names a spelling may denote, in the order to try them.
 *
 * #1322 review: three analyzers had written this rule out, each as its own
 * nested ternary -- `EnumValueResolver` for an enum type, `ShiftAnalyzer` for a
 * const shift amount, `FunctionReference` for a callee. The rule is one thing:
 *
 * - `this.X` states where to look. It is X in the ENCLOSING SCOPE and nothing
 *   else. Falling back to a bare global `X` made `this.Global` resolve to a
 *   global enum, so an invalid spelling read as valid.
 * - `global.X` states where to look too, at FILE SCOPE, and must not be
 *   scope-qualified.
 * - only a BARE name searches, and it searches the enclosing scope first, then
 *   file scope.
 *
 * Three copies of that could disagree about any of those three sentences, and
 * a lookup that searches differently resolves to a different symbol -- which is
 * not a style problem but a wrong answer. Verified against each caller before
 * they were pointed here: every one produced the identical list for all three
 * roots.
 */
class ScopeCandidates {
  /**
   * @param root the spelling's leading keyword, or null for a bare name
   * @param scoped the name qualified by the enclosing scope, or null when
   *   there is no enclosing scope to qualify by
   * @param unqualified the file-scope spellings, in order. More than one where
   *   a caller accepts both a transpiled C name and the source-form path.
   */
  static forRoot(
    root: "this" | "global" | null,
    scoped: string | null,
    unqualified: readonly string[],
  ): string[] {
    if (root === "this") return scoped === null ? [] : [scoped];
    if (root === "global") return [...unqualified];
    return scoped === null ? [...unqualified] : [scoped, ...unqualified];
  }
}

export default ScopeCandidates;
