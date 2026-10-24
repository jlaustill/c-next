/**
 * What fails if a MISRA guideline's compliance regresses (#1610). A row in
 * docs/misra-compliance.md that says **Enforced** or **By Design** names at
 * least one of these, or the open issue tracking that it has none yet.
 */
type TMisraGuard =
  /** `validate:c`'s cppcheck MISRA addon, with the rule kept out of BASELINE */
  | { readonly kind: "cppcheck"; readonly rule?: string }
  /** `validate:c`'s dump check for what the addon cannot see (`MisraDump`) */
  | { readonly kind: "dump"; readonly rule: string }
  /** A flag the integration compile passes, so a violation fails the cell */
  | { readonly kind: "compile-flag"; readonly flag: string }
  /** A diagnostic with a `.expected.error` fixture that asserts it fires */
  | { readonly kind: "diagnostic"; readonly code: string }
  /** An npm script whose run fails on a violation */
  | { readonly kind: "script"; readonly script: string }
  /** No guard yet; the open issue that tracks adding one */
  | { readonly kind: "issue"; readonly issue: number };

export default TMisraGuard;
