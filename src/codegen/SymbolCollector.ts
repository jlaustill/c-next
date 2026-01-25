/**
 * SymbolCollector - Extracts and catalogs all type and symbol declarations
 * from a C-Next parse tree for use by CodeGenerator and TypeResolver.
 *
 * Issue #60: Extracted from CodeGenerator for better separation of concerns.
 */

import { ParserRuleContext } from "antlr4ng";
import * as Parser from "../parser/grammar/CNextParser";
import BITMAP_SIZE from "./types/BITMAP_SIZE";
import BITMAP_BACKING_TYPE from "./types/BITMAP_BACKING_TYPE";

/**
 * Bitmap field information
 */
type TBitmapFieldInfo = {
  offset: number;
  width: number;
};

/**
 * Scope member visibility (ADR-016)
 */
type TScopeMemberVisibility = "public" | "private";

/**
 * Collects symbols from a C-Next parse tree
 */
class SymbolCollector {
  // Private mutable collections (populated during construction)
  private _knownScopes: Set<string> = new Set();
  private _knownStructs: Set<string> = new Set();
  private _knownRegisters: Set<string> = new Set();
  private _knownEnums: Set<string> = new Set();
  private _knownBitmaps: Set<string> = new Set();

  private _scopeMembers: Map<string, Set<string>> = new Map();
  private _scopeMemberVisibility: Map<
    string,
    Map<string, TScopeMemberVisibility>
  > = new Map();
  private _structFields: Map<string, Map<string, string>> = new Map();
  private _structFieldArrays: Map<string, Set<string>> = new Map();
  private _structFieldDimensions: Map<string, Map<string, number[]>> =
    new Map();
  private _enumMembers: Map<string, Map<string, number>> = new Map();
  private _bitmapFields: Map<string, Map<string, TBitmapFieldInfo>> = new Map();
  private _bitmapBackingType: Map<string, string> = new Map();
  private _bitmapBitWidth: Map<string, number> = new Map();
  private _scopedRegisters: Map<string, string> = new Map();
  private _registerMemberAccess: Map<string, string> = new Map();
  private _registerMemberTypes: Map<string, string> = new Map();

  // Issue #187: Track register address info for width-appropriate memory access
  private _registerBaseAddresses: Map<string, string> = new Map();
  private _registerMemberOffsets: Map<string, string> = new Map();
  private _registerMemberCTypes: Map<string, string> = new Map();

  // For scope context during collection (used by getTypeName)
  private _collectingScope: string | null = null;

  // Issue #232: Track which scope variables are used in which functions
  // Maps "ScopeName_varName" -> Set of function names that use it
  private _scopeVariableUsage: Map<string, Set<string>> = new Map();

  // Issue #282: Track private const values for inlining
  // Maps "ScopeName_constName" -> literal value string (e.g., "255", "true", "-100")
  private _scopePrivateConstValues: Map<string, string> = new Map();

  // Store function declarations for usage analysis
  private _scopeFunctionBodies: Map<
    string,
    Parser.FunctionDeclarationContext[]
  > = new Map();

  // Readonly public accessors
  get knownScopes(): ReadonlySet<string> {
    return this._knownScopes;
  }

  get knownStructs(): ReadonlySet<string> {
    return this._knownStructs;
  }

  get knownRegisters(): ReadonlySet<string> {
    return this._knownRegisters;
  }

  get knownEnums(): ReadonlySet<string> {
    return this._knownEnums;
  }

  get knownBitmaps(): ReadonlySet<string> {
    return this._knownBitmaps;
  }

  get scopeMembers(): ReadonlyMap<string, Set<string>> {
    return this._scopeMembers;
  }

  get scopeMemberVisibility(): ReadonlyMap<
    string,
    Map<string, TScopeMemberVisibility>
  > {
    return this._scopeMemberVisibility;
  }

  get structFields(): ReadonlyMap<string, Map<string, string>> {
    return this._structFields;
  }

  get structFieldArrays(): ReadonlyMap<string, Set<string>> {
    return this._structFieldArrays;
  }

  get structFieldDimensions(): ReadonlyMap<string, Map<string, number[]>> {
    return this._structFieldDimensions;
  }

