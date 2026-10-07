import { availableParallelism } from "node:os";
import { resolve } from "node:path";

import detectAssemblySyntax from "./detectAssemblySyntax";
import detectCppSyntax from "./detectCppSyntax";
import ExternalDeclarationOracle from "./preprocessor/ExternalDeclarationOracle";
import LineMarkers from "./preprocessor/LineMarkers";
import type Preprocessor from "./preprocessor/Preprocessor";
import FileDiscovery from "./FileDiscovery";
import EFileType from "./types/EFileType";
import EHeaderLanguage from "./types/EHeaderLanguage";
import type IDiscoveredFile from "./types/IDiscoveredFile";
import type IHeaderSource from "./types/IHeaderSource";
import type IRecoveredDeclarations from "./types/IRecoveredDeclarations";
import type IRecoveredSlice from "./types/IRecoveredSlice";
import type IFileSystem from "../../types/IFileSystem";
import type PreprocessCache from "./preprocessor/PreprocessCache";
import ConcurrencyLimit from "../../utils/ConcurrencyLimit";
import invariant from "../../utils/invariant";

type TPreprocessLimit = ReturnType<typeof ConcurrencyLimit.create>;

/** What settling a run's headers needs from the run. */
interface IHeaderSourceSettings {
  readonly fs: IFileSystem;
  readonly preprocessor: Preprocessor;
  readonly defines: Readonly<Record<string, string | boolean>>;
  /** Where each preprocessor run is kept, so a warm run starts none */
  readonly cache: PreprocessCache | null;
}

/**
 * One header preprocessed on its own: settled, or the preprocessor's message
 * and the text it was read as, for #985's unit to settle.
 */
type TAlone =
  | { readonly source: IHeaderSource; readonly raw: string }
  | { readonly source: null; readonly raw: string; readonly error: string };

/**
 * Issue #985: the translation unit a run's C includes make -- each `.cnx`
 * file's, deduped in first-seen order -- and the path it is searched along.
 */
interface ITranslationUnit {
  readonly directives: readonly string[];
  readonly includePaths: readonly string[];
}

/**
 * #1844: each header's text and language, settled once, in 1.1.
 *
 * §1 gives 1.1 a file's kind. A header's language was judged in Stage 2
 * instead, twice and on two texts: a cold run judged the preprocessed text it
 * parsed, and a warm one, which parsed nothing, judged the raw text. So C++
 * inside an `#if` the preprocessor removed passed cold and failed warm
 * (#1851). It is judged here now, on the text a C compile meets (#1542,
 * owner ruling 4), and Stage 2 parses that same text.
 */
