/**
 * The named `scope` a tree-walking analyzer is currently inside, as a scope
 * REFERENCE rather than a leaf name.
 *
 * #1357. Five analyzers each tracked this as a `string | null` assigned from
 * `ctx.IDENTIFIER().getText()`, then qualified members with
 * `QualifiedCName.fromParts([thatLeaf, member])`. That drops every outer scope,
 * which is invisible today only because `scopeMember` admits no
 * `scopeDeclaration` (`grammar/CNext.g4`) -- a coincidence, not a decision. Five
 * copies of the same coincidence is also five places to fix when the grammar
 * changes, which is the duplicate-path shape this project forbids outright.
 *
 * A stack rather than a single slot for the same reason: the leaf is only
 * sufficient at depth one, and the whole point is to stop encoding that
 * assumption at each site.
 *
 * Resolution goes through `SymbolRegistry.getOrCreateScope`, which is total and
 * repeat-safe by design -- that is how a scope spanned across two files merges
 * (#1333). Totality matters here: the string version's `else` branch produced a
 * bare name, so a lookup miss would silently emit an unqualified symbol rather
 * than fail. Stage 3 declares every file before Stage 5 analyzes any
 * (`Transpiler.ts` -- `_declareFile` in the Stage 3 loop, `runAnalyzers` inside
 * `_transpileFile`), so during analysis this returns the scope that already
 * exists and creates nothing.
 */
import SymbolRegistry from "../../../state/SymbolRegistry";
import ScopeUtils from "../../../../utils/ScopeUtils";
import QualifiedCName from "../../../../utils/QualifiedCName";
import type IScopeSymbol from "../../../types/symbols/IScopeSymbol";

class EnclosingScope {
  /** Leaf names of the scope declarations currently open, outermost first. */
  private readonly path: string[] = [];

  /**
   * The scope named `leaf` declared directly inside `parent`.
   *
   * The one implementation of "descend one named scope", shared with
   * `DeclarationScopeCollector`, which carries the same fact per parse node
   * rather than on a stack. Two spellings of this would be two places that
   * decide what a nested scope's path is.
   *
   * The registry is keyed by SOURCE path (`Outer.Inner`), not by the transpiled
   * C name, so the parent chain is re-joined with the source separator.
   */
  static child(parent: IScopeSymbol | null, leaf: string): IScopeSymbol {
    const outer =
      parent && !ScopeUtils.isGlobalScope(parent)
        ? ScopeUtils.getScopePath(parent)
        : [];
    return SymbolRegistry.getOrCreateScope(
      [...outer, leaf].join(QualifiedCName.SOURCE_SEPARATOR),
    );
  }

  /** Enter a `scope` declaration named `leaf`. */
  enter(leaf: string): void {
    this.path.push(leaf);
  }

  /** Leave the innermost open `scope` declaration. */
  exit(): void {
    this.path.pop();
  }

  /** Are we inside any named scope? */
  isInsideScope(): boolean {
    return this.path.length > 0;
  }

  /**
   * The scope currently open, or null at file scope.
   *
   * Null and the global scope mean the same thing to `ScopeUtils.qualifyInScope`
   * -- a bare name -- so callers do not branch on it.
   */
  current(): IScopeSymbol | null {
    if (this.path.length === 0) {
      return null;
    }
    return SymbolRegistry.getOrCreateScope(
      this.path.join(QualifiedCName.SOURCE_SEPARATOR),
    );
  }
}

export default EnclosingScope;