  get enumMembers(): ReadonlyMap<string, Map<string, number>> {
    return this._enumMembers;
  }

  get bitmapFields(): ReadonlyMap<string, Map<string, TBitmapFieldInfo>> {
    return this._bitmapFields;
  }

  get bitmapBackingType(): ReadonlyMap<string, string> {
    return this._bitmapBackingType;
  }

  get bitmapBitWidth(): ReadonlyMap<string, number> {
    return this._bitmapBitWidth;
  }

  get scopedRegisters(): ReadonlyMap<string, string> {
    return this._scopedRegisters;
  }

  get registerMemberAccess(): ReadonlyMap<string, string> {
    return this._registerMemberAccess;
  }

  get registerMemberTypes(): ReadonlyMap<string, string> {
    return this._registerMemberTypes;
  }

  // Issue #187: Getters for register address info
  get registerBaseAddresses(): ReadonlyMap<string, string> {
    return this._registerBaseAddresses;
  }

  get registerMemberOffsets(): ReadonlyMap<string, string> {
    return this._registerMemberOffsets;
  }

  get registerMemberCTypes(): ReadonlyMap<string, string> {
    return this._registerMemberCTypes;
  }

  // Issue #232: Getter for scope variable usage analysis
  get scopeVariableUsage(): ReadonlyMap<string, Set<string>> {
    return this._scopeVariableUsage;
  }

  // Issue #282: Getter for private scope const values (for inlining)
  get scopePrivateConstValues(): ReadonlyMap<string, string> {
    return this._scopePrivateConstValues;
  }

  /**
   * Issue #232: Check if a scope variable is used in only one function.
   * Returns the function name if single-function, null otherwise.
   */
  getSingleFunctionForVariable(
    scopeName: string,
    varName: string,
  ): string | null {
    const fullVarName = `${scopeName}_${varName}`;
    const usedIn = this._scopeVariableUsage.get(fullVarName);

    if (!usedIn || usedIn.size !== 1) {
      return null;
    }

    // Extract the single element from the Set (we know it exists since size === 1)
    return [...usedIn][0];
  }

  /**
   * Create a new SymbolCollector and collect all symbols from the parse tree.
   * @param tree The C-Next program parse tree
   */
  constructor(tree: Parser.ProgramContext) {
    this.collect(tree);
  }

  /**
   * Get the C-Next type name from a type context.
   * Handles scoped types (this.Type, Scope.Type) during collection.
   */
  private getTypeName(ctx: Parser.TypeContext | null): string {
    if (!ctx) return "void";

    // ADR-016: Handle this.Type for scoped types (e.g., this.State -> Motor_State)
    if (ctx.scopedType()) {
      const typeName = ctx.scopedType()!.IDENTIFIER().getText();
      if (this._collectingScope) {
        return `${this._collectingScope}_${typeName}`;
      }
      return typeName;
    }

    // ADR-016: Handle Scope.Type from outside scope (e.g., Motor.State -> Motor_State)
    if (ctx.qualifiedType()) {
      const identifiers = ctx.qualifiedType()!.IDENTIFIER();
      const scopeName = identifiers[0].getText();
      const typeName = identifiers[1].getText();
      return `${scopeName}_${typeName}`;
    }

    if (ctx.userType()) {
      return ctx.userType()!.getText();
    }

    if (ctx.primitiveType()) {
      return ctx.primitiveType()!.getText();
    }

    return ctx.getText();
  }