class HeaderSources {
  /**
   * #1817: a header's first preprocessor run depends on nothing but the
   * header, so they all start at once, at most `availableParallelism()` at a
   * time. Only a retry depends on other headers: every earlier one that
   * preprocessed cleanly, including one that did so only through its own
   * retry. So each header is handed the headers before it, and waits for them
   * only if it has to retry.
   *
   * A header that cannot be preprocessed even so is settled from its slice
   * of `unit` preprocessed whole (#985): that slice is the text a C compile
   * meets. One the unit does not reach either is `unsettled`: nothing judges
   * a header on the text as written (owner ruling 6 of 2026-10-03, #1542).
   *
   * The preprocessor must be available: Discover rejects a run that includes
   * headers without one.
   *
   * @returns each settled header's source, by path, in `headers` order; the
   *   declarations `unit` recovered -- null unless a header needed them; and
   *   each unsettled header, with the preprocessor's message
   */
  static async settle(
    headers: readonly IDiscoveredFile[],
    searchPaths: ReadonlyMap<string, readonly string[]>,
    settings: IHeaderSourceSettings,
    unit: ITranslationUnit,
  ): Promise<{
    readonly sources: ReadonlyMap<string, IHeaderSource>;
    readonly recovered: IRecoveredDeclarations | null;
    readonly unsettled: ReadonlyMap<string, string>;
  }> {
    invariant(
      headers.length === 0 || settings.preprocessor.isAvailable(),
      "1.1 rejects a run that includes headers when no preprocessor is available",
    );
    const limit = ConcurrencyLimit.create(availableParallelism());
    const settled: Promise<TAlone>[] = [];
    for (const file of headers) {
      const paths = searchPaths.get(file.path);
      invariant(
        paths !== undefined,
        `discovery records the search path of every header it resolves (missing ${file.path})`,
      );
      // A copy: the headers before this one. The live array would come to
      // hold this header too, and a retry would wait for itself.
      const earlier = headers.slice(0, settled.length);
      settled.push(
        HeaderSources._alone(file, paths, earlier, [...settled], {
          ...settings,
          limit,
        }),
      );
    }
    const alone = await Promise.all(settled);
    const recovery = alone.some((header) => header.source === null)
      ? await ExternalDeclarationOracle.recover(
          unit.directives,
          settings.preprocessor,
          {
            // #1723: the unit holds every file's C includes, so it is searched
            // along every file's search path, not --include alone.
            includePaths: [...unit.includePaths],
            defines: { ...settings.defines },
            ...(settings.cache === null ? {} : { cache: settings.cache }),
          },
        )
      : null;
    // The preprocessor names a header by the path it found it along; the
    // walk, by the one it resolved. Both name the same file.
    const slices = new Map<string, string>();
    for (const [path, text] of recovery?.perFileContent ?? []) {
      slices.set(resolve(path), text);
    }
    const sources = new Map<string, IHeaderSource>();
    const unsettled = new Map<string, string>();
    headers.forEach((file, i) => {
      const header = alone[i];
      if (header.source !== null) {
        sources.set(file.path, header.source);
        return;
      }
      const slice = slices.get(resolve(file.path));
      if (slice === undefined) {
        unsettled.set(file.path, header.error);
        return;
      }
      sources.set(
        file.path,
        HeaderSources._sourceOf(file, header.raw, slice, slice),
      );
    });
    return {
      sources,
      recovered:
        recovery === null
          ? null
          : HeaderSources._recovered(headers, sources, recovery),
      unsettled,
    };
  }

  /**
   * A slice of a header the walk reached takes that header's language: one
   * judgement per header. Any other is one the toolchain found on its own
   * path, and is judged on its slice.
   */
  private static _recovered(
    headers: readonly IDiscoveredFile[],
    sources: ReadonlyMap<string, IHeaderSource>,
    recovery: {
      perFileContent: ReadonlyMap<string, string>;
      macroNames: ReadonlySet<string>;
      directiveOf: ReadonlyMap<string, string>;
    },
  ): IRecoveredDeclarations {
    const reached = new Map(
      headers.map((file) => [resolve(file.path), sources.get(file.path)]),
    );
    const slices = new Map<string, IRecoveredSlice>();
    for (const [path, text] of recovery.perFileContent) {
      const language =
        reached.get(resolve(path))?.language ??
        HeaderSources._languageOf(FileDiscovery.classifyFile(path).type, text);
      slices.set(
        path,
        Object.freeze({
          text,
          language,
          directive: recovery.directiveOf.get(path) ?? null,
        }),
      );
    }
    return Object.freeze({ slices, macroNames: recovery.macroNames });
  }

