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
  static readonly SEPARATOR = "_";

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
   * @returns The generated C identifier, e.g. "Motor_State_IDLE"
   */
  static join(...components: (string | undefined | null)[]): string {
    return QualifiedCName.toParts(components).join(QualifiedCName.SEPARATOR);
  }

  /**
   * Split a qualified C name back into its components.
   *
   * Exact inverse of join() for names built from ADR-063-conformant identifiers.
   *
   * @param qualifiedName A generated C identifier, e.g. "Motor_State_IDLE"
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
   * Re-qualify a generated C name for C++ namespace syntax (`A_B` -> `A::B`).
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
