import { basename, relative, sep } from "node:path";

import type IFileIncludes from "../../../PARSE/1-Discover/types/IFileIncludes";
import type IHeaderCallbackType from "../../../types/IHeaderCallbackType";
import type TSymbol from "../../../types/symbols/TSymbol";
import AutoConstRule from "../../../utils/AutoConstRule";
import invariant from "../../../utils/invariant";
import HeaderIncludes from "../../2-Plan/HeaderIncludes";
import HeaderUserIncludes from "../../2-Plan/HeaderUserIncludes";
import PublicInterface from "../../2-Plan/PublicInterface";
import type TranspileState from "../../TranspileState";
import TypedefParamParser from "../codegen/helpers/TypedefParamParser";
import HeaderSymbolAdapter from "./adapters/HeaderSymbolAdapter";
import ExternalTypeHeaderBuilder from "./ExternalTypeHeaderBuilder";
import IncludeGuards from "./IncludeGuards";
import type IHeaderEmissionFacts from "./types/IHeaderEmissionFacts";
import type IHeaderEmissionRequest from "./types/IHeaderEmissionRequest";
import type IHeaderSymbol from "./types/IHeaderSymbol";

/**
 * One file's `IHeaderEmissionFacts`, captured while that file's
 * `TranspileState` is warm (#1323). `HeaderRenderer` renders them later, after
 * every file has moved on, and never reads the state.
 *
 * Moved out of the orchestrator by #1443. It is in 2.3 rather than 2.2 for the
 * reason `CodeGenWalker` is above both: the capture reads the header adapter
 * and the callback-typedef parser, which are 2.3's, and 2.2 may not import
 * 2.3 (`plan-cannot-import-render`). The decisions it records are still 2.2's
 * -- `PublicInterface`, `HeaderIncludes`, `HeaderTypeNames` -- read, not made.
 */
