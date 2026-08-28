/**
 * Type Registration Engine
 * Issue #791: Extracted from CodeGenerator to reduce file size
 *
 * Registers variable types from AST before code generation.
 * This ensures type information is available for .length and
 * other type-dependent operations regardless of declaration order.
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser";
import TIncludeHeader from "../generators/TIncludeHeader";
import TOverflowBehavior from "../types/TOverflowBehavior";
import TYPE_WIDTH from "../../../constants/TYPE_WIDTH";
import CodeGenState from "../../../state/CodeGenState";
import TypeRegistrationUtils from "../TypeRegistrationUtils";
import QualifiedNameGenerator from "../utils/QualifiedNameGenerator";
import ArrayDimensionParser from "../../../../utils/ArrayDimensionParser";
import QualifiedCName from "../../../../utils/QualifiedCName";
import LiteralUtils from "../../../../utils/LiteralUtils";
import UNRESOLVED_DIMENSION from "../../../constants/UNRESOLVED_DIMENSION";
import dimensionEvalOptions from "./dimensionEvalOptions";
import IScopeSymbol from "../../../types/symbols/IScopeSymbol";
import ScopeUtils from "../../../../utils/ScopeUtils";

/**
 * Callbacks required for type registration.
 * Minimizes coupling to CodeGenerator.
 */
interface ITypeRegistrationCallbacks {
  /** Evaluate a compile-time constant expression */
  tryEvaluateConstant: (ctx: Parser.ExpressionContext) => number | undefined;
  /** Request an include header */
  requireInclude: (header: TIncludeHeader) => void;
  /** Resolve qualified type names (optional, for C++ namespace support) */
  resolveQualifiedType?: (identifiers: string[]) => string;
}

/**
 * Static class that registers variable types from the AST.
 * Called during Stage 2 of code generation, before generating any code.
 */
class TypeRegistrationEngine {
  // ============================================================================
  // Public entry points
  // ============================================================================

  /**
   * Entry point: Register all variable types from the program tree.
   */
  static register(
    tree: Parser.ProgramContext,
    callbacks: ITypeRegistrationCallbacks,
  ): void {
    for (const decl of tree.declaration()) {
      if (decl.variableDeclaration()) {
        TypeRegistrationEngine.registerGlobalVariable(
          decl.variableDeclaration()!,
          callbacks,
        );
      }
      if (decl.scopeDeclaration()) {
        TypeRegistrationEngine.registerScopeMemberTypes(
          decl.scopeDeclaration()!,
          callbacks,
        );
      }
    }
  }

  /**
   * Register a global variable's type information.
   */
  static registerGlobalVariable(
    varDecl: Parser.VariableDeclarationContext,
    callbacks: ITypeRegistrationCallbacks,
  ): void {
    TypeRegistrationEngine._trackVariableType(varDecl, callbacks);
    if (varDecl.constModifier() && varDecl.expression()) {
      const constName = varDecl.IDENTIFIER().getText();
      const constValue = callbacks.tryEvaluateConstant(varDecl.expression()!);
      if (constValue !== undefined) {
        CodeGenState.constValues.set(constName, constValue);
      }
    }
  }

  /**
   * Register type information for all members in a scope.
   */
  static registerScopeMemberTypes(
    scopeDecl: Parser.ScopeDeclarationContext,
    callbacks: ITypeRegistrationCallbacks,
  ): void {
    const scopeName = scopeDecl.IDENTIFIER().getText();
    const savedScope = CodeGenState.currentScope;
    CodeGenState.setCurrentScopeByName(scopeName);

    for (const member of scopeDecl.scopeMember()) {
      if (member.variableDeclaration()) {
        const varDecl = member.variableDeclaration()!;
        const varName = varDecl.IDENTIFIER().getText();
        const fullName = QualifiedNameGenerator.forMember(scopeName, varName);
        TypeRegistrationEngine._trackVariableTypeWithName(
          varDecl,
          fullName,
          callbacks,
        );
      }
    }

    CodeGenState.currentScope = savedScope;
  }

  // ============================================================================
  // Static helper methods (public)
  // ============================================================================

  /**
   * Parse array dimension from arrayType context.
   * Returns the numeric size, or undefined if not a simple integer literal.
   */
  static parseArrayTypeDimension(
    arrayTypeCtx: Parser.ArrayTypeContext,
  ): number | undefined {
    const dims = arrayTypeCtx.arrayTypeDimension();
    if (dims.length === 0) {
      return undefined;
    }
    const sizeExpr = dims[0].expression();
    if (!sizeExpr) {
      return undefined;
    }
    return LiteralUtils.parseIntegerLiteral(sizeExpr.getText());
  }

