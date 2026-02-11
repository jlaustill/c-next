/**
 * Header Generator Utilities
 *
 * Pure utility functions for header generation, shared by both
 * CHeaderGenerator and CppHeaderGenerator.
 */

import ISymbol from "../../../utils/types/ISymbol";
import ESymbolKind from "../../../utils/types/ESymbolKind";
import SymbolTable from "../../logic/symbols/SymbolTable";
import CppNamespaceUtils from "../../../utils/CppNamespaceUtils";
import typeUtils from "./generators/mapType";
import IGroupedSymbols from "./types/IGroupedSymbols";
import IHeaderOptions from "../codegen/types/IHeaderOptions";
import IHeaderTypeInput from "./generators/IHeaderTypeInput";
import generateEnumHeader from "./generators/generateEnumHeader";
import generateStructHeader from "./generators/generateStructHeader";
import generateBitmapHeader from "./generators/generateBitmapHeader";
import VariableDeclarationFormatter from "../codegen/helpers/VariableDeclarationFormatter";
import type IVariableFormatInput from "../codegen/types/IVariableFormatInput";

const { mapType, isBuiltInType } = typeUtils;

/**
 * Static utility class with pure functions for header generation
 */
class HeaderGeneratorUtils {
  /**
   * Create an include guard macro from filename
   */
  static makeGuard(filename: string, prefix?: string): string {
    // Remove path and extension
    const base = filename.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "");

    // Convert to uppercase and replace non-alphanumeric with underscore
    const sanitized = base.toUpperCase().replaceAll(/[^A-Z0-9]/g, "_");

    if (prefix) {
      return `${prefix.toUpperCase()}_${sanitized}_H`;
    }

