/**
 * Dependencies needed for separator resolution
 */
interface IMemberSeparatorDeps {
  /** Check if an identifier is a known scope */
  isKnownScope(name: string): boolean;

  /** Check if an identifier is a known register */
  isKnownRegister(name: string): boolean;

  /** Validate cross-scope visibility and throw if not visible */
  validateCrossScopeVisibility(scopeName: string, memberName: string): void;

  /** Validate register access from inside a scope requires global. prefix */
  validateRegisterAccess(
    registerName: string,
    memberName: string,
    hasGlobal: boolean,
  ): void;

  /** Get struct param separator based on C/C++ mode */
  getStructParamSeparator(): string;
}

export default IMemberSeparatorDeps;