class HeaderEmissionCapture {
  /**
   * Stage 5: Resolve one file's header-render input from its exported symbols.
   * ADR-055 Phase 7: Uses TSymbol directly, converts to IHeaderSymbol for generation.
   *
   * #1323: this decides a header's content -- it no longer renders it. It
   * returns the resolved `IHeaderEmissionFacts` `HeaderRenderer` will
   * later pass to `HeaderGenerator.generate()`, instead of calling that
   * itself. That split is what makes issue #1139 structurally impossible
   * rather than merely fixed: #1139 happened because a SECOND, LATER call
   * re-read live `CodeGenState` after it had moved on to a different file.
   * There is now only one caller, and nothing downstream of this method's
   * return value ever reads `CodeGenState` again -- see `IHeaderEmissionFacts`.
   *
   * Still call this exactly once per file, from the host's `_transpileFile()`, while
   * that file's state is warm: `TranspileState.needsISR`,
   * `generatedStructInits`, `callbackTypes` and the auto-const/opaque
   * resolution inside `convertToHeaderSymbols` are ALL per-file, cleared by
   * `TranspileState.reset()` before the next file transpiles. Capturing them
   * into `IHeaderEmissionFacts` here, at the only moment they are correct for
   * THIS file, is what lets the render move later.
   *
   * `allKnownEnums` and `externalTypeHeaders` no longer depend on file order.
   * This paragraph used to say they did, citing `state.getAllSymbolInfo()` and
   * `state.getAllHeaderDirectives()` -- neither exists. Both now read complete
   * artifacts: `Program.knownEnums()` is settled before any file renders
   * (#1447), and every file's include directives are recorded when discovery
   * ends, before Stage 2 (#1435).
   */
  static capture(request: IHeaderEmissionRequest): IHeaderEmissionFacts | null {
    const sourcePath = request.sourcePath;
    const program = request.program;
    const state = request.state;
    // Issues #1161/#1164: the same predicate decides whether this header is
    // written and whether the generated .c includes it. Do not re-derive it.
    const exportedSymbols = PublicInterface.forFile(
      state.symbolTable,
      sourcePath,
    );

    if (exportedSymbols.length === 0) {
      return null;
    }

    // Issue #933: Use .hpp extension for include guard in C++ mode
    // Issue #1319: read the run's extension; do not re-derive it from the mode
    const ext = request.headerExtension;
    const headerName = IncludeGuards.identity(
      request.anchor,
      sourcePath,
    ).replace(/\.cnx$|\.cnext$/, ext);

    // #1671: both decided by 1.4 Resolve, the first layer that can see every
    // file. `typeInput` is the view `generate()` received, so the `.h` and the
    // `.c` are built from one object; neither is copied onto this class.
    const passByValueParams = program.passByValueParams();
    const includes = HeaderEmissionCapture.includesOf(request);
    // Issue #424: a dimension that is not a number is a macro the header names
    // but does not define, so the header must carry its source include.
    const cHeadersIncluded = HeaderUserIncludes.needed(
      exportedSymbols,
      state.symbolTable,
      state.program,
    );
    const userIncludes = cHeadersIncluded
      ? [...includes.userIncludes, ...includes.cHeaderIncludes]
      : [...includes.userIncludes];

    // #1447: read from the artifact, not accumulated from the files transpiled
    // so far. The old form was correct only because `_sortFilesByDependency`
    // put every dependency first, and a dependency cycle (#1167) made the order
    // -- and so the answer -- arbitrary. `Program` is complete before any file
    // is rendered, so this cannot depend on where in the run it is asked.
    const allKnownEnums = program.knownEnums();

    // #1511: which types a header declares comes from the artifact. The
    // include ORDER stays here -- it decides which header wins, and that is not
    // a symbol fact.
    const externalTypeHeaders = ExternalTypeHeaderBuilder.build(
      HeaderEmissionCapture.includeDirectivesSpelledBy(request),
      {
        typesDeclaredIn: (file: string) => program.typesDeclaredIn(file),
      },
    );

    // ADR-029: Convert callback types to header format
    const callbackTypesForHeader =
      HeaderEmissionCapture.buildCallbackTypes(state);

    const typeInputWithSymbolTable = {
      ...request.typeInput,
      symbolTable: state.symbolTable,
      callbackTypes: callbackTypesForHeader,
    };

    const unmodifiedParams = request.unmodifiedParams;
    const headerSymbols = HeaderEmissionCapture.convertToHeaderSymbols(
      state,
      exportedSymbols,
      unmodifiedParams,
      allKnownEnums,
    );

    return {
      symbols: headerSymbols,
      filename: headerName,
      options: {
        userIncludes,
        cHeadersIncluded,
        // ADR-040: same flag the .c consults, so exactly one file emits it.
        needsIsrTypedef: state.needsISR,
        // #1205: same shape -- the .c records which init functions it
        // emitted, the header declares exactly those. Copied, not aliased:
        // this record must stay frozen once captured, and TranspileState.reset()
        // happens to rebind this field to a new Set rather than clearing it in
        // place (TranspileState.ts) -- true today, but not a contract anything
        // enforces, so a live reference here would be correct only by
        // coincidence with reset()'s current implementation.
        generatedStructInits: new Set(state.generatedStructInits),
        // #1453: same contract, same reason -- copied at capture, never read
        // live by the render.
        registerBlocks: [...state.exportedRegisterBlocks],
        externalTypeHeaders,
        cppMode: request.cppMode,
        // #1517: 2.2 Plan decides; the header generator prints. Possible only
        // since #1520 made `headerCType` the one answer to "what does this
        // header call this type" -- before that, deciding from the symbols
        // meant deriving the type mapping a second time.
        systemIncludes: HeaderIncludes.decide(
          exportedSymbols,
          state.symbolTable,
        ),
      },
      typeInput: typeInputWithSymbolTable,
      passByValueParams,
      allKnownEnums,
      basename: basename(sourcePath),
    };
  }

