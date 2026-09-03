/**
 * Base Header Generator
 *
 * Abstract base class for C and C++ header generators.
 * Uses Template Method pattern - subclasses implement getRefSuffix() to
 * determine pointer (*) vs reference (&) semantics.
 */

import IHeaderSymbol from "./types/IHeaderSymbol";
import IParameterSymbol from "../../../utils/types/IParameterSymbol";
import IHeaderOptions from "../codegen/types/IHeaderOptions";
import IHeaderTypeInput from "./generators/IHeaderTypeInput";
import typeUtils from "./generators/mapType";
import HeaderGeneratorUtils from "./HeaderGeneratorUtils";
import SymbolTable from "../../logic/symbols/SymbolTable";
// Unified parameter generation (Phase 1)
import ParameterInputAdapter from "../codegen/helpers/ParameterInputAdapter";
import ParameterSignatureBuilder from "../codegen/helpers/ParameterSignatureBuilder";
import StructInitFunction from "../codegen/helpers/StructInitFunction";
import TPassByValueParams from "../../types/TPassByValueParams";

const { mapType } = typeUtils;

/**
 * Abstract base class for header file generation
 *
 * Generates header files (.h) from C-Next symbols. Subclasses implement
 * getRefSuffix() to control pass-by-reference semantics:
 * - CHeaderGenerator returns "*" for pointer-based C semantics
 * - CppHeaderGenerator returns "&" for reference-based C++ semantics
 */
abstract class BaseHeaderGenerator {
  /**
   * Reject an external type this header cannot correctly declare.
   *
   * Issue #1225/#1238: `typedef struct X X;` is a guess that only holds when X
   * really is an opaque struct. For a pointer typedef it declares a different
   * type -- and an object of it cannot be declared at all, so a header carrying
   * `extern handle_t h;` against it is not valid C or C++.
   *
   * The previous code filtered pointer typedefs out of the list silently, which
   * swapped a contradictory declaration for a missing one. Neither is a safe
   * degradation, so report it: reaching here means the type's defining header
   * was not propagated into this header, and that is a transpiler defect the
   * generated code should not paper over.
   *
   * Returns void rather than a filtered list on purpose -- an earlier version
   * looked like a filter and was not one, which invites the next reader to
   * preserve filtering that never existed.
   *
   * Normally unreachable: `Transpiler._needsDefiningHeader` sets
   * `cHeadersIncluded` for exactly these types, and the caller only invokes
   * this when it is false.
   */
  private static assertNoPointerTypedefs(
    externalTypes: string[],
    symbolTable: SymbolTable | undefined,
    headerName: string,
    symbols: IHeaderSymbol[],
  ): void {
    const pointerTypedef = externalTypes.find((typeName) =>
      symbolTable?.isPointerTypedef(typeName),
    );

    if (pointerTypedef === undefined) {
      return;
    }

    // The declaration that pulled the type in. This fires on a file the user
    // did not write, so naming the C-Next declaration is the difference
    // between an actionable error and a puzzle.
    const origin = BaseHeaderGenerator.findDeclaringSymbol(
      symbols,
      pointerTypedef,
    );
    const declaredBy =
      origin === undefined ? "" : ` It is named by '${origin.name}'.`;
    const location =
      origin?.sourceLine === undefined ? "" : ` Line ${origin.sourceLine}`;

    throw new Error(
      `E0505: '${pointerTypedef}' is a typedef of a pointer declared in another ` +
        `header, and generated header '${headerName}' does not include that ` +
        `header.${declaredBy} A forward declaration cannot express a pointer ` +
        `typedef -- 'typedef struct ${pointerTypedef} ${pointerTypedef};' would ` +
        `declare a different, incomplete type. The header that defines it must ` +
        `be included.${location}`,
    );
  }

  /** The exported symbol whose type pulled `typeName` into this header. */
  private static findDeclaringSymbol(
    symbols: IHeaderSymbol[],
    typeName: string,
  ): IHeaderSymbol | undefined {
    return symbols.find(
      (symbol) =>
        HeaderGeneratorUtils.extractBaseType(symbol.type ?? "") === typeName ||
        (symbol.parameters ?? []).some(
          (parameter) =>
            HeaderGeneratorUtils.extractBaseType(parameter.type) === typeName,
        ),
    );
  }

