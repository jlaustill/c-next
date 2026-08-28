/**
 * ADR-029: the C signature of a generated `<Struct>_init()`.
 *
 * Two places emit this signature -- `StructGenerator` writes the definition and
 * `BaseHeaderGenerator` writes the prototype (#1205) -- and a definition whose
 * declaration disagrees is a C compile error, not a style problem. Registering
 * *that* an init function exists is not enough: the two sides also have to agree
 * on *what it looks like*, which is the "single source of truth means the
 * decision, not just the data" clause.
 *
 * So the return type, the name mangling and the parameter list live here once.
 * Callers append their own terminator, because `;` versus ` {` is C syntax at
 * the emit site rather than part of the signature.
 */
class StructInitSignature {
  /** `Controller Controller_init(void)` -- no terminator. */
  static of(structName: string): string {
    return `${structName} ${structName}_init(void)`;
  }
}

export default StructInitSignature;
