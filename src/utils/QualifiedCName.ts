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
   * Build a qualified C name from a COMPLETE path, outermost first.
   *
   * Empty and undefined parts are dropped, so a global symbol (no scope) keeps its
   * bare name. Any part may itself be a dotted source path (`"Outer.Inner"`), which
   * is expanded before joining.
   *
   * Takes an array rather than a variadic list, and is named for the whole path
   * for the act of joining, because the variadic spelling it replaces made
   * `join(scopeName, member)` the obvious call -- a scope LEAF joined to a leaf,
   * which drops every outer scope and is the divergence #1357 exists to remove. A
   * caller that holds a scope cannot build a correct path from its name, so it has
   * no business here: `ScopeUtils.qualifyInScope` takes the scope REFERENCE and
   * walks the chain. What is left for this method is the case where the caller
   * genuinely already holds every component -- a parse-tree identifier chain, or an
   * already-qualified type name plus its member.
   *
   * @param parts Ordered name parts, e.g. ["Motor", "State", "IDLE"]
   * @returns The generated C identifier, e.g. "Motor__State__IDLE"
   */
  static fromParts(parts: readonly (string | undefined | null)[]): string {
    return QualifiedCName.toParts(parts).join(QualifiedCName.SEPARATOR);
  }

  /**
   * Build the SOURCE-language qualified name from its components, outermost
   * first — `Outer.Inner.tick`, the way a C-Next author would write it.
   *
   * The counterpart to fromParts(). The two namespaces are separate on purpose:
   * `Outer__Inner__tick` is what the C compiler sees, `Outer.Inner.tick` is what
   * the author typed, and neither is derivable from the other at a call site
   * without knowing which one it already holds. A diagnostic wants this one; a
   * lookup key wants fromParts().
   *
   * Takes a complete path for the same reason fromParts() does -- the source
   * spelling is just as capable of dropping an outer scope as the C spelling.
   *
   * @param parts Ordered name parts, e.g. ["Motor", "State", "IDLE"]
   * @returns The source spelling, e.g. "Motor.State.IDLE"
   */
  static fromSourceParts(
    parts: readonly (string | undefined | null)[],
  ): string {
    return QualifiedCName.toParts(parts).join(QualifiedCName.SOURCE_SEPARATOR);
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
    components: readonly (string | undefined | null)[],
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
