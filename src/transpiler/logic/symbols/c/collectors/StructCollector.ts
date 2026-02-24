/**
 * StructCollector - Collects struct and union symbols from C parse trees.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { StructOrUnionSpecifierContext } from "../../../parser/c/grammar/CParser";
import type ICStructSymbol from "../../../../types/symbols/c/ICStructSymbol";
import type ICFieldInfo from "../../../../types/symbols/c/ICFieldInfo";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import SymbolTable from "../../SymbolTable";
import SymbolUtils from "../../SymbolUtils";
import DeclaratorUtils from "../utils/DeclaratorUtils";

/**
 * Options for struct collection.
 * Consolidates optional parameters to avoid exceeding 7-parameter limit.
 */
interface ICollectOptions {
  /** Optional typedef name for anonymous structs */
  typedefName?: string;
  /** Whether this is part of a typedef declaration */
  isTypedef?: boolean;
  /** Array to collect warnings */
  warnings?: string[];
  /** Issue #957: True if typedef has pointer declarator (typedef struct X *Y) */
  isPointerTypedef?: boolean;
}

/** Options for symbol table updates */
interface IUpdateOptions {
  needsStructKeyword: boolean;
  hasBody: boolean;
  isTypedef?: boolean;
  typedefName?: string;
  structTag?: string;
  /** Issue #957: True if typedef has pointer declarator */
  isPointerTypedef?: boolean;
}

class StructCollector {
  /**
   * Collect a struct or union symbol from a specifier context.
   *
   * @param structSpec The struct/union specifier context
   * @param sourceFile Source file path
   * @param line Source line number
   * @param symbolTable Optional symbol table for field tracking
   * @param options Optional collection options (typedef info, warnings)
   */
  static collect(
    structSpec: StructOrUnionSpecifierContext,
    sourceFile: string,
    line: number,
    symbolTable: SymbolTable | null,
    options: ICollectOptions = {},
  ): ICStructSymbol | null {
    const { typedefName, isTypedef, warnings, isPointerTypedef } = options;
    const identifier = structSpec.Identifier();

    // Use typedef name for anonymous structs (e.g., typedef struct { ... } AppConfig;)
    const name = identifier?.getText() || typedefName;
    if (!name) return null; // Skip if no name available

    const isUnion = structSpec.structOrUnion()?.getText() === "union";

    // Issue #948: Detect forward declaration (struct with no body)
    const hasBody = structSpec.structDeclarationList() !== null;

    // Extract fields if struct has a body
    const fields = StructCollector.collectFields(
      structSpec,
      name,
      symbolTable,
      warnings,
    );

    // Mark named structs that are not typedef'd - they need 'struct' keyword
    // Example: "struct NamedPoint { ... };" -> needs "struct NamedPoint var"
    // But "typedef struct { ... } Rectangle;" -> just "Rectangle var"
    const needsStructKeyword = Boolean(identifier && !isTypedef);

    if (symbolTable) {
      StructCollector.updateSymbolTable(symbolTable, name, sourceFile, {
        needsStructKeyword,
        hasBody,
        isTypedef,
        typedefName,
        structTag: identifier?.getText(),
        isPointerTypedef,
      });
    }

    return {
      kind: "struct",
      name,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.C,
      isExported: true,
      isUnion,
      needsStructKeyword,
      fields: fields.size > 0 ? fields : undefined,
    };
  }

  /**
   * Update symbol table with struct metadata.
   * Extracted to reduce cognitive complexity of collect().
   */
  private static updateSymbolTable(
    symbolTable: SymbolTable,
    name: string,
    sourceFile: string,
    options: IUpdateOptions,
  ): void {
    const {
      needsStructKeyword,
      hasBody,
      isTypedef,
      typedefName,
      structTag,
      isPointerTypedef,
    } = options;

    if (needsStructKeyword) {
      symbolTable.markNeedsStructKeyword(name);
    }

    // Issue #948: Track opaque types (forward-declared typedef structs)
    // Issue #957: Don't mark pointer typedefs as opaque.
    // For "typedef struct X *Y", Y is already a pointer type, not an opaque struct.
    if (isTypedef && !hasBody && typedefName && !isPointerTypedef) {
      symbolTable.markOpaqueType(typedefName);
      if (structTag) {
        symbolTable.registerStructTagAlias(structTag, typedefName);
      }
    }

    // Issue #958: Track ALL typedef struct types (forward-declared OR complete)
    // Records source file to enable same-file vs cross-file distinction
    // Issue #957: Don't track pointer typedefs - they're already pointers.
    if (isTypedef && typedefName && !isPointerTypedef) {
      symbolTable.markTypedefStructType(typedefName, sourceFile);
    }

    // Issue #948: Unmark opaque type if full definition is found
    if (hasBody) {
      StructCollector.unmarkOpaqueTypesOnDefinition(
        symbolTable,
        sourceFile,
        structTag,
        typedefName,
      );
    }
  }

