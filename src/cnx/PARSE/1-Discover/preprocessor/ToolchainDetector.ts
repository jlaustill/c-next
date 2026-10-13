/**
 * Toolchain Detector
 * Finds available C/C++ compilers on the system
 */

import { execFileSync, spawnSync } from "node:child_process";
import { basename, delimiter, join } from "node:path";
import IToolchain from "./types/IToolchain";
import IFileSystem from "../../../types/IFileSystem";

/**
 * Detects available C/C++ toolchains
 */
class ToolchainDetector {
  /**
   * Detect the best available toolchain
   * Priority: ARM cross-compiler > clang > gcc
   */
  static detect(fs: IFileSystem): IToolchain | null {
    // Explicit override: a project can name the compiler that owns its target
    // headers (e.g. a cross-compiler such as xtensa-esp32s3-elf-gcc) via
    // CNEXT_CROSS_COMPILER. Host gcc/clang lack a cross target's system headers
    // and predefined macros, so their preprocessing of target headers fails.
    const override = process.env.CNEXT_CROSS_COMPILER;
    if (override) {
      const overridden = ToolchainDetector.fromPath(override, fs);
      if (overridden) return overridden;
    }

    // Try ARM cross-compiler first (for embedded)
    const arm = this.detectArmToolchain(fs);
    if (arm) return arm;

    // Try clang
    const clang = this.detectClang(fs);
    if (clang) return clang;

    // Try gcc
    const gcc = this.detectGcc(fs);
    if (gcc) return gcc;

    return null;
  }

  /**
   * Build a toolchain from an explicit compiler path or executable name (e.g. a
   * target cross-compiler such as xtensa-esp32s3-elf-gcc). Used by the
   * CNEXT_CROSS_COMPILER override so a project can preprocess its target headers with the compiler
   * that owns them. A path and a PATH name resolve by the same test: an
   * executable file, as `fs.isExecutable` answers it.
   */
  static fromPath(compiler: string, fs: IFileSystem): IToolchain | null {
    let cc: string | null;
    if (compiler.includes("/")) {
      cc = fs.isExecutable(compiler) ? compiler : null;
    } else {
      cc = this.findExecutable(compiler, fs);
    }
    if (!cc) return null;

    // Best-effort C++ driver alongside the C driver (only cpp is used for
    // preprocessing; cxx is derived for completeness).
    const cxxCandidate = cc.replace(/gcc(\.exe)?$/, "g++$1");
    const cxx =
      cxxCandidate !== cc && fs.isExecutable(cxxCandidate) ? cxxCandidate : cc;

    return {
      name: basename(cc),
      cc,
      cxx,
      cpp: cc,
      version: this.getVersion(cc),
      isCrossCompiler: true,
    };
  }

  /**
   * Detect ARM cross-compiler (arm-none-eabi-gcc)
   */
  private static detectArmToolchain(fs: IFileSystem): IToolchain | null {
    const cc = this.findExecutable("arm-none-eabi-gcc", fs);
    if (!cc) return null;

    const cxx = this.findExecutable("arm-none-eabi-g++", fs) ?? cc;
    const version = this.getVersion(cc);

    return {
      name: "arm-none-eabi-gcc",
      cc,
      cxx,
      cpp: cc, // Use cc with -E flag
      version,
      isCrossCompiler: true,
      target: "arm-none-eabi",
    };
  }

  /**
   * Detect clang
   */
  private static detectClang(fs: IFileSystem): IToolchain | null {
    const cc = this.findExecutable("clang", fs);
    if (!cc) return null;

    const cxx = this.findExecutable("clang++", fs) ?? cc;
    const version = this.getVersion(cc);

    return {
      name: "clang",
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
  private static detectGcc(fs: IFileSystem): IToolchain | null {
    const cc = this.findExecutable("gcc", fs);
    if (!cc) return null;

    const cxx = this.findExecutable("g++", fs) ?? cc;
    const version = this.getVersion(cc);

    return {
      name: "gcc",
      cc,
      cxx,
      cpp: cc,
      version,
      isCrossCompiler: false,
    };
  }

  /**
   * Find an executable in PATH, as `which` does, without starting a process.
   * `name` can come from the project being compiled (#1827), so it is only ever
   * joined to a PATH directory: no shell parses a compiler name, and every
   * process this class starts is given an argument array. An empty PATH entry
   * is skipped rather than read as the current directory.
   */
  private static findExecutable(name: string, fs: IFileSystem): string | null {
    for (const dir of (process.env.PATH ?? "").split(delimiter)) {
      if (!dir) continue;
      const candidate = join(dir, name);
      if (fs.isExecutable(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  /**
   * Get compiler version string
   */
  private static getVersion(compiler: string): string | undefined {
    try {
      const result = execFileSync(compiler, ["--version"], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Extract first line which usually has version info
      const firstLine = result.split("\n")[0];
      return firstLine?.trim();
    } catch {
      return undefined;
    }
  }

  /**
   * Get default include paths for a toolchain
   */
  static getDefaultIncludePaths(toolchain: IToolchain): string[] {
    // Ask the compiler for its default include paths: it prints them to stderr
    // while preprocessing an empty input.
    const result = spawnSync(toolchain.cc, ["-E", "-Wp,-v", "-"], {
      input: "",
      encoding: "utf-8",
      // gcc translates the banners parsed below; LC_ALL=C keeps them in English.
      env: { ...process.env, LC_ALL: "C" },
    });
    if (result.error || result.status !== 0) {
      return [];
    }

    const paths: string[] = [];
    let inIncludeSection = false;

    for (const line of result.stderr.split("\n")) {
      if (line.includes("#include <...> search starts here:")) {
        inIncludeSection = true;
        continue;
      }
      if (line.includes("End of search list.")) {
        break;
      }
      if (inIncludeSection && line.trim()) {
        paths.push(line.trim());
      }
    }

    return paths;
  }
}

export default ToolchainDetector;
