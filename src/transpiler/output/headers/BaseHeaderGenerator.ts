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
// Unified parameter generation (Phase 1)
import ParameterInputAdapter from "../codegen/helpers/ParameterInputAdapter";
import ParameterSignatureBuilder from "../codegen/helpers/ParameterSignatureBuilder";

const { mapType } = typeUtils;

/** Pass-by-value parameter info from CodeGenerator */
type TPassByValueParams = ReadonlyMap<string, ReadonlySet<string>>;

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
    const guard = HeaderGeneratorUtils.makeGuard(filename, options.guardPrefix);

    // Filter to exported symbols if requested
    const exportedSymbols = options.exportedOnly
      ? symbols.filter((s) => s.isExported)
      : symbols;

    // Group symbols by kind
    const groups = HeaderGeneratorUtils.groupSymbolsByKind(exportedSymbols);

    // Get local type names for external type detection
    const localTypes = HeaderGeneratorUtils.getLocalTypeNames(groups);

    // Collect external type dependencies
    const externalTypes = HeaderGeneratorUtils.collectExternalTypes(
      groups.functions,
      groups.variables,
      localTypes.localStructNames,
      localTypes.localEnumNames,
      localTypes.localTypeNames,
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
    const cCompatibleExternalTypes =
      HeaderGeneratorUtils.filterCCompatibleTypes(
        externalTypes,
        typesWithHeaders,
        symbolTable,
      );

    // Filter to C-compatible variables
    const cCompatibleVariables =
      HeaderGeneratorUtils.filterCCompatibleVariables(
        groups.variables,
        symbolTable,
      );

    // Build header sections using utility methods
    const lines: string[] = [
      ...HeaderGeneratorUtils.generateHeaderStart(guard, sourcePath),
      ...HeaderGeneratorUtils.generateIncludes(options, headersToInclude),
      ...HeaderGeneratorUtils.generateCppWrapperStart(),
      ...HeaderGeneratorUtils.generateForwardDeclarations(
        cCompatibleExternalTypes,
      ),
      ...HeaderGeneratorUtils.generateEnumSection(groups.enums, typeInput),
      ...HeaderGeneratorUtils.generateBitmapSection(groups.bitmaps, typeInput),
      ...HeaderGeneratorUtils.generateTypeAliasSection(groups.types),
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
  ): string[] {
    if (functions.length === 0) {
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
    lines.push("");
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
