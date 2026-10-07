import { basename, dirname, join, resolve } from "node:path";

import CppEntryPointScanner from "./CppEntryPointScanner";
import DependencyGraph from "./DependencyGraph";
import FileDiscovery from "./FileDiscovery";
import HeaderSources from "./HeaderSources";
import IncludeDiscovery from "./IncludeDiscovery";
import IncludeResolver from "./IncludeResolver";
import InputExpansion from "./InputExpansion";
import PlatformIOIni from "./PlatformIOIni";
import EFileType from "./types/EFileType";
import EHeaderLanguage from "./types/EHeaderLanguage";
import type IHeaderSource from "./types/IHeaderSource";
import type IRecoveredDeclarations from "./types/IRecoveredDeclarations";
import type IDiscoveredFile from "./types/IDiscoveredFile";
import type ISourceSite from "../../types/ISourceSite";
import CodedErrorText from "../../utils/CodedErrorText";
import type IHeaderInclude from "./types/IHeaderInclude";
import type IHeaderRoot from "./types/IHeaderRoot";
import type PreprocessCache from "./preprocessor/PreprocessCache";
import type IFileSystem from "../../types/IFileSystem";
import type ITranspileError from "../../lib/types/ITranspileError";
import type IInMemorySource from "./types/IInMemorySource";
import type IPipelineFile from "./types/IPipelineFile";
import type IRunAnchor from "./types/IRunAnchor";
import type ITranspilerConfig from "../../types/ITranspilerConfig";
import type THeaderExtension from "../../types/THeaderExtension";
import type TTranspileInput from "../../types/TTranspileInput";
import invariant from "../../utils/invariant";
import DeclarationSite from "../../utils/DeclarationSite";
import IncludeDirectiveText from "../../utils/IncludeDirectiveText";
import OutputExtensions from "../../utils/OutputExtensions";
import ReadOnceFileSystem from "./ReadOnceFileSystem";
import RunAnchor from "./RunAnchor";
import type IFileIncludes from "./types/IFileIncludes";
import type ISourceGraph from "./types/ISourceGraph";

/** The configuration a run's discovery reads. */
type TDiscoverySettings = Pick<
  Required<ITranspilerConfig>,
  "input" | "includeDirs" | "defines" | "outDir" | "headerOutDir" | "debugMode"
> &
  // #1844: unset is not false. Unset, C++ in a header makes the run C++;
  // `false` asked for C, and C++ met there is E0507.
  Pick<ITranspilerConfig, "cppRequired">;

/** The graph before it is frozen, without the facts gathered beside it. */
type TDiscoveredFiles = Omit<
  ISourceGraph,
  "includes" | "anchor" | "headerSources" | "recoveredDeclarations" | "cppMode"
> & {
  /** #1844: every `.cnx` file's header includes, in discovery order */
  readonly headerIncludes: readonly IHeaderInclude[];
  /** #1844: per header, the headers the walk found it includes */
  readonly headerEdges: ReadonlyMap<string, readonly string[]>;
};

