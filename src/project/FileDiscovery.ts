/**
 * File Discovery
 * Scans directories for source files
 */

import { readdirSync, statSync, existsSync } from 'fs';
import { join, extname, resolve } from 'path';

/**
 * File types supported by the transpiler
 */
enum EFileType {
    CNext = 'cnext',
    CHeader = 'c_header',
    CppHeader = 'cpp_header',
    CSource = 'c_source',
    CppSource = 'cpp_source',
    Unknown = 'unknown',
}

/**
 * Discovered source file
 */
interface IDiscoveredFile {
    /** Absolute path to the file */
    path: string;

    /** File type */
    type: EFileType;

    /** File extension */
    extension: string;
}

/**
 * Options for file discovery
 */
interface IDiscoveryOptions {
    /** File extensions to include (default: all supported) */
    extensions?: string[];

    /** Whether to recurse into subdirectories */
    recursive?: boolean;

    /** Patterns to exclude */
    excludePatterns?: RegExp[];
}

/**
 * Default extensions for each file type
 */
const EXTENSION_MAP: Record<string, EFileType> = {
    '.cnx': EFileType.CNext,
    '.cnext': EFileType.CNext,
    '.h': EFileType.CHeader,
    '.hpp': EFileType.CppHeader,
    '.hxx': EFileType.CppHeader,
    '.hh': EFileType.CppHeader,
    '.c': EFileType.CSource,
    '.cpp': EFileType.CppSource,
    '.cxx': EFileType.CppSource,
    '.cc': EFileType.CppSource,
};

/**
 * Discovers source files in directories
 */
class FileDiscovery {
    /**
     * Discover files in the given directories
     */
    static discover(
        directories: string[],
        options: IDiscoveryOptions = {}
    ): IDiscoveredFile[] {
        const files: IDiscoveredFile[] = [];
        const recursive = options.recursive ?? true;
        const excludePatterns = options.excludePatterns ?? [
            /node_modules/,
            /\.git/,
            /\.build/,
            /\.pio/,
        ];

        for (const dir of directories) {
            const resolvedDir = resolve(dir);

            if (!existsSync(resolvedDir)) {
                console.warn(`Warning: Directory not found: ${dir}`);
                continue;
            }

            this.scanDirectory(
                resolvedDir,
                files,
                recursive,
                options.extensions,
                excludePatterns
            );
        }

        return files;
    }

    /**
     * Discover a single file
     */
    static discoverFile(filePath: string): IDiscoveredFile | null {
        const resolvedPath = resolve(filePath);

        if (!existsSync(resolvedPath)) {
            return null;
        }

        const ext = extname(resolvedPath).toLowerCase();
        const type = EXTENSION_MAP[ext] ?? EFileType.Unknown;

        return {
            path: resolvedPath,
            type,
            extension: ext,
        };
    }

    /**
     * Discover multiple specific files
     */
    static discoverFiles(filePaths: string[]): IDiscoveredFile[] {
        const files: IDiscoveredFile[] = [];

        for (const filePath of filePaths) {
            const file = this.discoverFile(filePath);
            if (file) {
                files.push(file);
            } else {
                console.warn(`Warning: File not found: ${filePath}`);
            }
        }

        return files;
    }

    /**
     * Filter discovered files by type
     */
    static filterByType(files: IDiscoveredFile[], type: EFileType): IDiscoveredFile[] {
        return files.filter(f => f.type === type);
    }

    /**
     * Get C-Next files from a list
     */
    static getCNextFiles(files: IDiscoveredFile[]): IDiscoveredFile[] {
        return this.filterByType(files, EFileType.CNext);
    }

    /**
     * Get C/C++ header files from a list
     */
    static getHeaderFiles(files: IDiscoveredFile[]): IDiscoveredFile[] {
        return files.filter(f =>
            f.type === EFileType.CHeader || f.type === EFileType.CppHeader
        );
    }

    /**
     * Scan a directory for source files
     */
    private static scanDirectory(
        dir: string,
        files: IDiscoveredFile[],
        recursive: boolean,
        extensions: string[] | undefined,
        excludePatterns: RegExp[]
    ): void {
        let entries: string[];

        try {
            entries = readdirSync(dir);
        } catch {
            console.warn(`Warning: Cannot read directory: ${dir}`);
            return;
        }

        for (const entry of entries) {
            const fullPath = join(dir, entry);

            // Check exclude patterns
            if (excludePatterns.some(pattern => pattern.test(fullPath))) {
                continue;
            }

            let stats;
            try {
                stats = statSync(fullPath);
            } catch {
                continue;
            }

            if (stats.isDirectory()) {
                if (recursive) {
                    this.scanDirectory(fullPath, files, recursive, extensions, excludePatterns);
                }
            } else if (stats.isFile()) {
                const ext = extname(fullPath).toLowerCase();

                // Check extension filter
                if (extensions && !extensions.includes(ext)) {
                    continue;
                }

                const type = EXTENSION_MAP[ext];
                if (type) {
                    files.push({
                        path: fullPath,
                        type,
                        extension: ext,
                    });
                }
            }
        }
    }
}

export default FileDiscovery;
export { EFileType };
export type { IDiscoveredFile, IDiscoveryOptions };
