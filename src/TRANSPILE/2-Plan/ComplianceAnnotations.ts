import type IComplianceAnnotation from "../../transpiler/types/IComplianceAnnotation";

/**
 * 2.2 Plan -- which safety-standard rule shaped a construct, and how that is
 * said in the generated C.
 *
 * CLAUDE.md makes this a C-Next standard, not a nicety:
 *
 *   Whenever codegen emits code whose shape is dictated by a safety standard
 *   ... rather than by the obvious/naive translation, it MUST emit an
 *   explanatory comment directly above the generated construct. ... The
 *   comment names the standard + specific rule and gives a short WHY (what the
 *   naive form would have done and which rule it violates).
 *
 * The generated C is the certification artifact, so an auditor has to be able
 * to trace each non-obvious construct back to the rule that shaped it -- and,
 * separately, to enumerate every rule the transpiler cites at all. Three sites
 * used to build these strings by hand, and one of them had drifted off the
 * house form: no trailing period, and a parenthetical naming the C-Next
 * construct rather than what the naive C would have done. Nothing could have
 * noticed, because the form was a convention in prose and the text was a string
 * literal three files apart.
 *
 * So the form is `render`'s, the rules are this table, and
 * `__tests__/ComplianceAnnotations.test.ts` holds both to CLAUDE.md's shape.
 *
 * Distinct from `MisraSuppressionUtils`, which emits `cppcheck-suppress`
 * directives -- a suppression tells a TOOL to stop reporting; an annotation
 * tells a READER why the code looks like this.
 * Adding a rule means adding a row; it cannot be added off-form.
 */

class ComplianceAnnotations {
  /** The only standard cited today. Kept explicit so a second one is visible. */
  private static readonly STANDARD = "MISRA C:2012";

  /** ADR-026 `forever` lowers to `for (;;)`. */
  static readonly FOREVER_LOOP: IComplianceAnnotation = {
    rule: "14.3",
    what: "infinite loop written as `for (;;)` for C-Next `forever`",
    why: "`while (1)` has a controlling expression with an invariant value, which the rule forbids",
  };

  /** ADR-029's generated init function needs a declaration before its definition. */
  static readonly INIT_PROTOTYPE: IComplianceAnnotation = {
    rule: "8.4",
    what: "declaration for the ADR-029 generated init function",
    why: "the definition has external linkage and would otherwise be undeclared",
  };

  /**
   * A slice copy unrolled to per-element writes.
   *
   * Only cited when an equivalent `memcpy` would genuinely violate the rule --
   * the source type is known and differs from the destination element type, so
   * the two pointer arguments would be incompatible. Matching types, an unknown
   * source type, or a single element cite nothing (#1081).
   */
  static sliceUnroll(
    destCType: string,
    srcCType: string,
  ): IComplianceAnnotation {
    return {
      rule: "21.15",
      what: "slice copy unrolled to per-element writes",
      why: `memcpy would pass incompatible pointer types: ${destCType}* vs ${srcCType}*`,
    };
  }

  /**
   * The one rendering of the house form,
   * `/* <Standard> Rule <N>: <what> (<why>). *\/`.
   */
  static render(annotation: IComplianceAnnotation): string {
    return (
      `/* ${ComplianceAnnotations.STANDARD} Rule ${annotation.rule}: ` +
      `${annotation.what} (${annotation.why}). */`
    );
  }

  /**
   * Every annotation this transpiler can emit, for the tests that hold the set
   * to the house form -- and so that "which rules does our codegen cite?" has
   * an answer that is read from the code rather than grepped for.
   */
  static all(): readonly IComplianceAnnotation[] {
    return [
      ComplianceAnnotations.FOREVER_LOOP,
      ComplianceAnnotations.INIT_PROTOTYPE,
      ComplianceAnnotations.sliceUnroll("uint8_t", "uint32_t"),
    ];
  }
}

export default ComplianceAnnotations;