  /**
   * ADR-029: Build callback types for header generation.
   * Only includes callbacks that are actually used as struct field types.
   * Converts TranspileState.callbackTypes to the format expected by IHeaderTypeInput.
   */
  private static buildCallbackTypes(
    state: TranspileState,
  ): ReadonlyMap<string, IHeaderCallbackType> {
    const result = new Map<string, IHeaderCallbackType>();

    // Issue #1164: same predicate the .c uses to decide it must NOT emit these.
    const usedCallbackTypes = new Set<string>();
    for (const funcName of state.callbackTypes.keys()) {
      if (state.headerOwnsCallbackTypedef(funcName)) {
        usedCallbackTypes.add(funcName);
      }
    }

    for (const funcName of usedCallbackTypes) {
      const cbInfo = state.callbackTypes.get(funcName);
      if (cbInfo) {
        result.set(funcName, {
          typedefName: cbInfo.typedefName,
          returnType: cbInfo.returnType,
          // #1164/#1552: pass the parameter through WHOLE. This used to say so
          // while enumerating six of the seven fields below it, and the one it
          // left out was `isString` -- so the formatter's `string<N>` branch
          // never fired and the header's typedef disagreed with its own
          // prototype in a single file. Naming no fields is what makes the
          // comment true; `IHeaderCallbackType` now names the formatter's own
          // parameter type, so a new field cannot go missing here again.
          parameters: cbInfo.parameters,
        });
      }
    }

    return result;
  }

  /**
   * Convert TSymbols to IHeaderSymbols with auto-const information applied.
   * ADR-055 Phase 7: Replaces mutation-based auto-const updating.
   */
  private static convertToHeaderSymbols(
    state: TranspileState,
    symbols: TSymbol[],
    unmodifiedParams: ReadonlyMap<string, ReadonlySet<string>>,
    knownEnums: ReadonlySet<string>,
  ): IHeaderSymbol[] {
    return symbols.map((symbol) => {
      const headerSymbol = HeaderSymbolAdapter.fromTSymbol(symbol, state);

      if (
        symbol.kind !== "function" ||
        !headerSymbol.parameters ||
        headerSymbol.parameters.length === 0
      ) {
        return headerSymbol;
      }

      // Issue #914: Resolve callback typedef type for callback-compatible functions.
      // #1545 review: through the one accessor, so this site and the body's
      // cannot spell the predicate differently -- they used to differ on `""`,
      // truthiness here against `!== undefined` there.
      const callbackTypedefType = state.callbackTypedefTypeFor(
        headerSymbol.name,
      );

      // Issue #914: For callback-compatible functions, bake pointer/const overrides
      // onto each parameter. Skip auto-const (matches CodeGenerator path).
      // Note: isOpaqueHandle is not set here because callback params get their
      // pointer/const semantics from the typedef signature via isCallbackPointer/
      // isCallbackConst, which take precedence over opaque handling in the builder.
      if (callbackTypedefType) {
        const updatedParams = TypedefParamParser.resolveCallbackParams(
          headerSymbol.parameters,
          callbackTypedefType,
        );
        return { ...headerSymbol, parameters: updatedParams };
      }

      // Apply auto-const and resolve opaque type info for non-callback function parameters
      const unmodified = unmodifiedParams.get(headerSymbol.name);
      const updatedParams = headerSymbol.parameters.map((param) => {
        // ADR-029 / #1164: a parameter whose declared type IS a callback
        // function takes that function's typedef, exactly as the .c does via
        // TranspileState.callbackTypes. Without this the header emitted the bare
        // function name as a type ("const onReceive*"), which both contradicts
        // the .c's "onReceive_fp" and collides with the function's own
        // prototype ("redeclared as different kind of symbol").
        const callbackType = state.callbackTypes.get(param.type ?? "");
        if (callbackType) {
          return {
            ...param,
            type: callbackType.typedefName,
            isCallback: true,
            callbackTypedefName: callbackType.typedefName,
            isStruct: false,
          };
        }

        // Issue #995 / ADR-030: whether this parameter is an opaque handle is
        // the decision `HeaderSymbolAdapter` already read onto it -- the one
        // the `.c`'s prototype is spelled from (`isHeldThroughPointer`). This
        // recomputed it from `isOpaqueType` and wrote it back, a second writer
        // of one flag that agreed only while the two predicates did.
        const isOpaque = param.isOpaqueHandle === true;

        // #1545: the same rule the body paths use, so the .h cannot disagree
        // with the .c (ADR-013, "Header Generation Sync"). The exclusions this
        // site used to spell out inline are now ADR-013's list inside the rule.
        // Note: isAutoConst may be set here, but ParameterSignatureBuilder will
        // suppress it for opaque handles (Issue #995) — single source of truth.
        //
        // isCallbackCompatible is false here because the early return above
        // took every callback whose typedef type resolves, and the body asks
        // the same question at the same granularity since #1545 -- the whole
        // function, not the parameter. #1603 records the remaining case: a
        // callback-compatible function whose typedef type does NOT resolve
        // reaches this line, and both paths then let auto-const apply, which is
        // why nothing reddens for it.
        const shouldAutoConst = AutoConstRule.applies({
          baseType: param.type ?? "",
          isModified: unmodified?.has(param.name) !== true,
          isExplicitlyConst: param.isConst,
          isCallbackCompatible: false,
          isArray: param.isArray,
          // #1545 review: this is the WHOLE-PROGRAM enum view (`allKnownEnums`
          // = program.knownEnums()), while the body supplies the PER-FILE one
          // (TranspileState.isKnownEnum). CLAUDE.md names that pair as #1312 --
          // a sibling never included is absent from one and present in the
          // other. Deliberate on both sides: each matches the enum view ITS
          // OWN pass-by-value decision reads, so neither introduces a new
          // disagreement inside its own file. They are unobservable against
          // each other today because enums route to _buildPassByValueParam,
          // which ignores isAutoConst -- masking, not unification, so this is
          // recorded rather than treated as settled.
          isKnownEnum: knownEnums.has(param.type ?? ""),
          // #995: computed fifteen lines up for the branch below. Supplying it
          // here is behavior-preserving -- ParameterSignatureBuilder already
          // zeroed isAutoConst for an opaque handle -- and moves the seventh
          // ADR-013 exclusion into the rule that claims to hold them all.
          isOpaqueHandle: isOpaque,
        });

        // Return updated param with resolved flags
        if (shouldAutoConst || isOpaque) {
          return { ...param, isAutoConst: shouldAutoConst || undefined };
        }
        return param;
      });

      return { ...headerSymbol, parameters: updatedParams };
    });
  }