  /**
   * Resolve base type name from a type context.
   * Handles primitive, scoped (this.Type), global, qualified, and user types.
   * Returns null for special types like string<N> that need separate handling.
   */
  static resolveBaseType(
    typeCtx: Parser.TypeContext,
    currentScope: IScopeSymbol | null,
  ): string | null {
    return TypeRegistrationEngine._resolveBaseTypeWithCallbacks(
      typeCtx,
      currentScope,
    );
  }

  /**
   * Internal: Resolve base type with optional callback for qualified types.
   * When resolveQualifiedType callback is provided, uses it for C++ namespace support.
   */
  private static _resolveBaseTypeWithCallbacks(
    typeCtx: Parser.TypeContext,
    currentScope: IScopeSymbol | null,
    callbacks?: ITypeRegistrationCallbacks,
  ): string | null {
    if (typeCtx.primitiveType()) {
      return typeCtx.primitiveType()!.getText();
    }

    if (typeCtx.scopedType()) {
      // ADR-016: Handle this.Type for scoped types (e.g., this.State -> Motor_State)
      const typeName = typeCtx.scopedType()!.IDENTIFIER().getText();
      return currentScope
        ? ScopeUtils.qualifyInScope(typeName, currentScope)
        : typeName;
    }

    if (typeCtx.globalType()) {
      // Issue #478: Handle global.Type for global types inside scope
      return typeCtx.globalType()!.IDENTIFIER().getText();
    }

    if (typeCtx.qualifiedType()) {
      // ADR-016: Handle Scope.Type from outside scope
      // Issue #388: Also handles C++ namespace types when callback is provided
      const identifiers = typeCtx.qualifiedType()!.IDENTIFIER();
      const identifierNames = identifiers.map((id) => id.getText());

      // Use callback if provided for C++ namespace support
      if (callbacks?.resolveQualifiedType) {
        return callbacks.resolveQualifiedType(identifierNames);
      }
      return QualifiedCName.join(...identifierNames);
    }

    if (typeCtx.userType()) {
      const typeName = typeCtx.userType()!.getText();
      // ADR-057: bare type name inside a scope — qualify if it's a scope type
      return ScopeUtils.qualifyScopeType(typeName, currentScope, (qn) =>
        CodeGenState.isScopeType(qn),
      );
    }

    // String types and array types are handled separately
    return null;
  }

  // ============================================================================
  // Variable tracking methods
  // ============================================================================

  /**
   * Track a single variable declaration.
   * Used for local variable tracking during code generation.
   */
  static trackVariable(
    varDecl: Parser.VariableDeclarationContext,
    callbacks: ITypeRegistrationCallbacks,
  ): void {
    TypeRegistrationEngine._trackVariableType(varDecl, callbacks);
  }

  private static _trackVariableType(
    varDecl: Parser.VariableDeclarationContext,
    callbacks: ITypeRegistrationCallbacks,
  ): void {
    const name = varDecl.IDENTIFIER().getText();
    TypeRegistrationEngine._trackVariableTypeWithName(varDecl, name, callbacks);
  }

  private static _trackVariableTypeWithName(
    varDecl: Parser.VariableDeclarationContext,
    registryName: string,
    callbacks: ITypeRegistrationCallbacks,
  ): void {
    const typeCtx = varDecl.type();
    const arrayDim = varDecl.arrayDimension();
    const isConst = varDecl.constModifier() !== null;

    const overflowMod = varDecl.overflowModifier();
    const overflowBehavior: TOverflowBehavior =
      overflowMod?.getText() === "wrap" ? "wrap" : "clamp";

    const isAtomic = varDecl.atomicModifier() !== null;

    if (
      TypeRegistrationEngine._tryRegisterStringType(
        registryName,
        typeCtx,
        arrayDim,
        isConst,
        overflowBehavior,
        isAtomic,
        callbacks,
      )
    ) {
      return;
    }

    if (typeCtx.arrayType()) {
      TypeRegistrationEngine._registerArrayTypeVariable(
        registryName,
        typeCtx.arrayType()!,
        arrayDim,
        isConst,
        overflowBehavior,
        isAtomic,
        callbacks,
      );
      return;
    }

    const baseType = TypeRegistrationEngine._resolveBaseTypeWithCallbacks(
      typeCtx,
      CodeGenState.currentScope,
      callbacks,
    );
    if (!baseType) {
      return;
    }

    if (
      TypeRegistrationEngine._tryRegisterEnumOrBitmapType(
        registryName,
        baseType,
        isConst,
        arrayDim,
        overflowBehavior,
        isAtomic,
        callbacks,
      )
    ) {
      return;
    }

    TypeRegistrationEngine._registerStandardType(
      registryName,
      baseType,
      arrayDim,
      isConst,
      overflowBehavior,
      isAtomic,
      callbacks,
    );
  }

