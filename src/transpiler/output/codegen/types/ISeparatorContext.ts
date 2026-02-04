/**
 * Context for determining member access separators in assignment targets.
 *
 * This interface encapsulates the pre-computed state needed to determine
 * whether to use "_", ".", "::", or "->" as the separator between identifiers
 * in member access chains.
 */
interface ISeparatorContext {
  /** Whether the access starts with `global.` prefix */
  readonly hasGlobal: boolean;

  /** Whether this is a cross-scope access (global.Scope or global.Register) */
  readonly isCrossScope: boolean;

  /** Whether the base identifier is a struct parameter */
  readonly isStructParam: boolean;

  /** Whether this is a C++ namespace/class access requiring :: */
  readonly isCppAccess: boolean;

  /** The scoped register name if using `this.REG`, otherwise null */
  readonly scopedRegName: string | null;

  /** Whether scopedRegName refers to a known register */
  readonly isScopedRegister: boolean;
}

export default ISeparatorContext;
