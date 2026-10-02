import { basename, dirname, join, resolve } from "node:path";

import CppEntryPointScanner from "../../transpiler/data/CppEntryPointScanner";
import DependencyGraph from "../../transpiler/data/DependencyGraph";
import FileDiscovery from "../../transpiler/data/FileDiscovery";
import IncludeDiscovery from "../../transpiler/data/IncludeDiscovery";
import IncludeResolver from "../../transpiler/data/IncludeResolver";
import InputExpansion from "../../transpiler/data/InputExpansion";
import PlatformIOIni from "../../transpiler/data/PlatformIOIni";
import EFileType from "../../transpiler/data/types/EFileType";
import type IDiscoveredFile from "../../transpiler/data/types/IDiscoveredFile";
import type IHeaderRoot from "../../transpiler/data/types/IHeaderRoot";
import type IFileSystem from "../../transpiler/types/IFileSystem";
import type IInMemorySource from "../../transpiler/types/IInMemorySource";
import type IPipelineFile from "../../transpiler/types/IPipelineFile";
import type IRunAnchor from "../../transpiler/types/IRunAnchor";
import type ITranspilerConfig from "../../transpiler/types/ITranspilerConfig";
import type THeaderExtension from "../../transpiler/types/THeaderExtension";
import type TTranspileInput from "../../transpiler/types/TTranspileInput";
import invariant from "../../utils/invariant";
import ReadOnceFileSystem from "./ReadOnceFileSystem";
import RunAnchor from "./RunAnchor";
import type IFileIncludes from "./types/IFileIncludes";
import type ISourceGraph from "./types/ISourceGraph";

/** The configuration a run's discovery reads. */
type TDiscoverySettings = Pick<
  Required<ITranspilerConfig>,
  "input" | "includeDirs" | "defines" | "outDir" | "headerOutDir" | "debugMode"
>;

/** The graph before it is frozen, without the facts gathered beside it. */
type TDiscoveredFiles = Omit<ISourceGraph, "includes" | "anchor">;

/**
 * 1.1 Discover: which files exist, their kind, the include graph, topological
 * order and every resolved absolute path (`docs/architecture/README.md` §1),
 * emitted as one frozen `SourceGraph` (#1444).
 *
 * This was Stage 1 of `Transpiler`: about a dozen private methods that wrote
 * five maps onto the orchestrator beside the pipeline input they returned.
 * Those maps were read two stages later, which is why 1.4's `Program` carried
 * four of them (#1452). They are the graph's `includes` now, built by the
 * same code, and nothing after 1.1 resolves an include or reads a file to
 * learn one.
 *
 * One instance per run. Its maps are its own, so two runs cannot share them,
 * which #1721 had to serialize runs to guarantee.
 */
class Discover {
  /** Per file, in the order discovery visits them (see `ISourceGraph`). */
  private readonly includes = new Map<string, IFileIncludes>();

  /**
   * Issue #1467: PathResolver's answer to "where is this .cnx's header
   * reachable from?", bound to the run's header extension. Handed to
   * IncludeResolver so the include text and the header's location are the
   * same derivation rather than two that happen to agree.
   */
  private readonly headerIncludePathFor = (cnxPath: string): string | null =>
    this.anchor.pathResolver.getHeaderIncludePath(
      cnxPath,
      this.headerExtension,
    );

  private constructor(
    private readonly anchor: IRunAnchor,
    private readonly settings: TDiscoverySettings,
    private readonly headerExtension: THeaderExtension,
    private readonly fs: IFileSystem,
    private readonly warnings: string[],
  ) {}

