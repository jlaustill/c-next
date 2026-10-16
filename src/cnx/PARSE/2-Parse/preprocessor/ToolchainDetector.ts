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
   * Build a toolchain from an explicit compiler path or executable name (e.g. a
   * target cross-compiler such as xtensa-esp32s3-elf-gcc). The host builds the toolchain 1.2 chose
   * for the run's headers from it (#1713): the target's own compiler, or
   * the one a project names for a target that names none. A path and a PATH name resolve by the same test: an
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
    const result = spawnSync(
      toolchain.cc,
      [...(toolchain.flags ?? []), "-E", "-Wp,-v", "-"],
      {
        input: "",
        encoding: "utf-8",
        // gcc translates the banners parsed below; LC_ALL=C keeps them in English.
        env: { ...process.env, LC_ALL: "C" },
      },
    );
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