  /**
   * First pass: collect all scope member names (ADR-016)
   * Collects: scopes, structs, registers, enums, bitmaps
   */
  private collect(tree: Parser.ProgramContext): void {
    // First pass: collect bitmaps (needed before registers reference them)
    for (const decl of tree.declaration()) {
      if (decl.bitmapDeclaration()) {
        this.collectBitmap(decl.bitmapDeclaration()!);
      }
      // Also collect bitmaps and structs inside scopes first
      if (decl.scopeDeclaration()) {
        const scopeDecl = decl.scopeDeclaration()!;
        const scopeName = scopeDecl.IDENTIFIER().getText();
        for (const member of scopeDecl.scopeMember()) {
          if (member.bitmapDeclaration()) {
            this.collectBitmap(member.bitmapDeclaration()!, scopeName);
          }
          // Collect scoped structs early so they're available as types
          if (member.structDeclaration()) {
            this.collectStruct(member.structDeclaration()!, scopeName);
          }
        }
      }
    }

    // Second pass: collect everything else
    for (const decl of tree.declaration()) {
      // ADR-016: Handle scope declarations (renamed from namespace)
      if (decl.scopeDeclaration()) {
        this.collectScope(decl.scopeDeclaration()!);
      }

      if (decl.structDeclaration()) {
        this.collectStruct(decl.structDeclaration()!);
      }

      // ADR-017: Handle enum declarations
      if (decl.enumDeclaration()) {
        this.collectEnum(decl.enumDeclaration()!);
      }

      if (decl.registerDeclaration()) {
        this.collectRegister(decl.registerDeclaration()!);
      }
    }
  }

  /**
   * ADR-016: Collect scope declarations (renamed from namespace)
   */
  private collectScope(scopeDecl: Parser.ScopeDeclarationContext): void {
    const name = scopeDecl.IDENTIFIER().getText();
    this._knownScopes.add(name);

    // Set collecting scope for this.Type resolution
    this._collectingScope = name;

    const members = new Set<string>();
    const memberVisibility = new Map<string, TScopeMemberVisibility>();

    for (const member of scopeDecl.scopeMember()) {
      // ADR-016: Extract visibility (private by default)
      const visibility = (member.visibilityModifier()?.getText() ||
        "private") as TScopeMemberVisibility;

      if (member.variableDeclaration()) {
        const varDecl = member.variableDeclaration()!;
        const varName = varDecl.IDENTIFIER().getText();
        members.add(varName);
        memberVisibility.set(varName, visibility);

        // Issue #282: Track private const values for inlining
        const isConst = varDecl.constModifier() !== null;
        const isPrivate = visibility === "private";
        if (isConst && isPrivate && varDecl.expression()) {
          const fullName = `${name}_${varName}`;
          // Get the literal value as a string from the expression
          const exprText = varDecl.expression()!.getText();
          this._scopePrivateConstValues.set(fullName, exprText);
        }
      }

      if (member.functionDeclaration()) {
        const funcDecl = member.functionDeclaration()!;
        const funcName = funcDecl.IDENTIFIER().getText();
        members.add(funcName);
        memberVisibility.set(funcName, visibility);

        // Issue #232: Store function for usage analysis
        if (!this._scopeFunctionBodies.has(name)) {
          this._scopeFunctionBodies.set(name, []);
        }
        this._scopeFunctionBodies.get(name)!.push(funcDecl);
      }

      // ADR-017: Collect enums declared inside scopes
      if (member.enumDeclaration()) {
        const enumDecl = member.enumDeclaration()!;
        const enumName = enumDecl.IDENTIFIER().getText();
        members.add(enumName);
        memberVisibility.set(enumName, visibility);
        this.collectEnum(enumDecl, name);
      }

      // ADR-034: Bitmaps already collected in first pass, just add to members
      if (member.bitmapDeclaration()) {
        const bitmapDecl = member.bitmapDeclaration()!;
        const bitmapName = bitmapDecl.IDENTIFIER().getText();
        members.add(bitmapName);
        memberVisibility.set(bitmapName, visibility);
      }

      // Handle registers declared inside scopes
      if (member.registerDeclaration()) {
        const regDecl = member.registerDeclaration()!;
        const regName = regDecl.IDENTIFIER().getText();
        const fullRegName = `${name}_${regName}`; // Scope_RegisterName
        members.add(regName);
        memberVisibility.set(regName, visibility);

        this._knownRegisters.add(fullRegName);
        this._scopedRegisters.set(fullRegName, name);

        // Issue #187: Store base address for scoped register
        const baseAddressExpr = regDecl.expression().getText();
        this._registerBaseAddresses.set(fullRegName, baseAddressExpr);

        // Track access modifiers and types for each register member
        for (const regMember of regDecl.registerMember()) {
          const memberName = regMember.IDENTIFIER().getText();
          const accessMod = regMember.accessModifier().getText();
          const fullMemberName = `${fullRegName}_${memberName}`; // Scope_Register_Member
          this._registerMemberAccess.set(fullMemberName, accessMod);

          // Issue #187: Store member offset and C type for scoped register
          const offsetExpr = regMember.expression().getText();
          this._registerMemberOffsets.set(fullMemberName, offsetExpr);

          const typeName = this.getTypeName(regMember.type());
          const cType = this.cnextTypeToCType(typeName);
          this._registerMemberCTypes.set(fullMemberName, cType);

          // Track register member type (especially for bitmap types)
          const scopedTypeName = `${name}_${typeName}`;
          if (this._knownBitmaps.has(scopedTypeName)) {
            this._registerMemberTypes.set(fullMemberName, scopedTypeName);
          } else if (this._knownBitmaps.has(typeName)) {
            this._registerMemberTypes.set(fullMemberName, typeName);
          }
        }
      }

      // Handle struct declarations inside scopes
      // Note: Struct collection happens in first pass for early availability,
      // but we still need to add to scope members and visibility here
      if (member.structDeclaration()) {
        const structDecl = member.structDeclaration()!;
        const structName = structDecl.IDENTIFIER().getText();
        members.add(structName);
        memberVisibility.set(structName, visibility);
        // Note: collectStruct already called in first pass
      }
    }

    this._scopeMembers.set(name, members);
    this._scopeMemberVisibility.set(name, memberVisibility);

    // Issue #232: Analyze which functions use which scope variables
    this.analyzeScopeVariableUsage(name, members);

    // Clear collecting scope
    this._collectingScope = null;
  }

