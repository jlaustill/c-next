/**
 * Information about where a variable was declared
 */
interface IDeclarationInfo {
  /** Variable name */
  name: string;
  /** Line where variable was declared */
  line: number;
  /** Column where variable was declared */
  column: number;
}

export default IDeclarationInfo;
