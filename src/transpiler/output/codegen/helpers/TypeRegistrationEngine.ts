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
import TOverflowBehavior from "../../../types/TOverflowBehavior";
import TYPE_WIDTH from "../../../constants/TYPE_WIDTH";
import CodeGenState from "../../../state/CodeGenState";
import TypeRegistrationUtils from "../TypeRegistrationUtils";
import QualifiedNameGenerator from "../utils/QualifiedNameGenerator";
import ArrayDimensionParser from "../../../../utils/ArrayDimensionParser";
import LiteralUtils from "../../../../utils/LiteralUtils";
import OverflowBehaviorUtils from "../../../../utils/OverflowBehaviorUtils";
import UNRESOLVED_DIMENSION from "../../../constants/UNRESOLVED_DIMENSION";
import dimensionEvalOptions from "./dimensionEvalOptions";
import TypeBinding from "../../../logic/symbols/TypeBinding";

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
    const savedScope = CodeGenState.currentScopePath;
    CodeGenState.setCurrentScopeByPath(scopeName);

    for (const member of scopeDecl.scopeMember()) {
      if (member.variableDeclaration()) {
        const varDecl = member.variableDeclaration()!;
        const varName = varDecl.IDENTIFIER().getText();
        // #1298: `setCurrentScopeByPath` above stored this scope's whole path;
        // qualify through that rather than re-joining one level from the leaf
        // name it was resolved FROM.
        const fullName = QualifiedNameGenerator.forMember(
          CodeGenState.currentScopePath,
          varName,
        );
        TypeRegistrationEngine._trackVariableTypeWithName(
          varDecl,
          fullName,
          callbacks,
        );
      }
    }

    CodeGenState.currentScopePath = savedScope;
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
    currentScopePath: string,
  ): string | null {
    return TypeRegistrationEngine._resolveBaseTypeWithCallbacks(
      typeCtx,
      currentScopePath,
    );
  }

  /**
   * Internal: Resolve base type with optional callback for qualified types.
   * When resolveQualifiedType callback is provided, uses it for C++ namespace support.
   */
  private static _resolveBaseTypeWithCallbacks(
    typeCtx: Parser.TypeContext,
    currentScopePath: string,
    callbacks?: ITypeRegistrationCallbacks,
  ): string | null {
    // #1285: ask for the two alternatives this path accepts -- a named type or
    // a primitive -- by name. String and array types WRAP another type and are
    // handled by the callers, which want a capacity or a bit width alongside
    // the name. Asking by name rather than listing the alternatives to skip
    // keeps an unrecognized future alternative null instead of letting it
    // through; the caller at _registerVariableType treats a falsy base type as
    // "not registerable", so anything wrong here silently unregisters types
    // rather than failing.
    return TypeBinding.resolveNamedOrPrimitiveType(typeCtx, currentScopePath, {
      isScopeType: (qualifiedName) => CodeGenState.isScopeType(qualifiedName),
      resolveQualifiedType: callbacks?.resolveQualifiedType,
    });
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

    // #1303: one decoder for "absent means clamp" (ADR-044), shared with the
    // symbols layer. Restating the ternary here is what let the two paths
    // disagree once a symbol crossed a file boundary.
    const overflowBehavior: TOverflowBehavior =
      OverflowBehaviorUtils.fromModifier(varDecl.overflowModifier());

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
      CodeGenState.currentScopePath,
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
    const typeInfo = TypeRegistrationEngine._extractArrayBaseTypeInfo(
      arrayTypeCtx,
      callbacks,
    );
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
  /**
   * The bit width of a type name, or 0 when it is not a primitive.
   *
   * TYPE_WIDTH is a plain object literal, so a bare index also resolves
   * inherited keys: a C-Next type named `constructor`, `toString`, `valueOf` or
   * `hasOwnProperty` is a valid IDENTIFIER and would come back as a Function,
   * which neither `|| 0` nor `?? 0` catches. Both call sites now ask the same
   * question the same way -- previously one spelled it `|| 0` and the other
   * `?? 0`, which read as a deliberate difference and was not one.
   */
  private static _bitWidthOf(baseType: string): number {
    return Object.hasOwn(TYPE_WIDTH, baseType) ? TYPE_WIDTH[baseType] : 0;
  }

  private static _extractArrayBaseTypeInfo(
    arrayTypeCtx: Parser.ArrayTypeContext,
    callbacks?: ITypeRegistrationCallbacks,
  ): { baseType: string; bitWidth: number } {
    // A string element is registered by _registerStringArrayType before this is
    // reached; an empty baseType tells the caller to skip registration, so the
    // shared ladder must not resolve it to "string<N>" here.
    if (arrayTypeCtx.stringType()) {
      return { baseType: "", bitWidth: 0 };
    }

    // #1285: one ladder. resolveQualifiedType is threaded exactly as the
    // non-array path threads it (_resolveBaseTypeWithCallbacks), so
    // `MockLib.Parse.Result r` and `MockLib.Parse.Result[4] rs` cannot register
    // base types that disagree -- the array form used to hardcode a `__` join
    // and lose C++ namespace resolution (Issue #388).
    //
    // No generated output moves either way today, and that is worth stating so
    // the threading does not look like dead ceremony: what this feeds is
    // CodeGenState.setVariableTypeInfo, whose baseType drives bit widths,
    // array dimensions and overflow behavior. The type NAME that reaches the
    // emitted declaration comes from getTypeName/TypeGenerationHelper instead.
    // Verified by removing the threading and re-transpiling a `MockLib.Config[4]`
    // declaration in C++ mode: byte-identical. It is threaded because the two
    // adjacent calls must not differ by accident, not because a fixture moves.
    const baseType =
      TypeBinding.resolveName(arrayTypeCtx, CodeGenState.currentScopePath, {
        isScopeType: (qualifiedName) => CodeGenState.isScopeType(qualifiedName),
        resolveQualifiedType: callbacks?.resolveQualifiedType,
      }) ?? "";

    // TYPE_WIDTH is a plain object literal, and this lookup now sees every
    // named type rather than only primitives. A C-Next type named `constructor`
    // or `toString` is a valid IDENTIFIER and would otherwise resolve to an
    // inherited Function, which `?? 0` does not catch.
    return {
      baseType,
      bitWidth: TypeRegistrationEngine._bitWidthOf(baseType),
    };
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
    const bitWidth = TypeRegistrationEngine._bitWidthOf(baseType);
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