  /**
   * Issue #232: Analyze which scope variables are used in which functions.
   * Issue #233: Also track which variables are WRITTEN to (for reset injection).
   * This enables making single-function variables local instead of file-scope.
   */
  private analyzeScopeVariableUsage(
    scopeName: string,
    members: Set<string>,
  ): void {
    const functions = this._scopeFunctionBodies.get(scopeName);
    if (!functions) return;

    // Collect all variable names (non-function members)
    const variableNames = new Set<string>();
    for (const member of members) {
      // Check if this is a function by seeing if we have it in the function list
      const isFuncMember = functions.some(
        (f) => f.IDENTIFIER().getText() === member,
      );
      if (!isFuncMember) {
        variableNames.add(member);
      }
    }

    // For each function, find which variables it references and writes
    for (const funcDecl of functions) {
      const funcName = funcDecl.IDENTIFIER().getText();
      const block = funcDecl.block();
      if (!block) continue;

      // Find all this.varName references in the function body (reads + writes)
      const usedVars = this.findScopedMemberReferences(block, variableNames);

      // Record usage
      for (const varName of usedVars) {
        const fullVarName = `${scopeName}_${varName}`;
        if (!this._scopeVariableUsage.has(fullVarName)) {
          this._scopeVariableUsage.set(fullVarName, new Set());
        }
        this._scopeVariableUsage.get(fullVarName)!.add(funcName);
      }
    }
  }

  /**
   * Issue #232: Recursively find all this.varName references in an AST node.
   * Returns a set of variable names that are referenced.
   *
   * `this.temp` parses as PostfixExpressionContext with:
   * - primaryExpression: 'this'
   * - postfixOp[0]: '.temp'
   */
  private findScopedMemberReferences(
    node: ParserRuleContext,
    variableNames: Set<string>,
  ): Set<string> {
    const found = new Set<string>();

    // Check if this node is a PostfixExpression with 'this' primary
    if (node instanceof Parser.PostfixExpressionContext) {
      const primary = node.primaryExpression();
      if (primary && primary.getText() === "this") {
        // Get the first postfixOp - it should be .memberName
        const ops = node.postfixOp();
        if (ops.length > 0) {
          const firstOp = ops[0];
          const identifier = firstOp.IDENTIFIER();
          if (identifier) {
            const memberName = identifier.getText();
            if (variableNames.has(memberName)) {
              found.add(memberName);
            }
          }
        }
      }
    }

    // Issue #387: Check this.* patterns in assignment target context (unified grammar)
    // The old ThisAccessContext, ThisMemberAccessContext, ThisArrayAccessContext
    // are now unified into AssignmentTargetContext with THIS() and postfixTargetOp()
    if (node instanceof Parser.AssignmentTargetContext) {
      if (node.THIS() !== null) {
        // this.member - the identifier after 'this.' is our member
        const identifier = node.IDENTIFIER();
        if (identifier) {
          const memberName = identifier.getText();
          if (variableNames.has(memberName)) {
            found.add(memberName);
          }
        }
      }
    }

    // Recursively check all children using .children property.
    // Type assertion needed because antlr4ng's ParserRuleContext doesn't expose
    // .children in its public type definitions, but it exists at runtime.
    const children = (node as { children?: unknown[] }).children;
    if (children) {
      for (const child of children) {
        if (child instanceof ParserRuleContext) {
          const childFound = this.findScopedMemberReferences(
            child,
            variableNames,
          );
          for (const v of childFound) {
            found.add(v);
          }
        }
      }
    }

    return found;
  }