  /**
   * The include directive for every header the run reached, spelled as
   * `request.sourcePath` would spell it, for that file's generated header.
   *
   * #1435: a header the file includes itself takes the file's own spelling.
   * #1725: a header it reaches only through another file takes that file's
   * spelling when it is valid from anywhere -- an angle include, a spelling
   * found along the search path, an output-root path -- and is re-spelled
   * relative to `request.sourcePath` when it was relative to the file that wrote it.
   * Copied, `"dev.h"` from lib/a.cnx named `src/dev.h` in src/main.h.
   *
   * The ORDER is the run's first-seen order, unchanged, because
   * `ExternalTypeHeaderBuilder` lets the first header declaring a type win,
   * and `Map.set` on a key already present keeps its position.
   */
  private static includeDirectivesSpelledBy(
    request: IHeaderEmissionRequest,
  ): ReadonlyMap<string, string> {
    const own = HeaderEmissionCapture.includesOf(request);
    const here = own.quotedIncludeDirectory;
    const directives = new Map<string, string>();
    for (const file of request.includes.values()) {
      for (const [header, directive] of file.headerIncludeDirectives) {
        const named = file.writerRelativeIncludes.get(header);
        directives.set(
          header,
          named === undefined
            ? directive
            : `#include "${relative(here, named).split(sep).join("/")}"`,
        );
      }
    }
    for (const [header, directive] of own.headerIncludeDirectives) {
      directives.set(header, directive);
    }
    return directives;
  }

  /** What 1.1 Discover learned about the file's includes (#1444). */
  private static includesOf(request: IHeaderEmissionRequest): IFileIncludes {
    const includes = request.includes.get(request.sourcePath);
    invariant(
      includes !== undefined,
      `1.1 Discover records the includes of every file it discovers (missing ${request.sourcePath})`,
    );
    return includes;
  }
}

export default HeaderEmissionCapture;
