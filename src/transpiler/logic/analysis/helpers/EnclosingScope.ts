/**
 * The named `scope` a tree-walking analyzer is currently inside, as a dotted
 * PATH rather than a leaf name.
 *
 * #1357. Five analyzers each tracked this as a `string | null` assigned from
 * `ctx.IDENTIFIER().getText()`, then qualified members with
 * `QualifiedCName.fromParts([thatLeaf, member])`. That drops every outer scope,
 * which stays invisible because `scopeMember` admits no `scopeDeclaration`
 * (`grammar/CNext.g4`). ADR-016 makes that a permanent decision rather than the
 * coincidence #1357 recorded, so the leaf really is the whole path in source. The
 * stack stays anyway: five sites each deciding that separately is the duplicate-path
 * shape this project forbids, and the assumption is wrong at the registry's API,
 * which accepts a dotted path and builds the chain.
 *
 * A stack rather than a single slot for the same reason: the leaf is only
 * sufficient at depth one, and the whole point is to stop encoding that
 * assumption at each site.
 *
 * #1298: this used to resolve the stack to a scope OBJECT through
 * `SymbolRegistry.getOrCreateScope`, which meant an analyzer could create a
 * registry entry as a side effect of asking where it was. The stack was already a
 * `string[]`; joining it is the whole answer, so the round trip through the
 * registry -- and the ordering argument that made it safe -- is gone rather than
 * documented.
 */
import QualifiedCName from "../../../../utils/QualifiedCName";

class EnclosingScope {
  /** Leaf names of the scope declarations currently open, outermost first. */
  private readonly path: string[] = [];

  /**
   * The path of the scope named `leaf` declared directly inside `parentPath`.
   *
   * The one implementation of "descend one named scope", shared with
   * `DeclarationScopeCollector`, which carries the same fact per parse node
   * rather than on a stack. Two spellings of this would be two places that
   * decide what a nested scope's path is.
   *
   * `fromSourceParts` drops the empty parent at file scope, so no branch is
   * needed for it.
   */
  static child(parentPath: string, leaf: string): string {
    return QualifiedCName.fromSourceParts([parentPath, leaf]);
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
   * The path of the scope currently open, or `""` at file scope.
   *
   * The empty path and a named scope are handled uniformly by
   * `ScopeUtils.qualifyInScope`, so callers do not branch on it.
   */
  current(): string {
    return this.path.join(QualifiedCName.SOURCE_SEPARATOR);
  }
}

export default EnclosingScope;
