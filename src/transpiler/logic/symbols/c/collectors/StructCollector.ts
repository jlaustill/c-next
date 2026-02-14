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

class StructCollector {
  /**
   * Collect a struct or union symbol from a specifier context.
   *
   * @param structSpec The struct/union specifier context
   * @param sourceFile Source file path
   * @param line Source line number
   * @param symbolTable Optional symbol table for field tracking
   * @param typedefName Optional typedef name for anonymous structs
   * @param isTypedef Whether this is part of a typedef declaration
   * @param warnings Array to collect warnings
   */
  static collect(
    structSpec: StructOrUnionSpecifierContext,
    sourceFile: string,
    line: number,
    symbolTable: SymbolTable | null,
    typedefName?: string,
    isTypedef?: boolean,
    warnings?: string[],
  ): ICStructSymbol | null {
    const identifier = structSpec.Identifier();

    // Use typedef name for anonymous structs (e.g., typedef struct { ... } AppConfig;)
    const name = identifier?.getText() || typedefName;
    if (!name) return null; // Skip if no name available

    const isUnion = structSpec.structOrUnion()?.getText() === "union";

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

    if (symbolTable && needsStructKeyword) {
      symbolTable.markNeedsStructKeyword(name);
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