  // ============================================================================
  // String type registration
  // ============================================================================

  private static _tryRegisterStringType(
    registryName: string,
    typeCtx: Parser.TypeContext,
    arrayDim: Parser.ArrayDimensionContext[] | null,
    isConst: boolean,
    overflowBehavior: TOverflowBehavior,
    isAtomic: boolean,
    callbacks: ITypeRegistrationCallbacks,
  ): boolean {
    const stringCtx = typeCtx.stringType();
    if (!stringCtx) {
      return false;
    }

    const intLiteral = stringCtx.INTEGER_LITERAL();
    if (!intLiteral) {
      return false;
    }

    const capacity = Number.parseInt(intLiteral.getText(), 10);
    callbacks.requireInclude("string");
    const stringDim = capacity + 1;

    const additionalDims = ArrayDimensionParser.parseDimensions(arrayDim);
    const allDims =
      additionalDims.length > 0 ? [...additionalDims, stringDim] : [stringDim];

    CodeGenState.setVariableTypeInfo(registryName, {
      baseType: "char",
      bitWidth: 8,
      isArray: true,
      arrayDimensions: allDims,
      isConst,
      isString: true,
      stringCapacity: capacity,
      overflowBehavior,
      isAtomic,
    });
    return true;
  }

  /**
   * Issue #1029: Register type info for string arrays (string<N>[M]).
   *
   * String arrays are parsed as arrayType with stringType inside:
   *   arrayType -> stringType arrayTypeDimension+
   *
   * For `string<32>[4] items`:
   *   - stringType gives capacity 32
   *   - arrayTypeDimension gives [4]
   *   - Result: char items[4][33] with dimensions [4, 33]
   */
  private static _registerStringArrayType(
    registryName: string,
    arrayTypeCtx: Parser.ArrayTypeContext,
    arrayDim: Parser.ArrayDimensionContext[] | null,
    isConst: boolean,
    overflowBehavior: TOverflowBehavior,
    isAtomic: boolean,
    callbacks: ITypeRegistrationCallbacks,
  ): void {
    const stringCtx = arrayTypeCtx.stringType()!;
    const intLiteral = stringCtx.INTEGER_LITERAL();
    if (!intLiteral) {
      return; // No capacity specified - can't register
    }

    const capacity = Number.parseInt(intLiteral.getText(), 10);
    callbacks.requireInclude("string");
    const stringDim = capacity + 1;

    // Collect dimensions: arrayTypeDimension from arrayType, then string capacity
    // Build all dimensions at once to avoid multiple push() calls (SonarCloud S7778)
    //
    // Issue #1159: hold the slot for a count that does not fold rather than
    // filtering it out. Dropping it slid the string capacity into dimension 1,
    // so `string<8>[COUNT] names` recorded [9] instead of [4, 9] -- names[7]
    // was accepted against a bound of 4, and the field missed the string-array
    // shape entirely, emitting an assignment instead of strncpy.
    const arrayTypeDims = arrayTypeCtx
      .arrayTypeDimension()
      .map((dim) => dim.expression())
      .filter((expr): expr is Parser.ExpressionContext => expr !== null)
      .map(
        (expr) =>
          ArrayDimensionParser.parseSingleDimension(
            expr,
            dimensionEvalOptions(),
          ) ?? UNRESOLVED_DIMENSION,
      );
    const additionalDims = ArrayDimensionParser.parseDimensions(arrayDim);
    const dimensions = [...arrayTypeDims, ...additionalDims, stringDim];

    CodeGenState.setVariableTypeInfo(registryName, {
      baseType: "char",
      bitWidth: 8,
      isArray: true,
      arrayDimensions: dimensions,
      isConst,
      isString: true,
      stringCapacity: capacity,
      overflowBehavior,
      isAtomic,
    });
  }