    return `${sanitized}_H`;
  }

  /**
   * Group symbols by their kind for organized header output
   */
  static groupSymbolsByKind(symbols: ISymbol[]): IGroupedSymbols {
    return {
      structs: symbols.filter((s) => s.kind === ESymbolKind.Struct),
      classes: symbols.filter((s) => s.kind === ESymbolKind.Class),
      functions: symbols.filter((s) => s.kind === ESymbolKind.Function),
      variables: symbols.filter((s) => s.kind === ESymbolKind.Variable),
      enums: symbols.filter((s) => s.kind === ESymbolKind.Enum),
      types: symbols.filter((s) => s.kind === ESymbolKind.Type),
      bitmaps: symbols.filter((s) => s.kind === ESymbolKind.Bitmap),
    };
  }

  /**
   * Extract the base type from a type string, removing pointers, arrays, and const
   */
  static extractBaseType(type: string): string {
    // Remove pointer suffix
    let baseType = type.replace(/\*+$/, "").trim();

    // Remove array brackets
    baseType = baseType.replace(/\[\d*\]$/, "").trim();

    // Handle const prefix
    baseType = baseType.replace(/^const\s+/, "").trim();

    return baseType;
  }

  /**
   * Check if a type is a C++ template type (excluding C-Next string<N>)
   */
  static isCppTemplateType(type: string | undefined): boolean {
    if (!type) return false;
    // C-Next string<N> types are allowed (string followed by <digits>)
    if (/^string<\d+>$/.test(type)) return false;
    // Any other <> is a C++ template
    return type.includes("<") || type.includes(">");
  }

  /**
   * Check if an array dimension is a macro (non-numeric identifier)
   * Numeric dimensions: "4", "16", "256", ""
   * Macro dimensions: "DEVICE_COUNT", "MAX_SIZE", "NUM_LEDS"
   */
  static isMacroDimension(dimension: string): boolean {
    // Empty string is an unbounded array, not a macro
    if (!dimension || dimension.trim() === "") {
      return false;
    }

    // Pure numeric dimensions are not macros
    if (/^\d+$/.test(dimension.trim())) {
      return false;
    }

    // Anything else (identifier, expression) is treated as a macro
    return true;
  }

  /**
   * Collect external type dependencies from function signatures and variables
   * Returns types that are:
   * - Not primitive types (not in TYPE_MAP)
   * - Not locally defined structs, enums, bitmaps, or type aliases
   * - Not cross-file enums (which can't be forward-declared as structs)
   */
  static collectExternalTypes(
    functions: ISymbol[],
    variables: ISymbol[],
    localStructs: Set<string>,
    localEnums: Set<string>,
    localTypes: Set<string>,
    localBitmaps: Set<string>,
    allKnownEnums?: ReadonlySet<string>,
  ): Set<string> {
    const externalTypes = new Set<string>();

    // Combine all local types for efficient lookup
    const localTypeSets = [localStructs, localEnums, localTypes, localBitmaps];

    const isLocalType = (name: string): boolean =>
      localTypeSets.some((set) => set.has(name));

    const isExternalType = (typeName: string): boolean => {
      // Skip empty, pointer markers, built-ins, and namespaced types
      if (!typeName || typeName === "*" || isBuiltInType(typeName)) {
        return false;
      }
      if (typeName.includes("::")) {
        return false;
      }
      // Skip locally defined types and cross-file enums
      if (isLocalType(typeName) || allKnownEnums?.has(typeName)) {
        return false;
      }
      return true;
    };

    const addIfExternal = (type: string | undefined): void => {
      if (!type) return;
      const baseType = HeaderGeneratorUtils.extractBaseType(type);
      if (isExternalType(baseType)) {
        externalTypes.add(baseType);
      }
    };

    // Check function return types and parameters
    for (const fn of functions) {
      addIfExternal(fn.type);
      for (const param of fn.parameters ?? []) {
        addIfExternal(param.type);
      }
    }

    // Check variable types
    for (const v of variables) {
      addIfExternal(v.type);
    }

    return externalTypes;
  }

  /**
   * Filter external types to those that are C-compatible (can be forward-declared)
   * Excludes C++ templates, namespaces, and underscore-format namespace types
   */
  static filterCCompatibleTypes(
    externalTypes: Set<string>,
    typesWithHeaders: Set<string>,
    symbolTable?: SymbolTable,
  ): string[] {
    return [...externalTypes].filter(
      (t) =>
        !typesWithHeaders.has(t) &&
        !t.includes("<") &&
        !t.includes(">") &&
        !t.includes("::") &&
        !t.includes(".") &&
        !CppNamespaceUtils.isCppNamespaceType(t, symbolTable),
    );
  }

  /**
   * Filter variables to those that are C-compatible
   * Excludes C++ namespace types, templates, and underscore-format namespace types
   */
  static filterCCompatibleVariables(
    variables: ISymbol[],
    symbolTable?: SymbolTable,
  ): ISymbol[] {
    return variables.filter(
      (v) =>
        !v.type?.includes("::") &&
        !v.type?.includes(".") &&
        !HeaderGeneratorUtils.isCppTemplateType(v.type) &&
        !CppNamespaceUtils.isCppNamespaceType(v.type ?? "", symbolTable),
    );
  }

  /**
   * Build headers to include from external type header mappings
   */
  static buildExternalTypeIncludes(
    externalTypes: Set<string>,
    externalTypeHeaders?: ReadonlyMap<string, string>,
  ): { typesWithHeaders: Set<string>; headersToInclude: Set<string> } {
    const typesWithHeaders = new Set<string>();
    const headersToInclude = new Set<string>();

    if (externalTypeHeaders) {
      for (const typeName of externalTypes) {
        const directive = externalTypeHeaders.get(typeName);
        if (directive) {
          typesWithHeaders.add(typeName);
          headersToInclude.add(directive);
        }
      }
    }

    return { typesWithHeaders, headersToInclude };
  }

  /**
   * Get local type names from grouped symbols
   */
  static getLocalTypeNames(groups: IGroupedSymbols): {
    localStructNames: Set<string>;
    localEnumNames: Set<string>;
    localTypeNames: Set<string>;
    localBitmapNames: Set<string>;
  } {
    return {
      localStructNames: new Set(groups.structs.map((s) => s.name)),
      localEnumNames: new Set(groups.enums.map((s) => s.name)),
      localTypeNames: new Set(groups.types.map((s) => s.name)),
      localBitmapNames: new Set(groups.bitmaps.map((s) => s.name)),
    };
  }

  // =========================================================================
  // Section Generators - Extract complexity from CHeaderGenerator/CppHeaderGenerator
  // =========================================================================

  /**
   * Generate header guard opening and file comment
   */
  static generateHeaderStart(guard: string): string[] {
    return [
      `#ifndef ${guard}`,
      `#define ${guard}`,
      "",
      "/**",
      " * Generated by C-Next Transpiler",
      " * Header file for cross-language interoperability",
      " */",
      "",
    ];
  }

  /**
   * Generate all include directives (system, user, and external type headers)
   */
  static generateIncludes(
    options: IHeaderOptions,
    headersToInclude: Set<string>,
  ): string[] {
    const lines: string[] = [];

    // System includes
    if (options.includeSystemHeaders !== false) {
      lines.push("#include <stdint.h>", "#include <stdbool.h>");
    }

    // User includes
    if (options.userIncludes && options.userIncludes.length > 0) {
      for (const include of options.userIncludes) {
        lines.push(include);
      }
    }

    // External type header includes
    for (const directive of headersToInclude) {
      lines.push(directive);
    }

    // Add blank line if any includes were added
    const hasIncludes =
      options.includeSystemHeaders !== false ||
      (options.userIncludes && options.userIncludes.length > 0) ||
      headersToInclude.size > 0;
    if (hasIncludes) {
      lines.push("");
    }

    return lines;
  }

  /**
   * Generate C++ extern "C" wrapper opening
   */
  static generateCppWrapperStart(): string[] {
    return ["#ifdef __cplusplus", 'extern "C" {', "#endif", ""];
  }

  /**
   * Generate forward declarations for external types
   */
  static generateForwardDeclarations(cCompatibleTypes: string[]): string[] {
    if (cCompatibleTypes.length === 0) {
      return [];
    }

    const lines: string[] = [
      "/* External type dependencies - include appropriate headers */",
    ];
    for (const typeName of cCompatibleTypes) {
      lines.push(`typedef struct ${typeName} ${typeName};`);
    }
    lines.push("");
    return lines;
  }

  /**
   * Generate enum section
   */
  static generateEnumSection(
    enums: ISymbol[],
    typeInput?: IHeaderTypeInput,
  ): string[] {
    if (enums.length === 0) {
      return [];
    }

    const lines: string[] = ["/* Enumerations */"];
    for (const sym of enums) {
      if (typeInput) {
        lines.push(generateEnumHeader(sym.name, typeInput));
      } else {
        lines.push(`/* Enum: ${sym.name} (see implementation for values) */`);
      }
    }
    lines.push("");
    return lines;
  }

  /**
   * Generate bitmap section
   */
  static generateBitmapSection(
    bitmaps: ISymbol[],
    typeInput?: IHeaderTypeInput,
  ): string[] {
    if (bitmaps.length === 0) {
      return [];
    }

    const lines: string[] = ["/* Bitmaps */"];
    for (const sym of bitmaps) {
      if (typeInput) {
        lines.push(generateBitmapHeader(sym.name, typeInput));
      } else {
        lines.push(`/* Bitmap: ${sym.name} (see implementation for layout) */`);
      }
    }
    lines.push("");
    return lines;
  }

  /**
   * Generate type alias section
   */
  static generateTypeAliasSection(types: ISymbol[]): string[] {
    if (types.length === 0) {
      return [];
    }

    const lines: string[] = ["/* Type aliases */"];
    for (const sym of types) {
      if (sym.type) {
        const cType = mapType(sym.type);
        lines.push(`typedef ${cType} ${sym.name};`);
      }
    }
    lines.push("");
    return lines;
  }

  /**
   * Generate struct and class definitions section
   */
  static generateStructSection(
    structs: ISymbol[],
    classes: ISymbol[],
    typeInput?: IHeaderTypeInput,
  ): string[] {
    if (structs.length === 0 && classes.length === 0) {
      return [];
    }

    const lines: string[] = [];

    if (typeInput) {
      lines.push("/* Struct definitions */");
      for (const sym of structs) {
        lines.push(generateStructHeader(sym.name, typeInput));
      }
      for (const sym of classes) {
        lines.push(generateStructHeader(sym.name, typeInput));
      }
    } else {
      lines.push("/* Forward declarations */");
      for (const sym of structs) {
        lines.push(`typedef struct ${sym.name} ${sym.name};`);
      }
      for (const sym of classes) {
        lines.push(`typedef struct ${sym.name} ${sym.name};`);
      }
    }
    lines.push("");
    return lines;
  }

  /**
   * Generate extern variable declarations section
   *
   * Uses VariableDeclarationFormatter for consistent formatting with CodeGenerator.
   */
  static generateVariableSection(variables: ISymbol[]): string[] {
    if (variables.length === 0) {
      return [];
    }

    const lines: string[] = ["/* External variables */"];
    for (const sym of variables) {
      // Build normalized input for the unified formatter
      const input: IVariableFormatInput = {
        name: sym.name,
        cnextType: sym.type || "int",
        mappedType: mapType(sym.type || "int"),
        modifiers: {
          isConst: sym.isConst ?? false,
          isAtomic: sym.isAtomic ?? false,
          isVolatile: false, // C-Next uses atomic, not volatile directly
          isExtern: true, // Headers always use extern
        },
        arrayDimensions:
          sym.isArray && sym.arrayDimensions ? sym.arrayDimensions : undefined,
      };

      const declaration = VariableDeclarationFormatter.format(input);
      lines.push(`${declaration};`);
    }
    lines.push("");
    return lines;
  }

  /**
   * Generate C++ extern "C" wrapper closing and header guard end
   */
  static generateHeaderEnd(guard: string): string[] {
    return [
      "#ifdef __cplusplus",
      "}",
      "#endif",
      "",
      `#endif /* ${guard} */`,
      "",
    ];
  }
}

export default HeaderGeneratorUtils;