  /**
   * Discover a run's files, and anchor it.
   *
   * Branches on input kind:
   * - 'files': filesystem scan, dependency graph, topological sort
   * - 'source': the same discovery, rooted at an in-memory string
   *
   * @param previousAnchor - The last run's anchor, which a run anchored at the
   *   same place reuses (see `RunAnchor.at`)
   * @param warnings - Where discovery's warnings go. A sink rather than part
   *   of the answer, because a C/C++ entry point's missing source is thrown
   *   AFTER the warnings that usually explain it are recorded (#1541)
   * @returns the frozen graph, and the anchor the run's services come from
   */
  static run(
    input: TTranspileInput,
    previousAnchor: IRunAnchor,
    settings: TDiscoverySettings,
    headerExtension: THeaderExtension,
    fs: IFileSystem,
    warnings: string[],
  ): { readonly graph: ISourceGraph; readonly anchor: IRunAnchor } {
    const root = input.kind === "source" ? Discover._inMemoryRoot(input) : null;
    // #1719: a source run is anchored where its text lives -- its project
    // root, compile database, and the base its `#include`s and guards are
    // measured from -- never at `config.input`, which the editor leaves empty,
    // so its preview was anchored at the parent of the process's cwd.
    const anchor = RunAnchor.at(
      root === null
        ? settings.input
        : join(root.directory, basename(root.path)),
      previousAnchor,
      settings,
      fs,
    );
    // Owner ruling 3: every read 1.1 makes goes through one view, so each
    // file's text is read once. The anchor keeps the host port: it, and its
    // `PathResolver`, outlive this run.
    const discovery = new Discover(
      anchor,
      settings,
      headerExtension,
      new ReadOnceFileSystem(fs),
      warnings,
    );
    const files =
      input.kind === "source" && root !== null
        ? discovery._fromSource(root, input.includeDirs ?? [])
        : discovery._fromFiles();
    return { graph: discovery._freeze(files), anchor };
  }

  /**
   * A source run's root: its text, the path it lives at, and the directory
   * its quoted includes resolve from.
   *
   * #1435: ADR-010 resolves a quoted include from the file it appears in.
   * Text given a path lives at that path, resolved exactly as the root's
   * identity is (against the process's working directory), so where the
   * root IS and where it resolves FROM cannot come apart. `workingDir` is
   * where text with no path is resolved from. One directory, decided here,
   * for discovery and for the 2.1 rules that ask where a quoted include is.
   * An empty path is no path, and is decided so once for both fields.
   */
  private static _inMemoryRoot(
    input: Extract<TTranspileInput, { kind: "source" }>,
  ): IInMemorySource {
    const sourcePath = input.sourcePath === "" ? undefined : input.sourcePath;
    return {
      path: sourcePath ?? "<string>",
      source: input.source,
      directory: sourcePath
        ? dirname(resolve(sourcePath))
        : (input.workingDir ?? process.cwd()),
    };
  }

  /**
   * The artifact, frozen: the record, its arrays and each file's record. Maps
   * are typed read-only, as `Program`'s are.
   */
  private _freeze(files: TDiscoveredFiles): ISourceGraph {
    return Object.freeze({
      cnextFiles: Object.freeze(
        files.cnextFiles.map((file) => Object.freeze(file)),
      ),
      headerFiles: Object.freeze([...files.headerFiles]),
      headerSearchPaths: files.headerSearchPaths,
      includeSearchPaths: Object.freeze([...files.includeSearchPaths]),
      includes: this.includes,
      anchor: Object.freeze({
        directory: this.anchor.directory,
        projectRoot: this.anchor.projectRoot,
        defines: this.anchor.defines,
        // ADR-049's build-system rung, from the text discovery read. The
        // build machine's environment too: PlatformIO appends its
        // PLATFORMIO_DEFAULT_ENVS to default_envs (#1794)
        platformio: this.anchor.projectRoot
          ? PlatformIOIni.read(this.anchor.projectRoot, this.fs, process.env)
          : null,
      }),
      writeOutputToDisk: files.writeOutputToDisk,
    });
  }

  /**
   * Stage 1 for a `{ kind: "files" }` run: the entry point, then every file
   * its includes reach.
   */
  private _fromFiles(): TDiscoveredFiles {
    const entryPath = resolve(this.settings.input);

    // Check if this is a C/C++ entry point
    if (InputExpansion.isCppEntryPoint(entryPath)) {
      return this._fromCppEntryPoint(entryPath);
    }

    // Step 1: Discover entry point file (original .cnx entry point logic)
    const cnextFiles: IDiscoveredFile[] = [];
    const fileByPath = new Map<string, IDiscoveredFile>();

    const entryFile = FileDiscovery.discoverFile(entryPath, this.fs);
    if (entryFile?.type !== EFileType.CNext) {
      return Discover._noCNextFiles();
    }
    cnextFiles.push(entryFile);
    fileByPath.set(resolve(entryFile.path), entryFile);

    // Step 2: Build dependency graph, resolve headers, and return pipeline input
    return this._buildFiles(cnextFiles, fileByPath);
  }

