/**
 * CResolver - Orchestrates C symbol collection using composable collectors.
 *
 * This resolver collects symbols from C header parse trees and returns
 * typed TCSymbol[] discriminated unions.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  CompilationUnitContext,
  DeclarationContext,
  DeclarationSpecifiersContext,
  DeclarationSpecifierContext,
} from "../../parser/c/grammar/CParser";
import type TCSymbol from "../../../types/symbols/c/TCSymbol";
import SymbolTable from "../SymbolTable";
import DeclaratorUtils from "./utils/DeclaratorUtils";
import StructCollector from "./collectors/StructCollector";
import EnumCollector from "./collectors/EnumCollector";
import FunctionCollector from "./collectors/FunctionCollector";
import TypedefCollector from "./collectors/TypedefCollector";
import VariableCollector from "./collectors/VariableCollector";

/**
 * Result of resolving C symbols.
 */
interface ICResolverResult {
  /** Collected symbols */
  readonly symbols: TCSymbol[];

  /** Warnings generated during collection */
  readonly warnings: string[];
}

/**
 * Internal context for declaration processing.
 */
interface IDeclarationContext {
  readonly sourceFile: string;
  readonly line: number;
  readonly isTypedef: boolean;
  readonly isExtern: boolean;
  readonly symbols: TCSymbol[];
}

class CResolver {
  /**
   * Resolve all symbols from a C compilation unit.
   *
   * @param tree The parsed compilation unit context
   * @param sourceFile Source file path
   * @param symbolTable Optional symbol table for field tracking
   */
  static resolve(
    tree: CompilationUnitContext,
    sourceFile: string,
    symbolTable?: SymbolTable | null,
  ): ICResolverResult {
    const symbols: TCSymbol[] = [];
    const warnings: string[] = [];

    const translationUnit = tree.translationUnit();
    if (!translationUnit) {
      return { symbols, warnings };
    }

    for (const extDecl of translationUnit.externalDeclaration()) {
      // Function definition
      const funcDef = extDecl.functionDefinition();
      if (funcDef) {
        const funcSymbol = FunctionCollector.collectFromDefinition(
          funcDef,
          sourceFile,
        );
        if (funcSymbol) {
          symbols.push(funcSymbol);
        }
        continue;
      }

      // Declaration (typedef, struct, variable, function prototype)
      const decl = extDecl.declaration();
      if (decl) {
        CResolver.collectDeclaration(
          decl,
          sourceFile,
          symbolTable ?? null,
          symbols,
          warnings,
        );
      }
    }

    return { symbols, warnings };
  }

  /**
   * Collect symbols from a declaration.
   */
  private static collectDeclaration(
    decl: DeclarationContext,
    sourceFile: string,
    symbolTable: SymbolTable | null,
    symbols: TCSymbol[],
    warnings: string[],
  ): void {
    const declSpecs = decl.declarationSpecifiers();
    if (!declSpecs) return;

    const line = decl.start?.line ?? 0;

    // Check for storage class specifiers
    const isTypedef = DeclaratorUtils.hasStorageClass(declSpecs, "typedef");
    const isExtern = DeclaratorUtils.hasStorageClass(declSpecs, "extern");

    // Build context early for reuse across helper methods
    const ctx: IDeclarationContext = {
      sourceFile,
      line,
      isTypedef,
      isExtern,
      symbols,
    };

    // Check for struct/union
    const structSpec = DeclaratorUtils.findStructOrUnionSpecifier(declSpecs);
    if (structSpec) {
      CResolver.collectStructSymbol(
        structSpec,
        decl,
        declSpecs,
        ctx,
        symbolTable,
        warnings,
      );
    }

    // Check for enum
    const enumSpec = DeclaratorUtils.findEnumSpecifier(declSpecs);
    if (enumSpec) {
      CResolver.collectEnumSymbols(
        enumSpec,
        ctx.sourceFile,
        ctx.line,
        ctx.symbols,
      );
    }

    const initDeclList = decl.initDeclaratorList();
    if (initDeclList) {
      const baseType = DeclaratorUtils.extractTypeFromDeclSpecs(declSpecs);
      CResolver.collectInitDeclaratorList(initDeclList, baseType, ctx);
    } else {
      // Handle case where identifier is parsed as typedefName in declarationSpecifiers
      CResolver.collectFromDeclSpecsTypedefName(
        declSpecs,
        structSpec,
        enumSpec,
        ctx,
      );
    }
  }

