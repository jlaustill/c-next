/**
 * Shared factory for C-Next symbols in tests.
 *
 * Every field on IBaseSymbol is supplied here, so adding one costs a single
 * edit rather than an edit per literal. Before this existed, 44 literals across
 * 8 test files each spelled the base fields out; #1285 adding two identity
 * fields would have been 44 edits, and PR #1281 paid the same tax on a
 * different interface.
 *
 * The identity fields in particular must NOT be hand-written in a test. They
 * are derived from the scope chain by ScopeUtils.identityOf, and a test that
 * hardcodes them can assert a name the transpiler would never produce -- which
 * is the failure this whole line of work is about.
 */

import ScopeUtils from "../../../../utils/ScopeUtils";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import TSymbolKindCNext from "../../../../transpiler/types/symbol-kinds/TSymbolKindCNext";
import TVisibility from "../../../../transpiler/types/TVisibility";
import TestSourceSpan from "../../../../transpiler/types/__testUtils__/testSourceSpan";
import type ISourceSpan from "../../../../transpiler/types/ISourceSpan";

interface IBaseOverrides<K extends TSymbolKindCNext> {
  readonly kind: K;
  readonly name: string;
  readonly scopePath?: string;
  readonly sourceFile?: string;
  readonly span?: ISourceSpan;
  readonly sourceLanguage?: ESourceLanguage;
  readonly visibility?: TVisibility;
}

/**
 * Static utility class for building symbol base fields in tests.
 */
class TestSymbolUtils {
  /**
   * Every IBaseSymbol field, with the identity pair computed the same way the
   * collectors compute it.
   *
   * Defaults to file scope (`""`), which is what most tests want: a global
   * symbol's qualified name is its bare name, so `base({kind, name}).name` and
   * `.fullyQualifiedCName` agree, and a test that cares about scoping passes a
   * scope path and gets the qualified form for free.
   */
  static base<K extends TSymbolKindCNext>(
    overrides: IBaseOverrides<K>,
  ): {
    kind: K;
    name: string;
    scopePath: string;
    sourceFile: string;
    span: ISourceSpan;
    sourceLanguage: ESourceLanguage;
    visibility: TVisibility;
    fullyQualifiedCName: string;
    cnxScopedName: string;
  } {
    const scopePath = overrides.scopePath ?? "";
    const name = overrides.name;
    return {
      kind: overrides.kind,
      name,
      scopePath,
      sourceFile: overrides.sourceFile ?? "test.cnx",
      span: overrides.span ?? TestSourceSpan.at(1),
      sourceLanguage: overrides.sourceLanguage ?? ESourceLanguage.CNext,
      visibility: overrides.visibility ?? "public",
      ...ScopeUtils.identityOf({ name, scopePath }),
    };
  }
}

export default TestSymbolUtils;