/** A `.cnx` file's includes, resolved but not yet spelled (#1844). */
interface IResolvedFileIncludes {
  readonly resolved: ReturnType<IncludeResolver["resolve"]>;
  readonly quotedIncludeDirectory: string;
}

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
   * The run's discovery errors: E0509, each at its header's marker (#1542),
   * and E0507, at the `.cnx` include that reached the C++ header (#1844).
   */
  private readonly errors: ITranspileError[] = [];

  /**
   * #1844: each file's includes as resolved, in visiting order. They are
   * spelled into `includes` once the run's mode is settled, because a `.cnx`
   * include names a generated header, whose extension follows the mode.
   */
  private readonly resolvedIncludes = new Map<string, IResolvedFileIncludes>();

  private constructor(
    private readonly anchor: IRunAnchor,
    private readonly settings: TDiscoverySettings,
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
   * @param warnings - Where discovery's warnings go
   * @param preprocessCache - Where each preprocessor run is kept (#1844);
   *   null when the run asks for no cache
   * @returns the frozen graph, the anchor the run's services come from, and
   *   the errors that reject the run. A run with errors goes no further.
   */
  static async run(
    input: TTranspileInput,
    previousAnchor: IRunAnchor,
    settings: TDiscoverySettings,
    fs: IFileSystem,
    warnings: string[],
    preprocessCache: PreprocessCache | null = null,
  ): Promise<{
    readonly graph: ISourceGraph;
    readonly anchor: IRunAnchor;
    readonly errors: readonly ITranspileError[];
  }> {
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
      new ReadOnceFileSystem(fs),
      warnings,
    );
    const files =
      input.kind === "source" && root !== null
        ? discovery._fromSource(root, input.includeDirs ?? [])
        : discovery._fromFiles();
    // #1844: every header judged once, on the text a C compile meets, and
    // the run's mode from those judgments.
    if (files.headerFiles.length > 0 && !anchor.preprocessor.isAvailable()) {
      discovery._noPreprocessor(files.headerIncludes);
      return {
        graph: discovery._freeze(files, new Map(), null, false),
        anchor,
        errors: discovery.errors,
      };
    }
    const unit = discovery._translationUnit(files.cnextFiles);
    const settled = await HeaderSources.settle(
      files.headerFiles,
      files.headerSearchPaths,
      {
        fs: discovery.fs,
        preprocessor: anchor.preprocessor,
        defines: anchor.defines,
        cache: preprocessCache,
      },
      {
        directives: unit.directives,
        includePaths: files.includeSearchPaths,
        headers: new Set(files.headerIncludes.map(({ header }) => header)),
      },
    );
    discovery._unsettled(
      files.headerIncludes,
      settled.unsettled,
      settled.opened,
    );
    const cppMode = discovery._cppMode(
      files.headerIncludes,
      settled.sources,
      settled.opened,
      settled.recovered,
      unit.sites,
      settings.cppRequired,
    );
    discovery._spellIncludes(OutputExtensions.forCppMode(cppMode).header);
    return {
      graph: discovery._freeze(
        files,
        settled.sources,
        settled.recovered,
        cppMode,
      ),
      anchor,
      errors: discovery.errors,
    };
  }

  /**
   * The run's C/C++ mode (#1428, owner ruling): detected, not declared. Any
   * C++ header makes the whole run C++, unless the config says
   * `cppRequired: false` -- a run that asked for C, where C++ is E0507
   * (#1844), at every `.cnx` include through which the run meets it.
   * `cppRequired: true` (or `--cpp`) is C++ with only C headers.
   */
  private _cppMode(
    includes: readonly IHeaderInclude[],
    sources: ReadonlyMap<string, IHeaderSource>,
    opened: ReadonlyMap<string, ReadonlySet<string>>,
    recovered: IRecoveredDeclarations | null,
    unitSites: ReadonlyMap<string, readonly ISourceSite[]>,
    cppRequired: boolean | undefined,
  ): boolean {
    const met = Discover._cppMet(
      includes,
      sources,
      opened,
      recovered,
      unitSites,
    );
    if (cppRequired === false) {
      for (const cpp of Discover._inSourceOrder([...met.values()])) {
        this._cppInCRun(cpp);
      }
      return false;
    }
    return cppRequired ?? met.size > 0;
  }

  /** Each `.cnx` include through which the run meets C++, and the C++ it meets */
  private static _cppMet(
    includes: readonly IHeaderInclude[],
    sources: ReadonlyMap<string, IHeaderSource>,
    opened: ReadonlyMap<string, ReadonlySet<string>>,
    recovered: IRecoveredDeclarations | null,
    unitSites: ReadonlyMap<string, readonly ISourceSite[]>,
  ): ReadonlyMap<string, { path: string; site: ISourceSite }> {
    const languages = new Map(
      [...sources].map(([path, { language }]) => [resolve(path), language]),
    );
    const isCpp = (path: string): boolean =>
      languages.get(path) === EHeaderLanguage.Cpp;
    const met = new Map<string, { path: string; site: ISourceSite }>();
    for (const { header, site } of includes) {
      const cpp = Discover._opensFrom(header, opened).find(isCpp);
      if (cpp !== undefined)
        met.set(Discover._siteKey(site), { path: cpp, site });
    }
    // #985: a slice the toolchain found on its own path is met by the compile
    // as much as a header the walk reached, through every include of the
    // directive that entered it.
    for (const [path, { language, directive }] of recovered?.slices ?? []) {
      if (language !== EHeaderLanguage.Cpp) continue;
      const sites = directive === null ? undefined : unitSites.get(directive);
      invariant(
        sites !== undefined,
        `the unit's preprocessor entered every C++ slice through one of its includes (missing ${path})`,
      );
      for (const site of sites) {
        const key = Discover._siteKey(site);
        if (!met.has(key)) met.set(key, { path, site });
      }
    }
    return met;
  }

  /** E0507: a run that asked for C meets C++ through this include */
  private _cppInCRun(cpp: { path: string; site: ISourceSite }): void {
    const reason =
      FileDiscovery.classifyFile(cpp.path).type === EFileType.CppHeader
        ? "C++ header"
        : "C++ syntax";
    this.errors.push({
      ...cpp.site,
      message: CodedErrorText.of(
        "E0507",
        `${reason} in '${DeclarationSite.displayPath(cpp.path)}', reached ` +
          `through this include, but this run asks for C`,
      ),
      helpText:
        "'cppRequired: false' (or --no-cpp) asks for C. Remove it so the " +
        "mode is detected from the headers, or pass --cpp to compile as C++.",
      severity: "error",
    });
  }

  /**
   * #1844, owner ruling 5 of 2026-10-03 (#1542): a run that includes headers
   * needs a preprocessor, since each header's language is judged on its
   * preprocessed text. Reported at the run's first header include.
   */
  private _noPreprocessor(includes: readonly IHeaderInclude[]): void {
    const first = Discover._inSourceOrder(includes)[0];
    invariant(
      first !== undefined,
      "a run with headers has a `.cnx` include that reached them",
    );
    this.errors.push({
      ...first.site,
      message: CodedErrorText.of(
        "E0516",
        "this run includes C headers, and no C preprocessor was found to read them",
      ),
      helpText:
        "Install gcc, clang or arm-none-eabi-gcc, or set CNEXT_CROSS_COMPILER " +
        "to the compiler for the target's headers.",
      severity: "error",
    });
  }

  /**
   * #1844, owner ruling 6 of 2026-10-03 (#1542): a header that cannot be
   * preprocessed, alone, after its predecessors' macros, or in the unit, is
   * not read as written. It is an error at every `.cnx` include that reached
   * it, with the preprocessor's own message as help.
   */
  private _unsettled(
    includes: readonly IHeaderInclude[],
    unsettled: ReadonlyMap<string, string>,
    opened: ReadonlyMap<string, ReadonlySet<string>>,
  ): void {
    if (unsettled.size === 0) return;
    const messages = new Map(
      [...unsettled].map(([path, message]) => [resolve(path), message]),
    );
    for (const { header, site } of Discover._inSourceOrder(includes)) {
      for (const path of Discover._opensFrom(header, opened)) {
        const message = messages.get(path);
        if (message === undefined) continue;
        this.errors.push({
          ...site,
          message: CodedErrorText.of(
            "E0517",
            `'${DeclarationSite.displayPath(path)}', reached through this ` +
              `include, cannot be preprocessed`,
          ),
          helpText: message,
          severity: "error",
        });
      }
    }
  }

  /**
   * `header`, then each file a C compile of it opened, by resolved path. The
   * walk's edges ignore `#if`, so they are not the compile's (#1844).
   */
  private static _opensFrom(
    header: string,
    opened: ReadonlyMap<string, ReadonlySet<string>>,
  ): string[] {
    const path = resolve(header);
    return [path, ...(opened.get(path) ?? [])];
  }

  private static _siteKey(site: ISourceSite): string {
    return `${site.sourcePath}:${site.line}:${site.column}`;
  }

  /** By file, then line, then column: one order whatever the walk's */
  private static _inSourceOrder<T extends { readonly site: ISourceSite }>(
    entries: readonly T[],
  ): T[] {
    return [...entries].sort(
      (a, b) =>
        // By code unit, not locale: one order on every machine
        (a.site.sourcePath < b.site.sourcePath
          ? -1
          : Number(a.site.sourcePath > b.site.sourcePath)) ||
        a.site.line - b.site.line ||
        a.site.column - b.site.column,
    );
  }

  /**
   * Issue #985: every C header the `.cnx` files include, as a translation
   * unit includes it, deduped in first-seen source order.
   */
  private _translationUnit(cnextFiles: readonly { readonly path: string }[]): {
    readonly directives: string[];
    /** #1844: per directive, each file's first include that wrote it */
    readonly sites: ReadonlyMap<string, readonly ISourceSite[]>;
  } {
    const sites = new Map<string, ISourceSite[]>();
    for (const file of cnextFiles) {
      const includes = this.resolvedIncludes.get(file.path);
      invariant(
        includes !== undefined,
        `discovery resolves the includes of every file it reaches (missing ${file.path})`,
      );
      // #1830 review: the directives 1.1 read, so a commented-out header adds
      // nothing to the unit.
      for (const spec of includes.resolved.cHeaderSpecs) {
        const written = sites.get(spec) ?? [];
        if (written.some((site) => site.sourcePath === file.path)) continue;
        const position = includes.resolved.positions.get(
          IncludeDirectiveText.ofSpec(spec),
        );
        invariant(
          position !== undefined,
          `the resolver records where every directive sits (missing ${spec} in ${file.path})`,
        );
        sites.set(spec, [...written, { sourcePath: file.path, ...position }]);
      }
    }
    return { directives: [...sites.keys()], sites };
  }

  /**
   * #1844: each file's include spellings, for a run whose generated headers
   * take `headerExtension`, in the order discovery visited the files.
   */
  private _spellIncludes(headerExtension: THeaderExtension): void {
    const headerIncludePathFor = (cnxPath: string): string | null =>
      this.anchor.pathResolver.getHeaderIncludePath(cnxPath, headerExtension);
    for (const [path, { resolved, quotedIncludeDirectory }] of this
      .resolvedIncludes) {
      // Issue #1467: PathResolver's answer to "where is this .cnx's header
      // reachable from?", so the include text and the header's location are
      // the same derivation rather than two that happen to agree.
      const spelling = IncludeResolver.spell(
        resolved,
        headerExtension,
        headerIncludePathFor,
      );
      this.includes.set(
        path,
        Object.freeze({
          // Issue #1467: one resolution, read later by both the .c and the .h
          cnxIncludeRewrites: spelling.cnextIncludeRewrites,
          // #1672: what each directive resolved to, which 2.1's ADR-010 rules read
          resolutions: resolved.resolutions,
          cnextAlternatives: resolved.cnextAlternatives,
          // #1444, owner ruling 1: what each directive's spelling names, which
          // 2.1 and render read rather than classify
          kinds: resolved.kinds,
          // #1435: the directory its quoted includes resolve from, which a
          // generated header spells them relative to (#1725)
          quotedIncludeDirectory,
          // Issues #497/#854: how this file spells each header and .cnx it
          // includes, which is what its own generated header must say (#1435)
          headerIncludeDirectives: spelling.headerIncludeDirectives,
          writerRelativeIncludes: spelling.writerRelativeIncludes,
          // #1444: what its own generated header includes, from the tokens
          // read here rather than from 1.2's tree in Stage 5
          userIncludes: Object.freeze(spelling.userIncludes),
          cHeaderIncludes: Object.freeze(resolved.cHeaderIncludes),
          cHeaderSpecs: Object.freeze(resolved.cHeaderSpecs),
        }),
      );
    }
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
   * The artifact, frozen all the way down: the record, its arrays, each file's
   * record and everything under it, and the anchor's facts. Maps are typed
   * read-only, as `Program`'s are, and left as they are: freezing a `Map`
   * stops nothing, since `set` writes no property.
   *
   * #1444 review: this froze two levels. `discoveredFile`, `cnextIncludes`,
   * each header and `anchor.defines` still took writes, and two of those reached
   * past the record written: `anchor.defines` is the `RunAnchor`'s own object,
   * which the next run at that anchor reuses, and a file's `cnextIncludes`
   * entry is the included file's own `discoveredFile`.
   */
  private _freeze(
    files: TDiscoveredFiles,
    headerSources: ReadonlyMap<string, IHeaderSource>,
    recoveredDeclarations: IRecoveredDeclarations | null,
    cppMode: boolean,
  ): ISourceGraph {
    return Discover._frozen({
      cnextFiles: files.cnextFiles,
      // Only the headers a C compile opens are settled (#1844)
      headerFiles: files.headerFiles.filter((file) =>
        headerSources.has(file.path),
      ),
      headerSources,
      recoveredDeclarations,
      cppMode,
      headerSearchPaths: files.headerSearchPaths,
      includeSearchPaths: files.includeSearchPaths,
      includes: this.includes,
      anchor: {
        directory: this.anchor.directory,
        projectRoot: this.anchor.projectRoot,
        defines: this.anchor.defines,
        // ADR-049's build-system rung, from the text discovery read. The
        // build machine's environment too: PlatformIO appends its
        // PLATFORMIO_DEFAULT_ENVS to default_envs (#1794)
        platformio: this.anchor.projectRoot
          ? PlatformIOIni.read(this.anchor.projectRoot, this.fs, process.env)
          : null,
      },
      writeOutputToDisk: files.writeOutputToDisk,
    });
  }

  /**
   * Freeze plain objects and arrays all the way down, and leave each `Map` as
   * it is. The graph holds no cycle: an include edge names the included
   * file's `IDiscoveredFile`, which refers to nothing.
   */
  private static _frozen<T>(value: T): T {
    if (typeof value !== "object" || value === null || value instanceof Map) {
      return value;
    }
    for (const child of Object.values(value)) {
      Discover._frozen(child);
    }
    return Object.freeze(value);
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

    // #1541: these are ERRORS, and they now behave like it. They were pushed
    // onto `this.warnings`, which exited 0 with zero output files while the
    // same fault reached through a quoted include is E0506 and exits 1.
    //
    // #1542: and they are reported, not thrown. A throw reached the user at
    // `1:0` behind `Pipeline failed:`; each error now carries its header's
    // marker as its position, as every other diagnostic carries its own.
    //
    // The warnings are kept beside them: the scan collects `#include "x.h" not
    // found (from ...)` and `Could not read <path>`, and a missing C-Next source
    // is very often downstream of exactly those. A marker found with no source
    // also sets `noCNextFound`, so the errors are checked first: the run is
    // rejected, not told "No C-Next source files found".
    this.warnings.push(...scanResult.warnings);

    if (scanResult.errors.length > 0) {
      this.errors.push(...scanResult.errors);
      return Discover._noCNextFiles();
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
      headerIncludes: [],
      headerEdges: new Map(),
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
    const headerIncludes: IHeaderInclude[] = [];
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
      Discover._collectHeaders(
        resolved,
        cnxFile.path,
        discovered.searchPaths,
        headerRoots,
        headerIncludes,
      );
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
      headerIncludes,
      headerEdges: allHeaders.edges,
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

    const resolver = new IncludeResolver(searchPaths, this.fs, sourceDir);
    const resolved = resolver.resolve(content, cnxFile.path);
    this.resolvedIncludes.set(cnxFile.path, {
      resolved,
      quotedIncludeDirectory: sourceDir,
    });
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
    resolved: ReturnType<IncludeResolver["resolve"]>,
    sourcePath: string,
    searchPaths: readonly string[],
    headerRoots: Map<string, IHeaderRoot>,
    headerIncludes: IHeaderInclude[],
  ): void {
    const seen = new Set<string>();
    for (const header of resolved.headers) {
      if (seen.has(header.path)) continue;
      seen.add(header.path);
      // #1844: and where this file includes it, for E0507
      const include = resolved.included.find(
        (entry) => entry.absolutePath === resolve(header.path),
      );
      const position =
        include &&
        resolved.positions.get(IncludeDirectiveText.join(include.includeInfo));
      invariant(
        position !== undefined,
        `the resolver records the directive of every header it resolves (missing ${header.path})`,
      );
      headerIncludes.push({
        header: header.path,
        site: { sourcePath, ...position },
      });
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
    edges: ReadonlyMap<string, readonly string[]>;
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
