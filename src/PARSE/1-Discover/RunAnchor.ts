import { dirname, join, resolve } from "node:path";

import IncludeDiscovery from "../../transpiler/data/IncludeDiscovery";
import PathResolver from "../../transpiler/data/PathResolver";
import CompileCommandsReader from "../../transpiler/logic/preprocessor/CompileCommandsReader";
import Preprocessor from "../../transpiler/logic/preprocessor/Preprocessor";
import ToolchainDetector from "../../transpiler/logic/preprocessor/ToolchainDetector";
import type ICompileCommandsResult from "../../transpiler/logic/preprocessor/types/ICompileCommandsResult";
import type IToolchain from "../../transpiler/logic/preprocessor/types/IToolchain";
import type IFileSystem from "../../transpiler/types/IFileSystem";
import type IRunAnchor from "../../transpiler/types/IRunAnchor";
import type ITranspilerConfig from "../../transpiler/types/ITranspilerConfig";

/** The configuration an anchor is decided from. */
type TAnchorSettings = Pick<
  Required<ITranspilerConfig>,
  "includeDirs" | "defines" | "outDir" | "headerOutDir"
>;

/**
 * Where a run is anchored (#1719): the one decision of everything that follows
 * from the location of the run's own root.
 *
 * #1444: this was four private methods of `Transpiler`, which anchored at
 * construction (to find the cache's project root) and again at the start of
 * every run's discovery. Both now ask this.
 */
class RunAnchor {
  /**
   * Anchor a run at `anchorPath`.
   *
   * Adopt the compiler's own view from the project's compile_commands.json, if
   * present. Every build system (CMake, PlatformIO, Meson, Zephyr, bear-wrapped
   * Make) emits this database; reading it — rather than mirroring framework
   * include paths in cnext.config.json — lets cnext resolve external headers
   * exactly as the compiler will, which is the same reason clangd reads it.
   * The include paths + defines + compiler are the contract every build system
   * converges on. (Issue #985 external-symbol recovery; unblocks ADR-062.)
   *
   * `previous` is kept for what the move does not change: the same anchor is
   * the same answer, the same project root reads the same database, and the
   * same compiler needs no second toolchain probe -- which shells out, so
   * redoing it per editor request would be the costly part.
   */
  static at(
    anchorPath: string,
    previous: IRunAnchor | null,
    settings: TAnchorSettings,
    fs: IFileSystem,
  ): IRunAnchor {
    const path = resolve(anchorPath);
    if (previous?.path === path) {
      return previous;
    }
    const projectRoot = RunAnchor._projectRootFrom(anchorPath, fs);
    const settled =
      previous !== null && previous.projectRoot === projectRoot
        ? previous
        : RunAnchor._compileDatabaseAt(projectRoot, previous, settings, fs);
    const directory = dirname(path);
    return {
      path,
      directory,
      projectRoot,
      includeDirs: settled.includeDirs,
      defines: settled.defines,
      compiler: settled.compiler,
      preprocessor: settled.preprocessor,
      // Issue #586: path resolution for output files
      pathResolver: new PathResolver(
        {
          inputs: [directory],
          outDir: settings.outDir,
          headerOutDir: settings.headerOutDir,
          // Issue #1547: the stable base for files outside the entry's
          // directory. Same value `_guardIdentity` already measures
          // include-guard identity against, so a file's guard and its header
          // path can no longer disagree about where it sits purely because the
          // shell moved.
          projectRoot,
        },
        fs,
      ),
    };
  }

  /**
   * What `projectRoot`'s compile_commands.json contributes: its include search
   * paths after the caller's (so both preprocessing and include-tree resolution
   * see what the compiler sees), its defines beneath the caller's, which win on
   * conflict, and the preprocessor its compiler picks.
   */
  private static _compileDatabaseAt(
    projectRoot: string | undefined,
    previous: IRunAnchor | null,
    settings: TAnchorSettings,
    fs: IFileSystem,
  ): Pick<IRunAnchor, "includeDirs" | "defines" | "compiler" | "preprocessor"> {
    const db = projectRoot
      ? CompileCommandsReader.load(
          join(projectRoot, "compile_commands.json"),
          fs,
        )
      : null;
    const includeDirs = [...settings.includeDirs];
    const seen = new Set(includeDirs);
    for (const path of db?.includePaths ?? []) {
      if (!seen.has(path)) {
        seen.add(path);
        includeDirs.push(path);
      }
    }
    const compiler = db?.compiler ?? null;
    return {
      includeDirs,
      defines: { ...db?.defines, ...settings.defines },
      compiler,
      preprocessor:
        previous?.compiler === compiler
          ? previous.preprocessor
          : new Preprocessor(fs, RunAnchor._toolchainForCompileDb(db, fs)),
    };
  }

  /**
   * The toolchain to preprocess with, given a discovered compile database. An
   * explicit CNEXT_CROSS_COMPILER override always wins (deferred to Preprocessor's
   * own detection); otherwise adopt the database's compiler if it resolves, else
   * fall back to auto-detection.
   */
  private static _toolchainForCompileDb(
    db: ICompileCommandsResult | null,
    fs: IFileSystem,
  ): IToolchain | undefined {
    if (process.env.CNEXT_CROSS_COMPILER) return undefined;
    if (!db?.compiler) return undefined;
    return ToolchainDetector.fromPath(db.compiler, fs) ?? undefined;
  }

  /**
   * Determine the project root by walking up from a run's anchor looking for
   * project markers. Returns undefined if no project root can be established,
   * which disables caching to avoid polluting the filesystem with .cnx directories.
   */
  private static _projectRootFrom(
    anchorPath: string,
    fs: IFileSystem,
  ): string | undefined {
    // Start from the anchor: the input, or where a source run's text lives
    if (!anchorPath) {
      return undefined;
    }

    const resolvedInput = resolve(anchorPath);
    let startDir: string;

    // Determine starting directory based on whether input exists
    if (fs.exists(resolvedInput)) {
      // Input exists - use its directory if file, or itself if directory
      startDir = fs.isFile(resolvedInput)
        ? dirname(resolvedInput)
        : resolvedInput;
    } else {
      // Input doesn't exist - assume it's a file path, use parent directory
      startDir = dirname(resolvedInput);
    }

    // No project root disables caching, so no .cnx directory is left behind
    return IncludeDiscovery.findProjectRoot(startDir, fs) ?? undefined;
  }
}

export default RunAnchor;
