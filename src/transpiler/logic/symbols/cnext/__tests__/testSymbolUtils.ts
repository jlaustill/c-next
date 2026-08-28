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

import ScopeUtils from "../../../../../utils/ScopeUtils";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import IScopeSymbol from "../../../../types/symbols/IScopeSymbol";
import TSymbolKindCNext from "../../../../types/symbol-kinds/TSymbolKindCNext";

interface IBaseOverrides<K extends TSymbolKindCNext> {
  readonly kind: K;
  readonly name: string;
  readonly scope?: IScopeSymbol;
  readonly sourceFile?: string;
  readonly sourceLine?: number;
  readonly sourceLanguage?: ESourceLanguage;
  readonly isExported?: boolean;
}

/**
 * Static utility class for building symbol base fields in tests.
 */
class TestSymbolUtils {
  /**
   * Every IBaseSymbol field, with the identity pair computed the same way the
   * collectors compute it.
   *
   * Defaults to the global scope, which is what most tests want: a global
   * symbol's qualified name is its bare name, so `base({kind, name}).name` and
   * `.fullyQualifiedCName` agree, and a test that cares about scoping passes a
   * scope and gets the qualified form for free.
   */
  static base<K extends TSymbolKindCNext>(
    overrides: IBaseOverrides<K>,
  ): {
    kind: K;
    name: string;
    scope: IScopeSymbol;
    sourceFile: string;
    sourceLine: number;
    sourceLanguage: ESourceLanguage;
    isExported: boolean;
    fullyQualifiedCName: string;
    cnxScopedName: string;
  } {
    const scope = overrides.scope ?? ScopeUtils.createGlobalScope();
    const name = overrides.name;
    return {
      kind: overrides.kind,
      name,
      scope,
      sourceFile: overrides.sourceFile ?? "test.cnx",
      sourceLine: overrides.sourceLine ?? 1,
      sourceLanguage: overrides.sourceLanguage ?? ESourceLanguage.CNext,
      isExported: overrides.isExported ?? true,
      ...ScopeUtils.identityOf({ name, scope }),
    };
  }
}

export default TestSymbolUtils;