  /**
   * Collect struct declarations and track field types
   * @param structDecl The struct declaration context
   * @param scopeName Optional scope name for scoped struct declarations
   */
  private collectStruct(
    structDecl: Parser.StructDeclarationContext,
    scopeName?: string,
  ): void {
    const name = structDecl.IDENTIFIER().getText();
    const fullName = scopeName ? `${scopeName}_${name}` : name;
    this._knownStructs.add(fullName);

    const fields = new Map<string, string>();
    const arrayFields = new Set<string>();
    const fieldDimensions = new Map<string, number[]>();

    for (const member of structDecl.structMember()) {
      const fieldName = member.IDENTIFIER().getText();
      const typeCtx = member.type();
      const fieldType = this.getTypeName(typeCtx);
      fields.set(fieldName, fieldType);

      const arrayDims = member.arrayDimension();
      const dimensions: number[] = [];

      // Check if this is a string type
      if (typeCtx.stringType()) {
        const stringCtx = typeCtx.stringType()!;
        const intLiteral = stringCtx.INTEGER_LITERAL();

        if (intLiteral) {
          const capacity = parseInt(intLiteral.getText(), 10);

          // If there are array dimensions, they come BEFORE string capacity
          if (arrayDims.length > 0) {
            for (const dim of arrayDims) {
              const sizeExpr = dim.expression();
              if (sizeExpr) {
                const size = parseInt(sizeExpr.getText(), 10);
                if (!isNaN(size)) {
                  dimensions.push(size);
                }
              }
            }
          }
          // Always add string capacity as final dimension
          dimensions.push(capacity + 1);
          arrayFields.add(fieldName);
        }
      } else if (arrayDims.length > 0) {
        // Non-string array (existing logic)
        arrayFields.add(fieldName);
        for (const dim of arrayDims) {
          const sizeExpr = dim.expression();
          if (sizeExpr) {
            const size = parseInt(sizeExpr.getText(), 10);
            if (!isNaN(size)) {
              dimensions.push(size);
            }
          }
        }
      }

      if (dimensions.length > 0) {
        fieldDimensions.set(fieldName, dimensions);
      }
    }

    this._structFields.set(fullName, fields);
    this._structFieldArrays.set(fullName, arrayFields);
    this._structFieldDimensions.set(fullName, fieldDimensions);
  }

  /**
   * Collect register declarations
   */
  private collectRegister(regDecl: Parser.RegisterDeclarationContext): void {
    const regName = regDecl.IDENTIFIER().getText();
    this._knownRegisters.add(regName);

    // Issue #187: Store base address for width-appropriate memory access
    const baseAddressExpr = regDecl.expression().getText();
    this._registerBaseAddresses.set(regName, baseAddressExpr);

    // Track access modifiers and types for each register member
    for (const member of regDecl.registerMember()) {
      const memberName = member.IDENTIFIER().getText();
      const accessMod = member.accessModifier().getText(); // rw, ro, wo, w1c, w1s
      const fullName = `${regName}_${memberName}`;
      this._registerMemberAccess.set(fullName, accessMod);

      // Issue #187: Store member offset and C type
      const offsetExpr = member.expression().getText();
      this._registerMemberOffsets.set(fullName, offsetExpr);

      const typeName = this.getTypeName(member.type());
      const cType = this.cnextTypeToCType(typeName);
      this._registerMemberCTypes.set(fullName, cType);

      // ADR-034: Track register member type (especially for bitmap types)
      if (this._knownBitmaps.has(typeName)) {
        this._registerMemberTypes.set(fullName, typeName);
      }
    }
  }

