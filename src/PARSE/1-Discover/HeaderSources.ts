import { availableParallelism } from "node:os";
import { resolve } from "node:path";

import detectAssemblySyntax from "./detectAssemblySyntax";
import detectCppSyntax from "./detectCppSyntax";
import ExternalDeclarationOracle from "./preprocessor/ExternalDeclarationOracle";
import type Preprocessor from "./preprocessor/Preprocessor";
import FileDiscovery from "./FileDiscovery";
import EFileType from "./types/EFileType";
import EHeaderLanguage from "./types/EHeaderLanguage";
import type IDiscoveredFile from "./types/IDiscoveredFile";
import type IHeaderSource from "./types/IHeaderSource";
import type IRecoveredDeclarations from "./types/IRecoveredDeclarations";
import type IRecoveredSlice from "./types/IRecoveredSlice";
import type IFileSystem from "../../types/IFileSystem";
import ConcurrencyLimit from "../../utils/ConcurrencyLimit";
import invariant from "../../utils/invariant";

type TPreprocessLimit = ReturnType<typeof ConcurrencyLimit.create>;

/** What settling a run's headers needs from the run. */
interface IHeaderSourceSettings {
  readonly fs: IFileSystem;
  readonly preprocessor: Preprocessor;
  /** `config.preprocess`: false reads every header as written */
  readonly preprocess: boolean;
  readonly defines: Readonly<Record<string, string | boolean>>;
}

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
   * A header that cannot be preprocessed even so is read as written, but
   * judged on its slice of `unit` preprocessed whole (#985): that slice is
   * the text a C compile meets, and its raw text is not.
   *
   * @returns each header's source, by path, in `headers` order, and the
   *   declarations `unit` recovered -- null unless a header needed them
   */
  static async settle(
    headers: readonly IDiscoveredFile[],
    searchPaths: ReadonlyMap<string, readonly string[]>,
    settings: IHeaderSourceSettings,
    unit: ITranslationUnit,
  ): Promise<{
    readonly sources: ReadonlyMap<string, IHeaderSource>;
    readonly recovered: IRecoveredDeclarations | null;
  }> {
    const limit = ConcurrencyLimit.create(availableParallelism());
    const settled: Promise<IHeaderSource>[] = [];
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
        HeaderSources._settle(file, paths, earlier, [...settled], {
          ...settings,
          limit,
        }),
      );
    }
    const alone = await Promise.all(settled);
    const recovery = alone.some((source) => source.preprocessError !== null)
      ? await ExternalDeclarationOracle.recover(
          unit.directives,
          settings.preprocessor,
          {
            // #1723: the unit holds every file's C includes, so it is searched
            // along every file's search path, not --include alone.
            includePaths: [...unit.includePaths],
            defines: { ...settings.defines },
          },
        )
      : null;
    // The preprocessor names a header by the path it found it along; the
    // walk, by the one it resolved. Both name the same file.
    const slices = new Map<string, string>();
    for (const [path, text] of recovery?.perFileContent ?? []) {
      slices.set(resolve(path), text);
    }
    const sources = new Map(
      headers.map((file, i): [string, IHeaderSource] => {
        const source = alone[i];
        const slice = slices.get(resolve(file.path));
        return source.preprocessError === null || slice === undefined
          ? [file.path, source]
          : [
              file.path,
              Object.freeze({
                ...source,
                language: HeaderSources._languageOf(file.type, slice),
              }),
            ];
      }),
    );
    return {
      sources,
      recovered:
        recovery === null
          ? null
          : HeaderSources._recovered(headers, sources, recovery),
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

  private static async _settle(
    file: IDiscoveredFile,
    searchPaths: readonly string[],
    earlierFiles: readonly IDiscoveredFile[],
    earlier: readonly Promise<IHeaderSource>[],
    settings: IHeaderSourceSettings & { readonly limit: TPreprocessLimit },
  ): Promise<IHeaderSource> {
    const { text, preprocessError } = await HeaderSources._textOf(
      file,
      searchPaths,
      earlierFiles,
      earlier,
      settings,
    );
    return Object.freeze({
      text,
      language: HeaderSources._languageOf(file.type, text),
      preprocessError,
    });
  }

  /**
   * The text a C compile meets. Issue #945: only a header whose `#if`s need
   * an expression evaluated is preprocessed, to avoid the side effects of
   * full expansion; the parser handles `#ifdef` and friends itself.
   */
  private static async _textOf(
    file: IDiscoveredFile,
    searchPaths: readonly string[],
    earlierFiles: readonly IDiscoveredFile[],
    earlier: readonly Promise<IHeaderSource>[],
    settings: IHeaderSourceSettings & { readonly limit: TPreprocessLimit },
  ): Promise<{ text: string; preprocessError: string | null }> {
    const raw = settings.fs.readFile(file.path);
    if (
      !settings.preprocess ||
      !settings.preprocessor.isAvailable() ||
      !HeaderSources._needsConditionalPreprocessing(raw)
    ) {
      return { text: raw, preprocessError: null };
    }

    // #1723: along the path this header was found on, so a header that
    // includes a sibling library's header preprocesses as it resolved.
    const options = {
      defines: { ...settings.defines },
      includePaths: [...searchPaths],
      keepLineDirectives: false, // No line mappings are needed for symbols
    };
    const result = await settings.limit(() =>
      settings.preprocessor.preprocess(file.path, options),
    );
    if (result.success) {
      return { text: result.content, preprocessError: null };
    }

    // Some headers cannot be preprocessed standalone: they require a
    // predecessor to have run first (e.g. FreeRTOS task.h needs FreeRTOS.h to
    // define INC_FREERTOS_H and its attribute macros, and enforces this with
    // its own #error). Retry importing the macros of the headers before this
    // one (only those that themselves preprocessed cleanly, so one
    // unpreprocessable predecessor can't defeat the retry). #1817: the only
    // step that waits on other headers.
    const sources = await Promise.all(earlier);
    const imacros = earlierFiles
      .filter((_, i) => sources[i].preprocessError === null)
      .map((header) => header.path);
    if (imacros.length > 0) {
      const retry = await settings.limit(() =>
        settings.preprocessor.preprocess(file.path, { ...options, imacros }),
      );
      if (retry.success) {
        return { text: retry.content, preprocessError: null };
      }
    }
    // Fall back to the raw text. The warning is Stage 2's, written in header
    // order.
    return { text: raw, preprocessError: result.error ?? "unknown error" };
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