  // ============================================================================
  // Array and standard type registration
  // ============================================================================

  private static _registerArrayTypeVariable(
    registryName: string,
    arrayTypeCtx: Parser.ArrayTypeContext,
    arrayDim: Parser.ArrayDimensionContext[] | null,
    isConst: boolean,
    overflowBehavior: TOverflowBehavior,
    isAtomic: boolean,
    callbacks: ITypeRegistrationCallbacks,
  ): void {
    // Issue #1029: Handle string arrays (string<N>[M]) - must check before primitiveType/userType
    if (arrayTypeCtx.stringType()) {
      TypeRegistrationEngine._registerStringArrayType(
        registryName,
        arrayTypeCtx,
        arrayDim,
        isConst,
        overflowBehavior,
        isAtomic,
        callbacks,
      );
      return;
    }

    // Try to register enum/bitmap user type arrays separately
    if (arrayTypeCtx.userType()) {
      const registered = TypeRegistrationEngine._tryRegisterUserTypeArray(
        registryName,
        arrayTypeCtx,
        arrayDim,
        isConst,
        overflowBehavior,
        isAtomic,
        callbacks,
      );
      if (registered) {
        return;
      }
    }

    // Extract base type and bit width from array type
    const typeInfo =
      TypeRegistrationEngine._extractArrayBaseTypeInfo(arrayTypeCtx);
    if (!typeInfo.baseType) {
      return;
    }

    const arrayDimensions = TypeRegistrationEngine._collectArrayDimensions(
      arrayTypeCtx,
      arrayDim,
      callbacks,
    );

    CodeGenState.setVariableTypeInfo(registryName, {
      baseType: typeInfo.baseType,
      bitWidth: typeInfo.bitWidth,
      isArray: true,
      arrayDimensions: arrayDimensions.length > 0 ? arrayDimensions : undefined,
      isConst,
      overflowBehavior,
      isAtomic,
    });
  }

  /**
   * Extract base type and bit width from an array type context.
   * Handles primitive, qualified, scoped, and user types.
   */
  private static _extractArrayBaseTypeInfo(
    arrayTypeCtx: Parser.ArrayTypeContext,
  ): { baseType: string; bitWidth: number } {
    if (arrayTypeCtx.primitiveType()) {
      const baseType = arrayTypeCtx.primitiveType()!.getText();
      return { baseType, bitWidth: TYPE_WIDTH[baseType] || 0 };
    }

    if (arrayTypeCtx.qualifiedType()) {
      const parts = arrayTypeCtx.qualifiedType()!.IDENTIFIER();
      return {
        baseType: QualifiedCName.join(...parts.map((p) => p.getText())),
        bitWidth: 0,
      };
    }

    if (arrayTypeCtx.scopedType()) {
      const typeName = arrayTypeCtx.scopedType()!.IDENTIFIER().getText();
      const baseType = CodeGenState.currentScope
        ? ScopeUtils.qualifyInScope(typeName, CodeGenState.currentScope)
        : typeName;
      return { baseType, bitWidth: 0 };
    }

    if (arrayTypeCtx.globalType()) {
      const typeName = arrayTypeCtx.globalType()!.IDENTIFIER().getText();
      return { baseType: typeName, bitWidth: 0 };
    }

    if (arrayTypeCtx.userType()) {
      // ADR-057: bare type name inside a scope — qualify if it's a scope type
      const qualified = CodeGenState.qualifyScopeType(
        arrayTypeCtx.userType()!.getText(),
      );
      return { baseType: qualified, bitWidth: 0 };
    }

    return { baseType: "", bitWidth: 0 };
  }

