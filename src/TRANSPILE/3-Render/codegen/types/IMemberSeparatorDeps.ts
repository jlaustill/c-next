/**
 * Dependencies needed for separator resolution
 */
interface IMemberSeparatorDeps {
  /** Check if an identifier is a known scope */
  isKnownScope(name: string): boolean;

  /** Check if an identifier is a known register */
  isKnownRegister(name: string): boolean;

  /** Get struct param separator based on C/C++ mode */
  getStructParamSeparator(): string;
}

export default IMemberSeparatorDeps;