  /**
   * Discover C-Next files from a C/C++ entry point.
   *
   * Scans the include tree for headers with C-Next generation markers,
   * extracts the source .cnx paths, and returns them for transpilation.
   */
  private _fromCppEntryPoint(entryPath: string): TDiscoveredFiles {
    // #1706: the entry point's search path and each discovered .cnx file's
    // are the ones .cnx discovery computes, discovered tiers included.
    const tiersByDirectory = new Map<string, readonly string[]>();
    const searchPaths = this._searchPathsFor(entryPath, [], tiersByDirectory);

    const scanner = new CppEntryPointScanner(searchPaths, this.fs, (cnxPath) =>
      this._searchPathsFor(cnxPath, [], tiersByDirectory),
    );
    const scanResult = scanner.scan(entryPath);

    // #1541: these are ERRORS, and they now behave like it.
    //
    // They were pushed onto `this.warnings` with a hand-written `Error: `
    // prefix, which produced `Warning: Error: C-Next source not found: x.cnx`
    // and, far worse, exit 0 with zero output files -- while the same fault
    // reached through a quoted include is E0506 and exits 1. Two discovery
    // routes, one class of fault, opposite outcomes.
    //
    // The comment that stood here said the prefix was "to distinguish from
    // informational warnings", which states the conflation rather than
    // resolving it: `IScanResult` already separates the two, and only this
    // consumer merged them.
    //
    // This is the shape #1319 settled twice in the catches above -- a
    // deliberate rejection propagates, an incidental failure degrades. The
    // error was buried doubly here, because a marker found with no source also
    // sets `noCNextFound`, so the run additionally printed the friendly
    // "To get started:" onboarding text at a user whose header path was wrong.
    // The warnings are pushed BEFORE the throw, deliberately. The scan collects
    // `#include "x.h" not found (from ...)` and `Could not read <path>`, and a
    // missing C-Next source is very often downstream of exactly those -- so
    // throwing first would report "that source is not there" while discarding
    // the reason. `ResultPrinter` emits warnings above errors, so they land
    // where a reader looks next.
    this.warnings.push(...scanResult.warnings);

    if (scanResult.errors.length > 0) {
      throw new Error(
        `E0509: ${scanResult.errors.join("\n       ")}\n` +
          `  A generated header records the C-Next source it was written from.\n` +
          `  Check that source is present, and reachable from the include path.`,
      );
    }

    if (scanResult.noCNextFound) {
      return Discover._noCNextFiles();
    }

    // Convert discovered .cnx paths to IDiscoveredFile array
    const cnextFiles: IDiscoveredFile[] = scanResult.cnextSources.map(
      (path) => ({
        path,
        type: EFileType.CNext,
        extension: ".cnx",
      }),
    );

    // Build fileByPath map for dependency resolution
    const fileByPath = new Map<string, IDiscoveredFile>();
    for (const cnxFile of cnextFiles) {
      fileByPath.set(resolve(cnxFile.path), cnxFile);
    }

    // Scanner discovers .cnx files via header markers in the C/C++ include tree.
    // _buildFiles then resolves direct .cnx-to-.cnx includes (e.g.,
    // #include "utils.cnx") which the scanner visits but doesn't add to sources.
    return this._buildFiles(cnextFiles, fileByPath);
  }

  /** Discovery's answer when it finds no C-Next file to transpile. */
  private static _noCNextFiles(): TDiscoveredFiles {
    return {
      cnextFiles: [],
      headerFiles: [],
      headerSearchPaths: new Map(),
      includeSearchPaths: [],
      writeOutputToDisk: true,
    };
  }

  /**
   * Stage 1 for a `{ kind: "source" }` run: the same discovery as files mode,
   * rooted at text that is supplied rather than read.
   *
   * #1435: this resolved only the root itself and walked the rest with a
   * second walker. That walker rebuilt each include's search path without the
   * PlatformIO and Arduino tiers, read files around the injected filesystem,
   * collected no header an include pulled in, and did not know the root was
   * already in the run -- so a cyclic include enqueued the root a second time
   * and declared it twice (E0203). Discovery is one loop now, and the root is
   * in its graph from the start, so a back edge to it is an edge.
   *
   * @param callerIncludeDirs - The input's own include directories. They are
   *   the run's, as `config.includeDirs` are: every file the root reaches
   *   searches them, not the root alone.
   */
  private _fromSource(
    entry: IInMemorySource,
    callerIncludeDirs: readonly string[],
  ): TDiscoveredFiles {
    const root: IDiscoveredFile = {
      path: entry.path,
      type: EFileType.CNext,
      extension: ".cnx",
    };
    const discovered = this._buildFiles(
      [root],
      new Map([[resolve(entry.path), root]]),
      entry,
      callerIncludeDirs,
    );

    // The root is the one file this run generates; everything it reaches only
    // contributes symbols. Source mode uses the basename for a self-include, to
    // match files mode.
    return {
      ...discovered,
      cnextFiles: discovered.cnextFiles.map((file) =>
        file.path === entry.path
          ? {
              ...file,
              source: entry.source,
              sourceRelativePath: basename(entry.path),
            }
          : { ...file, symbolOnly: true },
      ),
      writeOutputToDisk: false,
    };
  }