  /**
   * Collect struct symbol from a struct specifier.
   * Extracted to reduce cognitive complexity of collectDeclaration().
   */
  private static collectStructSymbol(
    structSpec: any,
    decl: DeclarationContext,
    declSpecs: DeclarationSpecifiersContext,
    ctx: IDeclarationContext,
    symbolTable: SymbolTable | null,
    warnings: string[],
  ): void {
    // For typedef struct, extract the typedef name
    const typedefName = ctx.isTypedef
      ? CResolver.extractTypedefName(decl, declSpecs)
      : undefined;

    // Issue #957: Check if the typedef's declarator has a pointer prefix.
    // For "typedef struct X *Y", Y is already a pointer type, NOT an opaque struct.
    // Don't mark pointer typedefs as opaque.
    const isPointerTypedef = ctx.isTypedef
      ? CResolver.isPointerTypedef(decl)
      : false;

    const structSymbol = StructCollector.collect(
      structSpec,
      ctx.sourceFile,
      ctx.line,
      symbolTable,
      typedefName,
      ctx.isTypedef,
      warnings,
      isPointerTypedef,
    );
    if (structSymbol) {
      ctx.symbols.push(structSymbol);
    }
  }

  /**
   * Extract typedef name from declaration.
   * First try from init-declarator-list, then fall back to specifiers.
   */
  private static extractTypedefName(
    decl: DeclarationContext,
    declSpecs: DeclarationSpecifiersContext,
  ): string | undefined {
    const initDeclList = decl.initDeclaratorList();
    if (initDeclList) {
      const name = DeclaratorUtils.extractFirstDeclaratorName(initDeclList);
      if (name) return name;
    }
    return DeclaratorUtils.extractTypedefNameFromSpecs(declSpecs);
  }

  /**
   * Check if a typedef declaration has a pointer declarator.
   * For "typedef struct X *Y", the declarator is "*Y" which has a pointer.
   * Used for Issue #957 to distinguish pointer typedefs from opaque struct typedefs.
   */
  private static isPointerTypedef(decl: DeclarationContext): boolean {
    const initDeclList = decl.initDeclaratorList();
    if (!initDeclList) return false;

    return DeclaratorUtils.firstDeclaratorHasPointer(initDeclList);
  }

  /**
   * Collect enum symbols from an enum specifier.
   * Extracted to reduce cognitive complexity of collectDeclaration().
   */
  private static collectEnumSymbols(
    enumSpec: any,
    sourceFile: string,
    line: number,
    symbols: TCSymbol[],
  ): void {
    const enumResult = EnumCollector.collect(enumSpec, sourceFile, line);
    if (!enumResult) return;

    symbols.push(enumResult.enum);
    for (const member of enumResult.members) {
      symbols.push(member);
    }
  }

  /**
   * Collect symbols from init declarator list.
   */
  private static collectInitDeclaratorList(
    initDeclList: any,
    baseType: string,
    ctx: IDeclarationContext,
  ): void {
    for (const initDecl of initDeclList.initDeclarator()) {
      const declarator = initDecl.declarator();
      if (!declarator) continue;

      const name = DeclaratorUtils.extractDeclaratorName(declarator);
      if (!name) continue;

      // Check if this is a function declaration (has parameter list)
      const isFunction = DeclaratorUtils.declaratorIsFunction(declarator);

      if (ctx.isTypedef) {
        // For function pointer typedefs like `typedef void (*Callback)(int)`,
        // reconstruct the full type including (*) so consumers can detect it
        const typedefType = CResolver.isFunctionPointerDeclarator(declarator)
          ? `${baseType} (*)(${CResolver.extractParamText(declarator)})`
          : baseType;
        ctx.symbols.push(
          TypedefCollector.collect(name, typedefType, ctx.sourceFile, ctx.line),
        );
      } else if (isFunction) {
        ctx.symbols.push(
          FunctionCollector.collectFromDeclaration(
            name,
            baseType,
            declarator,
            ctx.sourceFile,
            ctx.line,
            ctx.isExtern,
          ),
        );
      } else {
        ctx.symbols.push(
          VariableCollector.collect(
            name,
            baseType,
            declarator,
            ctx.sourceFile,
            ctx.line,
            ctx.isExtern,
          ),
        );
      }
    }
  }