  /**
   * Get the suffix for pass-by-reference parameters
   * @returns "*" for C pointer semantics, "&" for C++ reference semantics
   */
  protected abstract getRefSuffix(): string;

  /**
   * Generate a header file from symbols
   *
   * @param symbols - Array of symbols to include in header
   * @param filename - Output filename (used for include guard)
   * @param options - Header generation options (includes cppMode)
   * @param typeInput - Optional type information for full definitions
   * @param passByValueParams - Map of function names to pass-by-value parameter names
   * @param allKnownEnums - All known enum names from entire compilation
   * @param sourcePath - Optional source file path for header comment
   */
  generate(
    symbols: IHeaderSymbol[],
    filename: string,
    options: IHeaderOptions = {},
    typeInput?: IHeaderTypeInput,
    passByValueParams?: TPassByValueParams,
    allKnownEnums?: ReadonlySet<string>,
    sourcePath?: string,
  ): string {
    const guard = HeaderGeneratorUtils.makeGuard(filename);

    // #1300: NO filter here. `PublicInterface` already decided which symbols
    // form this file's header, including the private types a public signature
    // makes reachable -- a second predicate over the same set could only
    // disagree with the first, and did: it dropped every closure type, because
    // it re-read the declared visibility instead of carrying the decision.
    const groups = HeaderGeneratorUtils.groupSymbolsByKind(symbols);

    // Get local type names for external type detection
    const localTypes = HeaderGeneratorUtils.getLocalTypeNames(groups);

    // Collect external type dependencies
    // #1164: typedefs this header emits itself are local. Without this the
    // header forward-declares its own callback typedef as an unknown struct.
    const localTypeNamesWithCallbacks = new Set(localTypes.localTypeNames);
    for (const [, cbInfo] of typeInput?.callbackTypes ?? []) {
      localTypeNamesWithCallbacks.add(cbInfo.typedefName);
    }

    const externalTypes = HeaderGeneratorUtils.collectExternalTypes(
      groups.functions,
      groups.variables,
      localTypes.localStructNames,
      localTypes.localEnumNames,
      localTypeNamesWithCallbacks,
      localTypes.localBitmapNames,
      allKnownEnums,
    );

    // Build external type header includes
    const { typesWithHeaders, headersToInclude } =
      HeaderGeneratorUtils.buildExternalTypeIncludes(
        externalTypes,
        options.externalTypeHeaders,
      );

    // Get symbol table for C++ namespace detection
    const symbolTable = typeInput?.symbolTable;

    // Filter to C-compatible external types
    //
    // Issue #1200: a callback type (ADR-029) is not an external struct. It is
    // emitted as a function-pointer typedef by generateCallbackTypedefSection
    // below, so forward-declaring it as `typedef struct X X;` here produces two
    // conflicting declarations of the same name -- and the name also belongs to
    // the function the type was defined from.
    const cCompatibleExternalTypes =
      HeaderGeneratorUtils.filterCCompatibleTypes(
        externalTypes,
        typesWithHeaders,
        symbolTable,
      ).filter((typeName) => !typeInput?.callbackTypes?.has(typeName));

    // Filter to C-compatible variables
    const cCompatibleVariables =
      HeaderGeneratorUtils.filterCCompatibleVariables(
        groups.variables,
        symbolTable,
      );

    if (!options.cHeadersIncluded) {
      BaseHeaderGenerator.assertNoPointerTypedefs(
        cCompatibleExternalTypes,
        symbolTable,
        filename,
        symbols,
      );
    }

    // Build header sections using utility methods
    const lines: string[] = [
      ...HeaderGeneratorUtils.generateHeaderStart(guard, sourcePath),
      ...HeaderGeneratorUtils.generateIncludes(options, headersToInclude),
      ...HeaderGeneratorUtils.generateCppWrapperStart(),
      ...HeaderGeneratorUtils.generateForwardDeclarations(
        // #1164: `typedef struct opaque_t* handle_t` is a different type from
        // `struct handle_t`, so the usual forward declaration contradicts the
        // real definition. Its defining header is included instead, which is
        // what cHeadersIncluded means; assertNoPointerTypedefs above has
        // already rejected the case where it was not.
        options.cHeadersIncluded ? [] : cCompatibleExternalTypes,
      ),
      ...HeaderGeneratorUtils.generateIsrTypedefSection(
        options.needsIsrTypedef ?? false,
      ),
      ...HeaderGeneratorUtils.generateEnumSection(groups.enums, typeInput),
      ...HeaderGeneratorUtils.generateBitmapSection(groups.bitmaps, typeInput),
      ...HeaderGeneratorUtils.generateTypeAliasSection(groups.types),
      ...HeaderGeneratorUtils.generateCallbackStructForwardDecls(
        groups.structs,
        typeInput,
      ),
      ...HeaderGeneratorUtils.generateCallbackTypedefSection(
        typeInput,
        options.cppMode,
      ),
      ...HeaderGeneratorUtils.generateStructSection(
        groups.structs,
        groups.classes,
        typeInput,
      ),
      ...HeaderGeneratorUtils.generateVariableSection(cCompatibleVariables),
      ...this.generateFunctionSection(
        groups.functions,
        passByValueParams,
        allKnownEnums,
        options.generatedStructInits,
      ),
      ...HeaderGeneratorUtils.generateHeaderEnd(guard),
    ];

    return lines.join("\n");
  }