  /**
   * Build the graph from the C-Next files discovered so far.
   *
   * Processes includes, builds dependency graph, resolves headers transitively,
   * and converts to pipeline files. Used by both .cnx and C/C++ entry point paths.
   *
   * @param callerIncludeDirs - A source run's own include directories, which
   *   every file of the run searches (see `_fromSource`).
   */
  private _buildFiles(
    cnextFiles: IDiscoveredFile[],
    fileByPath: Map<string, IDiscoveredFile>,
    inMemory?: IInMemorySource,
    callerIncludeDirs: readonly string[] = [],
  ): TDiscoveredFiles {
    const headerRoots = new Map<string, IHeaderRoot>();
    const depGraph = new DependencyGraph();

    const directForeignHeaderFiles = new Set<string>();
    // #1435: the include graph, kept. It is resolved here once, with the full
    // search path, and 1.4 takes every file's visibility closure over it.
    const includesByPath = new Map<string, IDiscoveredFile[]>();
    const tiersByDirectory = new Map<string, readonly string[]>();
    // #1835 review: the text discovery read, which 1.2 parses -- one read, so
    // a save between the passes cannot give them different directives.
    const sourcesByPath = new Map<string, string>();
    // #1723: every file's search path, merged in discovery order.
    const includeSearchPaths = new Set<string>();
    // `cnextFiles` grows as includes are found, so this visits the closure.
    for (const cnxFile of cnextFiles) {
      const cnxPath = resolve(cnxFile.path);
      depGraph.addFile(cnxPath);
      const discovered = this._resolveCnxIncludes(
        cnxFile,
        callerIncludeDirs,
        tiersByDirectory,
        inMemory?.path === cnxFile.path ? inMemory : undefined,
      );
      const resolved = discovered.resolved;
      sourcesByPath.set(cnxPath, discovered.content);
      for (const searchPath of discovered.searchPaths) {
        includeSearchPaths.add(searchPath);
      }
      if (resolved.hasForeignInclude) {
        directForeignHeaderFiles.add(cnxPath);
      }
      Discover._collectHeaders(resolved, discovered.searchPaths, headerRoots);
      includesByPath.set(
        cnxPath,
        Discover._processCnextIncludes(
          resolved,
          cnxPath,
          depGraph,
          cnextFiles,
          fileByPath,
        ),
      );
    }

    // Include visibility is transitive, so the precondition for E0426/E0427
    // must be too.
    const reachesForeign = depGraph.collectDependentsOf(
      directForeignHeaderFiles,
    );

    // Issue #580: Sort files topologically for correct cross-file const inference
    const sortedCnextFiles = this._sortFilesByDependency(depGraph, fileByPath);

    // Resolve headers transitively, each along its includer's search path
    const allHeaders = this._resolveHeadersTransitively([
      ...headerRoots.values(),
    ]);

    // Convert IDiscoveredFile[] to IPipelineFile[] (disk-based, all get code gen)
    const pipelineFiles: IPipelineFile[] = sortedCnextFiles.map((f) => {
      const cnextIncludes = includesByPath.get(resolve(f.path));
      invariant(
        cnextIncludes !== undefined,
        `discovery resolves the includes of every file it sorts (missing ${f.path})`,
      );
      const source = sourcesByPath.get(resolve(f.path));
      invariant(
        source !== undefined,
        `discovery reads the text of every file it sorts (missing ${f.path})`,
      );
      return {
        path: f.path,
        source,
        discoveredFile: f,
        cnextIncludes,
        reachesForeignHeader: reachesForeign.has(resolve(f.path)),
      };
    });

    return {
      cnextFiles: pipelineFiles,
      headerFiles: allHeaders.headers,
      headerSearchPaths: allHeaders.searchPaths,
      includeSearchPaths: [...includeSearchPaths],
      writeOutputToDisk: true,
    };
  }

