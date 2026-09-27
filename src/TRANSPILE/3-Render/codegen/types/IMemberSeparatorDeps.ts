/**
 * Dependencies needed for separator resolution
 */
interface IMemberSeparatorDeps {
  /** Check if an identifier is a known scope */
  isKnownScope(name: string): boolean;

  /** Check if an identifier is a known register */
  isKnownRegister(name: string): boolean;

  /**
   * Get struct param separator from the C/C++ mode and whether the parameter
   * takes a callback typedef's pointer shape (Issue #895)
   */
  getStructParamSeparator(forcePointerSemantics: boolean): string;
}

export default IMemberSeparatorDeps;