  /**
   * Generate function prototypes section
   */
  private generateFunctionSection(
    functions: IHeaderSymbol[],
    passByValueParams?: TPassByValueParams,
    allKnownEnums?: ReadonlySet<string>,
    generatedStructInits?: ReadonlySet<string>,
  ): string[] {
    // #1205: the ADR-029 init functions are declarations too, so the section
    // exists when there is either kind. Keying the early return on `functions`
    // alone would drop the init prototypes for a file whose only external
    // definitions are generated ones.
    const initPrototypes = StructInitFunction.prototypeLines([
      ...(generatedStructInits ?? []),
    ]);
    if (functions.length === 0 && initPrototypes.length === 0) {
      return [];
    }

    const lines: string[] = ["/* Function prototypes */"];
    for (const sym of functions) {
      const proto = this.generateFunctionPrototype(
        sym,
        passByValueParams,
        allKnownEnums,
      );
      if (proto) {
        lines.push(proto);
      }
    }
    lines.push(...initPrototypes, "");
    return lines;
  }

  /**
   * Generate a function prototype
   */
  private generateFunctionPrototype(
    sym: IHeaderSymbol,
    passByValueParams?: TPassByValueParams,
    allKnownEnums?: ReadonlySet<string>,
  ): string | null {
    // Map return type (main() always returns int)
    const mappedType = sym.type ? mapType(sym.type) : "void";
    const returnType = sym.name === "main" ? "int" : mappedType;

    // Get pass-by-value parameter names for this function
    const passByValueSet = passByValueParams?.get(sym.name);

    // Build parameter list
    let params = "void";

    if (sym.parameters && sym.parameters.length > 0) {
      const translatedParams = sym.parameters.map((p) =>
        this.generateParameter(p, passByValueSet, allKnownEnums),
      );
      params = translatedParams.join(", ");
    }

    return `${returnType} ${sym.name}(${params});`;
  }

  /**
   * Generate a single parameter with appropriate semantics
   */
  private generateParameter(
    p: IParameterSymbol,
    passByValueSet?: ReadonlySet<string>,
    allKnownEnums?: ReadonlySet<string>,
  ): string {
    // Pre-compute pass-by-value (ISR, float, enum, or explicitly marked)
    const isPassByValue =
      p.type === "ISR" ||
      p.type === "f32" ||
      p.type === "f64" ||
      allKnownEnums?.has(p.type) ||
      passByValueSet?.has(p.name) ||
      false;

    // Build normalized input using adapter
    const input = ParameterInputAdapter.fromSymbol(p, {
      mapType: (t) => mapType(t),
      isPassByValue,
    });

    // Use shared builder with subclass-specific ref suffix
    return ParameterSignatureBuilder.build(input, this.getRefSuffix());
  }
}

export default BaseHeaderGenerator;
