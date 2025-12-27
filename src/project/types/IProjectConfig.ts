/**
 * Project Configuration Types
 */

/**
 * Configuration for a C-Next project
 */
interface IProjectConfig {
    /** Project name */
    name?: string;

    /** Source directories to scan for .cnx files */
    srcDirs: string[];

    /** Include directories for C/C++ headers */
    includeDirs: string[];

    /** Output directory for generated files */
    outDir: string;

    /** Specific files to compile (overrides srcDirs) */
    files?: string[];

    /** File extensions to process (default: ['.cnx']) */
    extensions?: string[];

    /** Whether to generate header files */
    generateHeaders?: boolean;

    /** Whether to preprocess C/C++ files */
    preprocess?: boolean;

    /** Additional preprocessor defines */
    defines?: Record<string, string | boolean>;
}

/**
 * Result of compiling a project
 */
interface IProjectResult {
    /** Whether compilation succeeded */
    success: boolean;

    /** Number of files processed */
    filesProcessed: number;

    /** Number of symbols collected */
    symbolsCollected: number;

    /** Symbol conflicts detected */
    conflicts: string[];

    /** Errors encountered */
    errors: string[];

    /** Warnings */
    warnings: string[];

    /** Generated output files */
    outputFiles: string[];
}

export default IProjectConfig;
export type { IProjectResult };