  /**
   * Collect symbols when identifier appears as typedefName in declarationSpecifiers.
   * This handles the C grammar ambiguity where variable names can be parsed as typedef names.
   */
  private static collectFromDeclSpecsTypedefName(
    declSpecs: DeclarationSpecifiersContext,
    structSpec: any,
    enumSpec: any,
    ctx: IDeclarationContext,
  ): void {
    const specs = declSpecs.declarationSpecifier();
    const { name: lastTypedefName, index: lastTypedefIndex } =
      CResolver.findLastTypedefName(specs);

    if (!lastTypedefName || lastTypedefIndex < 0) return;

    // Skip duplicates for non-typedef declarations
    if (
      !ctx.isTypedef &&
      CResolver.shouldSkipDuplicateTypedefName(
        lastTypedefName,
        structSpec,
        enumSpec,
      )
    ) {
      return;
    }

    const baseType = CResolver.buildBaseTypeFromSpecs(specs, lastTypedefIndex);

    if (ctx.isTypedef) {
      ctx.symbols.push(
        TypedefCollector.collect(
          lastTypedefName,
          baseType,
          ctx.sourceFile,
          ctx.line,
        ),
      );
    } else {
      ctx.symbols.push(
        VariableCollector.collectFromDeclSpecs(
          lastTypedefName,
          baseType,
          ctx.sourceFile,
          ctx.line,
          ctx.isExtern,
        ),
      );
    }
  }

  /**
   * Find the last typedefName in declaration specifiers.
   */
  private static findLastTypedefName(specs: DeclarationSpecifierContext[]): {
    name: string | undefined;
    index: number;
  } {
    let name: string | undefined;
    let index = -1;

    for (let i = 0; i < specs.length; i++) {
      const typeSpec = specs[i].typeSpecifier();
      const typedefName = typeSpec?.typedefName?.();
      if (typedefName) {
        name = typedefName.getText();
        index = i;
      }
    }

    return { name, index };
  }

  /**
   * Check if typedef name should be skipped to avoid duplicates.
   */
  private static shouldSkipDuplicateTypedefName(
    typedefName: string,
    structSpec: any,
    enumSpec: any,
  ): boolean {
    const structName = structSpec?.Identifier?.()?.getText();
    if (structName === typedefName) return true;

    const enumName = enumSpec?.Identifier?.()?.getText();
    if (enumName === typedefName) return true;

    return false;
  }

  /**
   * Build base type string from specifiers before the typedef name.
   */
  private static buildBaseTypeFromSpecs(
    specs: DeclarationSpecifierContext[],
    endIndex: number,
  ): string {
    const typeParts: string[] = [];
    for (let i = 0; i < endIndex; i++) {
      const typeSpec = specs[i].typeSpecifier();
      if (typeSpec) {
        typeParts.push(typeSpec.getText());
      }
    }
    return typeParts.join(" ") || "int";
  }

  /**
   * Check if a declarator represents a function pointer.
   * For `(*PointCallback)(Point p)`, the C grammar parses as:
   *   declarator -> directDeclarator
   *   directDeclarator -> directDeclarator '(' parameterTypeList ')'
   *   inner directDeclarator -> '(' declarator ')'
   *   inner declarator -> pointer directDeclarator -> * PointCallback
   */
  static isFunctionPointerDeclarator(declarator: any): boolean {
    const directDecl = declarator.directDeclarator?.();
    if (!directDecl) return false;

    // The outer directDeclarator has: directDeclarator '(' params ')'
    // Check for parameter list at the outer level
    const hasParams =
      directDecl.parameterTypeList?.() !== null ||
      Boolean(directDecl.LeftParen?.());

    if (!hasParams) return false;

    // The inner directDeclarator should be '(' declarator ')' with a pointer
    const innerDirectDecl = directDecl.directDeclarator?.();
    if (!innerDirectDecl) return false;

    const nestedDecl = innerDirectDecl.declarator?.();
    if (!nestedDecl) return false;

    return Boolean(nestedDecl.pointer?.());
  }

  /**
   * Extract parameter text from a function pointer declarator.
   * Returns the text of the parameters from a function pointer like "(*Callback)(Point p)".
   */
  static extractParamText(declarator: any): string {
    const directDecl = declarator.directDeclarator?.();
    if (!directDecl) return "";

    const paramTypeList = directDecl.parameterTypeList?.();
    if (!paramTypeList) return "";

    return paramTypeList.getText();
  }
}

export default CResolver;
