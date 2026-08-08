/**
 * QualifiedCName - the single source of truth for how C-Next builds C identifiers
 * from scope-qualified names.
 *
 * ADR-016 gives scope members the C name `Scope_member`; ADR-017 does the same for
 * enum members. ADR-063 reserves the separator so that join is injective: because a
 * C-Next identifier may not end with `_` or contain `__`, a name built from N
 * components splits back into exactly those N components, and a plain identifier can
 * never collide with a qualified one.
 *
 * That guarantee only holds if EVERY producer and consumer agrees on the separator.
 * Before this module the separator was written out at ~80 independent sites and
 * reverse-parsed at 14 more, so changing it meant changing all of them in lockstep —
 * the duplicate-code-path anti-pattern this project forbids outright. Route all
 * qualified-name construction and decomposition through here.
 *
 * NOT for C++ namespace qualification (`Ns::Type`). That is a different separator for
 * a different target language; see FormatUtils.getScopeSeparator().
 */
class QualifiedCName {
  /**
   * The separator between components of a qualified C name.
   *
   * ADR-063 reserves this sequence: no C-Next identifier may contain it, which is
   * what makes the join injective. Enforced by E0201 (IdentifierSyntaxAnalyzer).
   */
  static readonly SEPARATOR = "__";

  /**
   * The separator used in C-Next source to qualify a name (`Scope.member`).
   */
  static readonly SOURCE_SEPARATOR = ".";

  /**
   * Build a qualified C name from its components, outermost first.
   *
   * Empty and undefined components are dropped, so a global symbol (no scope) keeps
   * its bare name. Any component may itself be a dotted source path (`"Outer.Inner"`),
   * which is expanded before joining.
   *
   * @param components Ordered name parts, e.g. ["Motor", "State", "IDLE"]
   * @returns The generated C identifier, e.g. "Motor__State__IDLE"
   */
  static join(...components: (string | undefined | null)[]): string {
    return QualifiedCName.toParts(components).join(QualifiedCName.SEPARATOR);
  }

  /**
   * Split a qualified C name back into its components.
   *
   * Exact inverse of join() for names built from ADR-063-conformant identifiers.
   *
   * @param qualifiedName A generated C identifier, e.g. "Motor__State__IDLE"
   * @returns The components, e.g. ["Motor", "State", "IDLE"]
   */
  static split(qualifiedName: string): string[] {
    return qualifiedName.split(QualifiedCName.SEPARATOR);
  }

  /**
   * Whether a generated C identifier carries a scope qualification.
   *
   * Use instead of testing for a bare underscore: a plain identifier is allowed to
   * contain single underscores (`tick_count`), so `includes("_")` misreports those
   * as qualified.
   */
  static isQualified(name: string): boolean {
    return name.includes(QualifiedCName.SEPARATOR);
  }

  /**
   * Whether a qualified C name sits directly inside the given scope.
   *
   * Use instead of `name.startsWith(scope + "_")`, which hardcodes the separator.
   */
  static isInScope(
    name: string,
    scopeName: string | undefined | null,
  ): boolean {
    if (!scopeName) {
      return false;
    }
    return name.startsWith(QualifiedCName.prefixFor(scopeName));
  }

  /**
   * Qualify a bare type name with the current scope if it is a known type
   * declared in that scope.
   *
   * ADR-057: bare names inside a scope resolve local → scope → global. The
   * *value* side already qualifies correctly; this is the *type* side helper
   * that every code path that resolves type names should use.
   *
   * Unlike the value-side resolver, this checks the **qualified** name against
   * the known-type sets so that only actual type declarations (enum/struct/
   * bitmap) capture the name — a function or variable member with the same
   * leaf name does not shadow a global type at a type position.
   *
   * @param typeName       Bare C-Next type name from the AST (e.g., "B")
   * @param currentScope   The scope currently being processed, or null for global
   * @param isKnownType    Check if the *qualified* name is a known type
   *                       (e.g., isKnownType("A__B") → true for enum B in scope A)
   * @returns Qualified C name (e.g., "A__B") or the bare name if not a scope type
   */
  static qualifyScopeType(
    typeName: string,
    currentScope: string | null,
    isKnownType: (qualifiedName: string) => boolean,
  ): string {
    if (!currentScope) {
      return typeName;
    }
    const qualified = QualifiedCName.join(currentScope, typeName);
    return isKnownType(qualified) ? qualified : typeName;
  }

  /**
   * The prefix a member of the given scope carries, separator included.
   */
  static prefixFor(scopeName: string): string {
    return (
      QualifiedCName.toParts([scopeName]).join(QualifiedCName.SEPARATOR) +
      QualifiedCName.SEPARATOR
    );
  }

  /**
   * Re-qualify a generated C name for C++ namespace syntax (`A__B` -> `A::B`).
   *
   * Splits on the C separator rather than replacing every underscore, so a component
   * containing a single underscore (`tick_count`) survives intact.
   */
  static toCppQualified(name: string, cppSeparator: string): string {
    return QualifiedCName.split(name).join(cppSeparator);
  }

  /**
   * Expand components into flat parts, dropping empties and splitting dotted paths.
   */
  private static toParts(
    components: (string | undefined | null)[],
  ): readonly string[] {
    const parts: string[] = [];
    for (const component of components) {
      if (!component) {
        continue;
      }
      for (const part of component.split(QualifiedCName.SOURCE_SEPARATOR)) {
        if (part) {
          parts.push(part);
        }
      }
    }
    return parts;
  }
}

export default QualifiedCName;