  /**
   * One header preprocessed on its own, and again with the macros of the
   * headers before it if it must (#1817).
   */
  private static async _alone(
    file: IDiscoveredFile,
    searchPaths: readonly string[],
    earlierFiles: readonly IDiscoveredFile[],
    earlier: readonly Promise<TAlone>[],
    settings: IHeaderSourceSettings & { readonly limit: TPreprocessLimit },
  ): Promise<TAlone> {
    const raw = settings.fs.readFile(file.path);
    // #1723: along the path this header was found on, so a header that
    // includes a sibling library's header preprocesses as it resolved. Its
    // line markers say which lines are the header's own.
    const options = {
      defines: { ...settings.defines },
      includePaths: [...searchPaths],
      keepLineDirectives: true,
      ...(settings.cache === null ? {} : { cache: settings.cache }),
    };
    const result = await settings.limit(() =>
      settings.preprocessor.preprocess(file.path, options),
    );
    if (result.success) {
      return HeaderSources._settled(file, raw, result.content);
    }

    // Some headers cannot be preprocessed standalone: they require a
    // predecessor to have run first (e.g. FreeRTOS task.h needs FreeRTOS.h to
    // define INC_FREERTOS_H and its attribute macros, and enforces this with
    // its own #error). Retry importing the macros of the headers before this
    // one (only those that themselves preprocessed cleanly, so one
    // unpreprocessable predecessor can't defeat the retry). #1817: the only
    // step that waits on other headers.
    const before = await Promise.all(earlier);
    const imacros = earlierFiles
      .filter((_, i) => before[i].source !== null)
      .map((header) => header.path);
    if (imacros.length > 0) {
      const retry = await settings.limit(() =>
        settings.preprocessor.preprocess(file.path, { ...options, imacros }),
      );
      if (retry.success) {
        return HeaderSources._settled(file, raw, retry.content);
      }
    }
    return {
      source: null,
      raw,
      error: result.diagnostics?.trim() || (result.error ?? "unknown error"),
    };
  }

  private static _settled(
    file: IDiscoveredFile,
    raw: string,
    preprocessed: string,
  ): TAlone {
    const own = LineMarkers.ownText(preprocessed, file.path);
    invariant(
      own !== null,
      `a header's preprocessed text holds its own lines (${file.path})`,
    );
    return {
      source: HeaderSources._sourceOf(
        file,
        raw,
        LineMarkers.strip(preprocessed),
        own,
      ),
      raw,
    };
  }

  /**
   * #1852: the language is judged on the header's own lines as a C compile
   * meets them, so C++ under `#ifdef __cplusplus` is gone and C++ a macro
   * writes is there. Issue #945: the text parsed is the preprocessed one only
   * when the header's `#if`s need an expression evaluated, to avoid the side
   * effects of full expansion; the parser handles `#ifdef` and friends itself.
   */
  private static _sourceOf(
    file: IDiscoveredFile,
    raw: string,
    preprocessed: string,
    own: string,
  ): IHeaderSource {
    return Object.freeze({
      text: HeaderSources._needsConditionalPreprocessing(raw)
        ? preprocessed
        : raw,
      language: HeaderSources._languageOf(file.type, own),
    });
  }

  /**
   * Whether a header's `#if`s need the preprocessor to evaluate an
   * expression. Issue #945.
   *
   * Needed: `#if MACRO != 0`, `#if MACRO == 1`, `#if MACRO > 0`, a bare
   * `#if MACRO`, `#elif MACRO != 0`, `#if defined(X) && MACRO`, ...
   *
   * Handled by the parser without it: `#ifdef MACRO`, `#ifndef MACRO`,
   * `#if defined(MACRO)`, `#if 1`, `#if 0`.
   */
  private static _needsConditionalPreprocessing(content: string): boolean {
    const ifExpressionPattern =
      /#(?:if|elif)\s+(?!defined\s*\()(?![01]\s*(?:$|\n|\/\*|\/\/))\w+/m;
    return ifExpressionPattern.test(content);
  }

  /**
   * The language `text` is written in. Issue #211: a C++ header extension is
   * always C++. Assembler headers (e.g. xtensa coreasm.h, pulled in
   * transitively by FreeRTOS port headers) are not C: their `.macro` bodies
   * parsed as C gave instruction mnemonics like `loop` as C symbols.
   */
  private static _languageOf(type: EFileType, text: string): EHeaderLanguage {
    if (type === EFileType.CppHeader) return EHeaderLanguage.Cpp;
    if (detectAssemblySyntax(text)) return EHeaderLanguage.Assembler;
    if (detectCppSyntax(text)) return EHeaderLanguage.Cpp;
    return EHeaderLanguage.C;
  }
}

export default HeaderSources;