  /**
   * Try to register a user type array as enum or bitmap.
   * Returns true if registration was handled, false if it should fall through.
   */
  private static _tryRegisterUserTypeArray(
    registryName: string,
    arrayTypeCtx: Parser.ArrayTypeContext,
    arrayDim: Parser.ArrayDimensionContext[] | null,
    isConst: boolean,
    overflowBehavior: TOverflowBehavior,
    isAtomic: boolean,
    callbacks: ITypeRegistrationCallbacks,
  ): boolean {
    const baseType = arrayTypeCtx.userType()!.getText();
    const combinedArrayDim = arrayDim ?? [];

    const registered = TypeRegistrationEngine._tryRegisterEnumOrBitmapType(
      registryName,
      baseType,
      isConst,
      combinedArrayDim,
      overflowBehavior,
      isAtomic,
      callbacks,
    );

    if (!registered) {
      return false;
    }

    // Add arrayType dimensions to existing info
    const existingInfo = CodeGenState.getVariableTypeInfo(registryName);
    if (existingInfo) {
      const arrayTypeDim =
        TypeRegistrationEngine.parseArrayTypeDimension(arrayTypeCtx);
      const allDims = arrayTypeDim
        ? [arrayTypeDim, ...(existingInfo.arrayDimensions ?? [])]
        : existingInfo.arrayDimensions;
      CodeGenState.setVariableTypeInfo(registryName, {
        ...existingInfo,
        isArray: true,
        arrayDimensions: allDims,
      });
    }

    return true;
  }

  private static _collectArrayDimensions(
    arrayTypeCtx: Parser.ArrayTypeContext,
    arrayDim: Parser.ArrayDimensionContext[] | null,
    callbacks: ITypeRegistrationCallbacks,
  ): number[] {
    const arrayDimensions: number[] = [];

    for (const dim of arrayTypeCtx.arrayTypeDimension()) {
      const sizeExpr = dim.expression();
      if (sizeExpr) {
        // Issue #1159: resolve through the same evaluator the sibling
        // _evaluateArrayDimensions() uses, so every notation (hex, binary,
        // const, sizeof) yields the same dimension the .c declaration emits.
        // UNRESOLVED_DIMENSION keeps the slot so later dimensions stay aligned
        // with their subscripts in TypeValidator.checkArrayBounds().
        const size = ArrayDimensionParser.parseSingleDimension(
          sizeExpr,
          dimensionEvalOptions(),
        );
        arrayDimensions.push(size ?? UNRESOLVED_DIMENSION);
      }
    }

    const additionalDims = TypeRegistrationEngine._evaluateArrayDimensions(
      arrayDim,
      callbacks,
    );
    if (additionalDims) {
      arrayDimensions.push(...additionalDims);
    }

    return arrayDimensions;
  }

  private static _evaluateArrayDimensions(
    arrayDim: Parser.ArrayDimensionContext[] | null,
    _callbacks: ITypeRegistrationCallbacks,
  ): number[] | undefined {
    return ArrayDimensionParser.parseAllDimensions(
      arrayDim,
      dimensionEvalOptions(),
    );
  }

  private static _registerStandardType(
    registryName: string,
    baseType: string,
    arrayDim: Parser.ArrayDimensionContext[] | null,
    isConst: boolean,
    overflowBehavior: TOverflowBehavior,
    isAtomic: boolean,
    callbacks: ITypeRegistrationCallbacks,
  ): void {
    const bitWidth = TYPE_WIDTH[baseType] || 0;
    const isArray = arrayDim !== null && arrayDim.length > 0;
    const arrayDimensions = isArray
      ? TypeRegistrationEngine._evaluateArrayDimensions(arrayDim, callbacks)
      : undefined;

    CodeGenState.setVariableTypeInfo(registryName, {
      baseType,
      bitWidth,
      isArray,
      arrayDimensions: isArray ? arrayDimensions : undefined,
      isConst,
      overflowBehavior,
      isAtomic,
    });
  }

  // ============================================================================
  // Enum/bitmap type registration
  // ============================================================================

  private static _tryRegisterEnumOrBitmapType(
    name: string,
    baseType: string,
    isConst: boolean,
    arrayDim: Parser.ArrayDimensionContext[] | null,
    overflowBehavior: TOverflowBehavior,
    isAtomic: boolean,
    callbacks: ITypeRegistrationCallbacks,
  ): boolean {
    const registrationOptions = {
      name,
      baseType,
      isConst,
      overflowBehavior,
      isAtomic,
    };

    if (
      TypeRegistrationUtils.tryRegisterEnumType(
        CodeGenState.symbols!,
        registrationOptions,
      )
    ) {
      return true;
    }

    const bitmapDimensions = TypeRegistrationEngine._evaluateArrayDimensions(
      arrayDim,
      callbacks,
    );
    if (
      TypeRegistrationUtils.tryRegisterBitmapType(
        CodeGenState.symbols!,
        registrationOptions,
        bitmapDimensions,
      )
    ) {
      return true;
    }

    return false;
  }
}

export default TypeRegistrationEngine;
