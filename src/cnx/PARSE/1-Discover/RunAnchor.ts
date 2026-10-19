import { dirname, join, resolve } from "node:path";

import IncludeDiscovery from "./IncludeDiscovery";
import PathResolver from "./PathResolver";
import CompileCommandsReader from "./preprocessor/CompileCommandsReader";
import type IFileSystem from "../../types/IFileSystem";
import type IRunAnchor from "./types/IRunAnchor";
import type ITranspilerConfig from "../../types/ITranspilerConfig";

/** The configuration an anchor is decided from. */
type TAnchorSettings = Pick<
  Required<ITranspilerConfig>,
  "includeDirs" | "defines" | "outDir"
> &
  // #2104: unset is outDir; "" is the cwd.
  Pick<ITranspilerConfig, "headerOutDir">;

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
   * include paths in cnx.config.json — lets cnx resolve external headers
   * exactly as the compiler will, which is the same reason clangd reads it.
   * The include paths + defines + compiler are the contract every build system
   * converges on. (Issue #985 external-symbol recovery; unblocks ADR-062.)
   *
   * `previous` is kept for what the move does not change: the same anchor
   * under the same project root is the same answer, the same project root
   * reads the same database, and the same database needs no second read. The
   * root is walked again on every run, as discovery's tiers are: a marker
   * created or renamed between runs moves it (#2221 review: a reuse keyed on
   * the path alone kept the root from before E0918's rename). The compiler it
   * names reads the headers only of a target that names none (#1713, owner
   * ruling 2026-10-16: the target's own compiler reads its headers).
   */
  static at(
    anchorPath: string,
    previous: IRunAnchor | null,
    settings: TAnchorSettings,
    fs: IFileSystem,
  ): IRunAnchor {
    const path = resolve(anchorPath);
    const projectRoot = RunAnchor._projectRootFrom(anchorPath, fs);
    if (previous?.path === path && previous.projectRoot === projectRoot) {
      return previous;
    }
    const settled =
      previous !== null && previous.projectRoot === projectRoot
        ? previous
        : RunAnchor._compileDatabaseAt(projectRoot, settings, fs);
    const directory = dirname(path);
    return {
      path,
      directory,
      projectRoot,
      includeDirs: settled.includeDirs,
      defines: settled.defines,
      compiler: settled.compiler,
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
   * conflict, and the compiler it names.
   */
  private static _compileDatabaseAt(
    projectRoot: string | undefined,
    settings: TAnchorSettings,
    fs: IFileSystem,
  ): Pick<IRunAnchor, "includeDirs" | "defines" | "compiler"> {
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
    return {
      includeDirs,
      defines: { ...db?.defines, ...settings.defines },
      compiler: db?.compiler ?? null,
    };
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

    // No project root disables caching, so no .cnx directory is left behind.
    // #2165: the walk's renamed configs are discovery's to report. An anchor
    // is reused across runs, so a finding kept here would outlive the rename
    // that fixed it; `Discover.run` walks the anchor's directory fresh.
    return IncludeDiscovery.findProjectRoot(startDir, fs).root ?? undefined;
  }
}

export default RunAnchor;