  /**
   * Resolve one `.cnx` file's includes -- the one place discovery decides such
   * a file's text, its directory and its search path. What each directive
   * resolved to is recorded, so 2.1's ADR-010 rules read that answer rather
   * than resolve the include again (#1672), and the text read here is the
   * text 1.2 parses, so the two cannot see different directives (#1835
   * review). The search path is `_searchPathsFor`'s, which a C/C++ entry
   * point's marker scan uses too (#1706).
   *
   * #1435: every file in a run comes through here, including the root of a
   * source run, whose text is `inMemory.source` and whose directory is
   * `inMemory.directory`. The search path is the same computation for every
   * file: the directory, then the caller's include directories (a source
   * run's own, which every file it reaches searches), then everything
   * `discoverIncludePaths` finds from the file's directory (the project tiers,
   * PlatformIO libdeps and Arduino libraries), then the configured ones. An
   * in-memory root used to get a path without the PlatformIO and Arduino
   * tiers, so the editor preview could not see a library the CLI compiled.
   *
   * @param tiersByDirectory - `discoverIncludePaths` answers, per directory,
   *   for this discovery pass. It reads only the directory of the path it is
   *   given, the filesystem and $HOME, none of which change within one pass,
   *   so the files of one directory share one answer -- and a source run makes
   *   this pass on every editor request.
   * @returns the resolution, the search path it was made along -- which
   *   the C headers this file reaches are searched along too (#1723) -- and
   *   the text it was read from
   */
  private _resolveCnxIncludes(
    cnxFile: IDiscoveredFile,
    callerIncludeDirs: readonly string[],
    tiersByDirectory: Map<string, readonly string[]>,
    inMemory?: IInMemorySource,
  ): {
    readonly resolved: ReturnType<IncludeResolver["resolve"]>;
    readonly searchPaths: readonly string[];
    readonly content: string;
  } {
    const content = inMemory?.source ?? this.fs.readFile(cnxFile.path);
    const sourceDir = inMemory?.directory ?? dirname(cnxFile.path);
    const searchPaths = this._searchPathsFor(
      join(sourceDir, basename(cnxFile.path)),
      callerIncludeDirs,
      tiersByDirectory,
    );

    const resolver = new IncludeResolver(
      searchPaths,
      this.headerExtension,
      this.fs,
      this.headerIncludePathFor,
      sourceDir,
    );
    const resolved = resolver.resolve(content, cnxFile.path);
    this.includes.set(
      cnxFile.path,
      Object.freeze({
        // Issue #1467: one resolution, read later by both the .c and the .h
        cnxIncludeRewrites: resolved.cnextIncludeRewrites,
        // #1672: what each directive resolved to, which 2.1's ADR-010 rules read
        resolutions: resolved.resolutions,
        cnextAlternatives: resolved.cnextAlternatives,
        // #1444, owner ruling 1: what each directive's spelling names, which
        // 2.1 and render read rather than classify
        kinds: resolved.kinds,
        // #1435: the directory its quoted includes resolve from, which a
        // generated header spells them relative to (#1725)
        quotedIncludeDirectory: sourceDir,
        // Issues #497/#854: how this file spells each header and .cnx it
        // includes, which is what its own generated header must say (#1435)
        headerIncludeDirectives: resolved.headerIncludeDirectives,
        writerRelativeIncludes: resolved.writerRelativeIncludes,
        // #1444: what its own generated header includes, from the tokens
        // read here rather than from 1.2's tree in Stage 5
        userIncludes: Object.freeze(resolved.userIncludes),
        cHeaderIncludes: Object.freeze(resolved.cHeaderIncludes),
      }),
    );
    this.warnings.push(...resolved.warnings);
    return { resolved, searchPaths, content };
  }

  /**
   * The search path a file's includes resolve along: its directory, then the
   * caller's include directories, then everything `discoverIncludePaths`
   * finds from that directory (the project tiers, PlatformIO libdeps and
   * Arduino libraries), then the configured ones. The one computation for a
   * `.cnx` file (#1435) and for a C/C++ entry point (#1706), which built a
   * list of its own without the tiers.
   *
   * @param file - The file, or where an in-memory file lives
   * @param tiersByDirectory - `discoverIncludePaths` answers, per directory,
   *   for this discovery pass. It reads only the directory of the path it is
   *   given, the filesystem and $HOME, none of which change within one pass,
   *   so the files of one directory share one answer -- and a source run makes
   *   this pass on every editor request.
   */
  private _searchPathsFor(
    file: string,
    callerIncludeDirs: readonly string[],
    tiersByDirectory: Map<string, readonly string[]>,
  ): string[] {
    const directory = dirname(resolve(file));
    let tiers = tiersByDirectory.get(directory);
    if (tiers === undefined) {
      tiers = IncludeDiscovery.discoverIncludePaths(file, this.fs);
      tiersByDirectory.set(directory, tiers);
    }
    return IncludeResolver.buildSearchPaths(
      dirname(file),
      [...this.anchor.includeDirs],
      [...callerIncludeDirs, ...tiers],
      undefined,
      this.fs,
    );
  }

