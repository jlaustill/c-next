/**
 * Result of building a register name with scope detection.
 * Issue #707: Exported as separate file per project no-named-export convention.
 */
interface IRegisterNameResult {
  /** The full register member name (e.g., "Scope_Register_Member" or "Register_Member") */
  fullName: string;
  /** The register base name (e.g., "Scope_Register" or "Register") */
  regName: string;
  /** True if the register is scoped */
  isScoped: boolean;
}

export default IRegisterNameResult;
