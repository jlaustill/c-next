/**
 * Toolchain Detector
 * Finds available C/C++ compilers on the system
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import IToolchain from './types/IToolchain.js';

/**
 * Detects available C/C++ toolchains
 */
class ToolchainDetector {
    /**
     * Detect the best available toolchain
     * Priority: ARM cross-compiler > clang > gcc
     */
    static detect(): IToolchain | null {
        // Try ARM cross-compiler first (for embedded)
        const arm = this.detectArmToolchain();
        if (arm) return arm;

        // Try clang
        const clang = this.detectClang();
        if (clang) return clang;

        // Try gcc
        const gcc = this.detectGcc();
        if (gcc) return gcc;

        return null;
    }

    /**
     * Detect all available toolchains
     */
    static detectAll(): IToolchain[] {
        const toolchains: IToolchain[] = [];

        const arm = this.detectArmToolchain();
        if (arm) toolchains.push(arm);

        const clang = this.detectClang();
        if (clang) toolchains.push(clang);

        const gcc = this.detectGcc();
        if (gcc) toolchains.push(gcc);

        return toolchains;
    }

    /**
     * Detect ARM cross-compiler (arm-none-eabi-gcc)
     */
    private static detectArmToolchain(): IToolchain | null {
        const names = [
            'arm-none-eabi-gcc',
            'arm-none-eabi-g++',
        ];

        const cc = this.findExecutable('arm-none-eabi-gcc');
        if (!cc) return null;

        const cxx = this.findExecutable('arm-none-eabi-g++') ?? cc;
        const version = this.getVersion(cc);

        return {
            name: 'arm-none-eabi-gcc',
            cc,
            cxx,
            cpp: cc, // Use cc with -E flag
            version,
            isCrossCompiler: true,
            target: 'arm-none-eabi',
        };
    }

    /**
     * Detect clang
     */
    private static detectClang(): IToolchain | null {
        const cc = this.findExecutable('clang');
        if (!cc) return null;

        const cxx = this.findExecutable('clang++') ?? cc;
        const version = this.getVersion(cc);

        return {
            name: 'clang',
            cc,
            cxx,
            cpp: cc,
            version,
            isCrossCompiler: false,
        };
    }

    /**
     * Detect GCC
     */
    private static detectGcc(): IToolchain | null {
        const cc = this.findExecutable('gcc');
        if (!cc) return null;

        const cxx = this.findExecutable('g++') ?? cc;
        const version = this.getVersion(cc);

        return {
            name: 'gcc',
            cc,
            cxx,
            cpp: cc,
            version,
            isCrossCompiler: false,
        };
    }

    /**
     * Find an executable in PATH
     */
    private static findExecutable(name: string): string | null {
        try {
            const result = execSync(`which ${name}`, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
            }).trim();

            if (result && existsSync(result)) {
                return result;
            }
        } catch {
            // Not found
        }

        return null;
    }

    /**
     * Get compiler version string
     */
    private static getVersion(compiler: string): string | undefined {
        try {
            const result = execSync(`${compiler} --version`, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            // Extract first line which usually has version info
            const firstLine = result.split('\n')[0];
            return firstLine?.trim();
        } catch {
            return undefined;
        }
    }

    /**
     * Get default include paths for a toolchain
     */
    static getDefaultIncludePaths(toolchain: IToolchain): string[] {
        try {
            // Ask the compiler for its default include paths
            const result = execSync(
                `echo | ${toolchain.cc} -E -Wp,-v - 2>&1`,
                {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                }
            );

            const paths: string[] = [];
            let inIncludeSection = false;

            for (const line of result.split('\n')) {
                if (line.includes('#include <...> search starts here:')) {
                    inIncludeSection = true;
                    continue;
                }
                if (line.includes('End of search list.')) {
                    break;
                }
                if (inIncludeSection && line.trim()) {
                    paths.push(line.trim());
                }
            }

            return paths;
        } catch {
            return [];
        }
    }

    /**
     * Parse PlatformIO environment for include paths
     * Looks for platformio.ini in project root
     */
    static getPlatformIOIncludePaths(projectRoot: string): string[] {
        const paths: string[] = [];
        const pioIniPath = join(projectRoot, 'platformio.ini');

        if (!existsSync(pioIniPath)) {
            return paths;
        }

        try {
            // Use pio to get the include paths
            const result = execSync(
                'pio project config --json-output',
                {
                    cwd: projectRoot,
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                }
            );

            const config = JSON.parse(result);

            // Extract include directories from build flags
            for (const env of Object.values(config) as any[]) {
                const buildFlags = env.build_flags ?? [];
                for (const flag of buildFlags) {
                    if (flag.startsWith('-I')) {
                        paths.push(flag.slice(2));
                    }
                }
            }
        } catch {
            // PlatformIO not available or project not configured
        }

        return paths;
    }
}

export default ToolchainDetector;
