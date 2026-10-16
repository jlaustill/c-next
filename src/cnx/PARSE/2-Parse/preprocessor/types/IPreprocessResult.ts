import ISourceMapping from "./ISourceMapping";

/**
 * Result of preprocessing a C/C++ file
 */
interface IPreprocessResult {
  /** Preprocessed content */
  content: string;

  /** Source mappings from #line directives */
  sourceMappings: ISourceMapping[];

  /** Whether preprocessing succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** #1844: the compiler's own messages (stderr) when it failed */
  diagnostics?: string;

  /** Original file that was preprocessed */
  originalFile: string;

  /** Toolchain used for preprocessing */
  toolchain?: string;
}

export default IPreprocessResult;