  /**
   * Issue #187: Convert C-Next type to C type string
   */
  private cnextTypeToCType(typeName: string): string {
    const typeMap: Record<string, string> = {
      u8: "uint8_t",
      u16: "uint16_t",
      u32: "uint32_t",
      u64: "uint64_t",
      i8: "int8_t",
      i16: "int16_t",
      i32: "int32_t",
      i64: "int64_t",
    };
    return typeMap[typeName] || typeName;
  }

  /**
   * ADR-017: Collect enum declaration and track members
   */
  private collectEnum(
    enumDecl: Parser.EnumDeclarationContext,
    scopeName?: string,
  ): void {
    const name = enumDecl.IDENTIFIER().getText();
    const fullName = scopeName ? `${scopeName}_${name}` : name;
    this._knownEnums.add(fullName);

    // Collect member values
    const members = new Map<string, number>();
    let currentValue = 0;

    for (const member of enumDecl.enumMember()) {
      const memberName = member.IDENTIFIER().getText();

      if (member.expression()) {
        // Explicit value with <-
        const valueText = member.expression()!.getText();
        const value = this.evaluateConstantExpression(valueText);
        if (value < 0) {
          throw new Error(
            `Error: Negative values not allowed in enum (found ${value} in ${fullName}.${memberName})`,
          );
        }
        currentValue = value;
      }

      members.set(memberName, currentValue);
      currentValue++;
    }

    this._enumMembers.set(fullName, members);
  }

  /**
   * ADR-034: Collect bitmap declaration and validate total bits
   */
  private collectBitmap(
    bitmapDecl: Parser.BitmapDeclarationContext,
    scopeName?: string,
  ): void {
    const name = bitmapDecl.IDENTIFIER().getText();
    const fullName = scopeName ? `${scopeName}_${name}` : name;
    const bitmapType = bitmapDecl.bitmapType().getText();
    const expectedBits = BITMAP_SIZE[bitmapType];

    this._knownBitmaps.add(fullName);
    this._bitmapBackingType.set(fullName, BITMAP_BACKING_TYPE[bitmapType]);
    this._bitmapBitWidth.set(fullName, expectedBits);

    // Collect fields and validate total bits
    const fields = new Map<string, TBitmapFieldInfo>();
    let totalBits = 0;

    for (const member of bitmapDecl.bitmapMember()) {
      const fieldName = member.IDENTIFIER().getText();
      const widthLiteral = member.INTEGER_LITERAL();
      const width = widthLiteral ? parseInt(widthLiteral.getText(), 10) : 1;

      fields.set(fieldName, { offset: totalBits, width });
      totalBits += width;
    }

    // Validate total bits equals bitmap size
    if (totalBits !== expectedBits) {
      throw new Error(
        `Error: Bitmap '${fullName}' has ${totalBits} bits but ${bitmapType} requires exactly ${expectedBits} bits`,
      );
    }

    this._bitmapFields.set(fullName, fields);
  }

  /**
   * ADR-017: Evaluate constant expression for enum values
   */
  private evaluateConstantExpression(expr: string): number {
    // Handle hex literals
    if (expr.startsWith("0x") || expr.startsWith("0X")) {
      return parseInt(expr, 16);
    }
    // Handle binary literals
    if (expr.startsWith("0b") || expr.startsWith("0B")) {
      return parseInt(expr.substring(2), 2);
    }
    // Handle decimal
    const value = parseInt(expr, 10);
    if (isNaN(value)) {
      throw new Error(`Error: Invalid constant expression in enum: ${expr}`);
    }
    return value;
  }

  /**
   * Issue #230: Check if any scope members are public (exported)
   * Used to determine if a self-include header is needed for extern "C" linkage
   */
  hasPublicSymbols(): boolean {
    for (const [, visibilityMap] of this._scopeMemberVisibility) {
      for (const [, visibility] of visibilityMap) {
        if (visibility === "public") {
          return true;
        }
      }
    }
    return false;
  }
}

export default SymbolCollector;