  /**
   * Unmark opaque and typedef struct types when a full struct definition is encountered.
   * Handles: typedef struct _foo foo; struct _foo { ... };
   * Issue #958: Only unmarks typedefStructTypes when definition is in SAME file.
   */
  private static unmarkOpaqueTypesOnDefinition(
    symbolTable: SymbolTable,
    sourceFile: string,
    structTag?: string,
    typedefName?: string,
  ): void {
    if (structTag) {
      const typedefAlias = symbolTable.getStructTagAlias(structTag);
      symbolTable.unmarkOpaqueType(structTag);
      symbolTable.unmarkTypedefStructType(structTag, sourceFile);
      if (typedefAlias) {
        symbolTable.unmarkOpaqueType(typedefAlias);
        symbolTable.unmarkTypedefStructType(typedefAlias, sourceFile);
      }
    }
    if (typedefName) {
      symbolTable.unmarkOpaqueType(typedefName);
      symbolTable.unmarkTypedefStructType(typedefName, sourceFile);
    }
  }

  /**
   * Collect fields from a struct/union definition.
   */
  private static collectFields(
    structSpec: StructOrUnionSpecifierContext,
    structName: string,
    symbolTable: SymbolTable | null,
    warnings?: string[],
  ): ReadonlyMap<string, ICFieldInfo> {
    const fields = new Map<string, ICFieldInfo>();

    const declList = structSpec.structDeclarationList();
    if (!declList) return fields;

    for (const structDecl of declList.structDeclaration()) {
      StructCollector.collectFieldsFromDecl(
        structDecl,
        structName,
        fields,
        symbolTable,
        warnings,
      );
    }

    return fields;
  }

  /**
   * Collect fields from a single struct declaration.
   */
  private static collectFieldsFromDecl(
    structDecl: any,
    structName: string,
    fields: Map<string, ICFieldInfo>,
    symbolTable: SymbolTable | null,
    warnings?: string[],
  ): void {
    const specQualList = structDecl.specifierQualifierList?.();
    if (!specQualList) return;

    const fieldType = DeclaratorUtils.extractTypeFromSpecQualList(specQualList);
    const structDeclList = structDecl.structDeclaratorList?.();
    if (!structDeclList) return;

    for (const structDeclarator of structDeclList.structDeclarator()) {
      StructCollector.processFieldDeclarator(
        structDeclarator,
        structName,
        fieldType,
        fields,
        symbolTable,
        warnings,
      );
    }
  }

  /**
   * Process a single field declarator and add to fields map.
   */
  private static processFieldDeclarator(
    structDeclarator: any,
    structName: string,
    fieldType: string,
    fields: Map<string, ICFieldInfo>,
    symbolTable: SymbolTable | null,
    warnings?: string[],
  ): void {
    const declarator = structDeclarator.declarator?.();
    if (!declarator) return;

    const fieldName = DeclaratorUtils.extractDeclaratorName(declarator);
    if (!fieldName) return;

    if (warnings && SymbolUtils.isReservedFieldName(fieldName)) {
      warnings.push(
        SymbolUtils.getReservedFieldWarning("C", structName, fieldName),
      );
    }

    const arrayDimensions = DeclaratorUtils.extractArrayDimensions(declarator);
    const fieldInfo: ICFieldInfo = {
      name: fieldName,
      type: fieldType,
      arrayDimensions: arrayDimensions.length > 0 ? arrayDimensions : undefined,
    };

    fields.set(fieldName, fieldInfo);

    if (symbolTable) {
      symbolTable.addStructField(
        structName,
        fieldName,
        fieldType,
        arrayDimensions.length > 0 ? arrayDimensions : undefined,
      );
    }
  }
}

export default StructCollector;
