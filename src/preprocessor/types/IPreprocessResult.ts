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

    /** Original file that was preprocessed */
    originalFile: string;

    /** Toolchain used for preprocessing */
    toolchain?: string;
}

export default IPreprocessResult;
export type { ISourceMapping };
