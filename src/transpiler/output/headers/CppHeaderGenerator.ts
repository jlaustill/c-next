/**
 * C++ Header Generator
 *
 * Generates C++ header (.h) files from C-Next source with C++ semantics
 * (reference-based pass-by-reference).
 */

import ISymbol from "../../../utils/types/ISymbol";
import IParameterSymbol from "../../../utils/types/IParameterSymbol";
import IHeaderOptions from "../codegen/types/IHeaderOptions";
import IHeaderTypeInput from "./generators/IHeaderTypeInput";
import typeUtils from "./generators/mapType";
import HeaderGeneratorUtils from "./HeaderGeneratorUtils";

const { mapType } = typeUtils;

/** Pass-by-value parameter info from CodeGenerator */
type TPassByValueParams = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * Generates C++ header files with reference-based semantics
 */
class CppHeaderGenerator {
  /**
   * Generate a C++ header file from symbols
   */
  generate(
    symbols: ISymbol[],
    filename: string,
    options: IHeaderOptions = {},
    typeInput?: IHeaderTypeInput,
    passByValueParams?: TPassByValueParams,
    allKnownEnums?: ReadonlySet<string>,
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
      ...HeaderGeneratorUtils.generateHeaderStart(guard),
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
    functions: ISymbol[],
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
   * Generate a C++ function prototype with reference-based pass-by-reference
   */
  private generateFunctionPrototype(
    sym: ISymbol,
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
   * Generate a single C++ parameter with reference semantics
   */
  private generateParameter(
    p: IParameterSymbol,
    passByValueSet?: ReadonlySet<string>,
    allKnownEnums?: ReadonlySet<string>,
  ): string {
    const baseType = mapType(p.type);
    const constMod = p.isConst ? "const " : "";
    const autoConst = p.isAutoConst ? "const " : "";

    // Array parameters - pass naturally as pointers per C semantics
    if (p.isArray && p.arrayDimensions) {
      const dims = p.arrayDimensions.map((d) => `[${d}]`).join("");
      if (p.type === "string") {
        return `${autoConst}${constMod}char* ${p.name}${dims}`;
      }
      return `${autoConst}${constMod}${baseType} ${p.name}${dims}`;
    }

    // ISR is a function pointer typedef - no pointer needed
    if (p.type === "ISR") {
      return `${constMod}${baseType} ${p.name}`;
    }

    // Float types use standard pass-by-value
    if (p.type === "f32" || p.type === "f64") {
      return `${constMod}${baseType} ${p.name}`;
    }

    // Enum types use pass-by-value (like primitives)
    if (allKnownEnums?.has(p.type)) {
      return `${constMod}${baseType} ${p.name}`;
    }

    // Check if parameter should be passed by value
    if (passByValueSet?.has(p.name)) {
      return `${constMod}${baseType} ${p.name}`;
    }

    // Default: pass by reference (C++ semantics)
    return `${autoConst}${constMod}${baseType}& ${p.name}`;
  }
}

export default CppHeaderGenerator;
