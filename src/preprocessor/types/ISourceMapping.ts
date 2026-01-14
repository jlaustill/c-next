/**
 * Source location mapping from preprocessed output back to original file
 */
interface ISourceMapping {
  /** Line number in preprocessed output */
  preprocessedLine: number;

  /** Original file path */
  originalFile: string;

  /** Line number in original file */
  originalLine: number;
}

export default ISourceMapping;