  /**
   * Sort files topologically and convert paths to IDiscoveredFile array.
   */
  private _sortFilesByDependency(
    depGraph: DependencyGraph,
    fileByPath: Map<string, IDiscoveredFile>,
  ): IDiscoveredFile[] {
    const sortedPaths = depGraph.getSortedFiles();
    this.warnings.push(...depGraph.getWarnings());

    const sortedFiles: IDiscoveredFile[] = [];
    for (const path of sortedPaths) {
      const file = fileByPath.get(path);
      if (file) {
        sortedFiles.push(file);
      }
    }
    return sortedFiles;
  }

  /**
   * Process C-Next includes from resolved includes.
   * Issue #461: Collect included .cnx files for symbol resolution
   * Issue #580: Track dependencies for topological sorting
   *
   * @returns this file's direct includes, each as the run's own entry for that
   *   file (#1435), so 1.4's visibility closure keys on the same paths the
   *   files were declared under.
   */
  private static _processCnextIncludes(
    resolved: { cnextIncludes: IDiscoveredFile[] },
    cnxPath: string,
    depGraph: DependencyGraph,
    cnextFiles: IDiscoveredFile[],
    fileByPath: Map<string, IDiscoveredFile>,
  ): IDiscoveredFile[] {
    const direct: IDiscoveredFile[] = [];
    for (const cnxInclude of resolved.cnextIncludes) {
      const includePath = resolve(cnxInclude.path);

      depGraph.addDependency(cnxPath, includePath);

      // Don't add if already in the list.
      //
      // Issue #1134: identity here is the RESOLVED PATH, never the basename.
      // Keying on the basename made can/config.cnx and uart/config.cnx the same
      // file, so the second was dropped from the compilation entirely — the
      // transpiler exited 0 and emitted C-Next source syntax into the C output.
      // `fileByPath` indexes `cnextFiles` by exactly that path, on every route.
      const existing = fileByPath.get(includePath);
      if (!existing) {
        cnextFiles.push(cnxInclude);
        fileByPath.set(includePath, cnxInclude);
      }
      direct.push(existing ?? cnxInclude);
    }
    return direct;
  }

  /**
   * Record each header a `.cnx` file includes as a root of the header walk.
   *
   * #1435: this skipped any header whose BASENAME matched a C-Next file of the
   * run, a guess from when discovery scanned whole directories and every `.h`
   * beside a `.cnx` was "likely generated output" (77d2a9903). A basename is
   * not an identity -- the #1134 shape -- so `uart.cnx` wrapping ESP-IDF's
   * `<driver/uart.h>` lost the vendor header and failed with E0422. A header
   * the transpiler generated is identified by the marker it carries, and
   * `IncludeResolver.resolveHeadersTransitively` already skips it on that.
   *
   * #1723: each header keeps the search path of the first file that reached
   * it, and its own includes are searched along that path.
   */
  private static _collectHeaders(
    resolved: { headers: IDiscoveredFile[] },
    searchPaths: readonly string[],
    headerRoots: Map<string, IHeaderRoot>,
  ): void {
    for (const header of resolved.headers) {
      if (!headerRoots.has(header.path)) {
        headerRoots.set(header.path, { file: header, searchPaths });
      }
    }
  }

  /**
   * Every header the run reaches, each resolved along its includer's search
   * path.
   *
   * #1444: this handed the walk the orchestrator's `processedHeaders` as the
   * walk's starting `visited` set. Only Stage 2 wrote that set, after
   * discovery, and every run cleared it before discovery began, so the walk
   * always started from an empty one. The walk's own `visited` set is the cycle
   * guard, and it is unchanged.
   */
  private _resolveHeadersTransitively(roots: ReadonlyArray<IHeaderRoot>): {
    headers: IDiscoveredFile[];
    searchPaths: ReadonlyMap<string, readonly string[]>;
  } {
    const resolved = IncludeResolver.resolveHeadersTransitively(roots, {
      onDebug: this.settings.debugMode
        ? (msg) => console.log(`[DEBUG] ${msg}`)
        : undefined,
      fs: this.fs,
    });
    this.warnings.push(...resolved.warnings);
    return resolved;
  }
}

export default Discover;
