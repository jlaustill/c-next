/**
 * SymbolCollector - Extracts and catalogs all type and symbol declarations
 * from a C-Next parse tree for use by CodeGenerator and TypeResolver.
 *
 * Issue #60: Extracted from CodeGenerator for better separation of concerns.
 */

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
  private _structFields: Map<string, Map<string, string>> = new Map();
  private _structFieldArrays: Map<string, Set<string>> = new Map();
  private _structFieldDimensions: Map<string, Map<string, number[]>> =
    new Map();
  private _enumMembers: Map<string, Map<string, number>> = new Map();
  private _bitmapFields: Map<string, Map<string, TBitmapFieldInfo>> = new Map();
  private _bitmapBackingType: Map<string, string> = new Map();
  private _scopedRegisters: Map<string, string> = new Map();
  private _registerMemberAccess: Map<string, string> = new Map();
  private _registerMemberTypes: Map<string, string> = new Map();

  // For scope context during collection (used by getTypeName)
  private _collectingScope: string | null = null;

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

  get scopedRegisters(): ReadonlyMap<string, string> {
    return this._scopedRegisters;
  }

  get registerMemberAccess(): ReadonlyMap<string, string> {
    return this._registerMemberAccess;
  }

  get registerMemberTypes(): ReadonlyMap<string, string> {
    return this._registerMemberTypes;
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
      // Also collect bitmaps inside scopes first
      if (decl.scopeDeclaration()) {
        const scopeDecl = decl.scopeDeclaration()!;
        const scopeName = scopeDecl.IDENTIFIER().getText();
        for (const member of scopeDecl.scopeMember()) {
          if (member.bitmapDeclaration()) {
            this.collectBitmap(member.bitmapDeclaration()!, scopeName);
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

    for (const member of scopeDecl.scopeMember()) {
      if (member.variableDeclaration()) {
        members.add(member.variableDeclaration()!.IDENTIFIER().getText());
      }

      if (member.functionDeclaration()) {
        const funcDecl = member.functionDeclaration()!;
        const funcName = funcDecl.IDENTIFIER().getText();
        members.add(funcName);
      }

      // ADR-017: Collect enums declared inside scopes
      if (member.enumDeclaration()) {
        const enumDecl = member.enumDeclaration()!;
        const enumName = enumDecl.IDENTIFIER().getText();
        members.add(enumName);
        this.collectEnum(enumDecl, name);
      }

      // ADR-034: Bitmaps already collected in first pass, just add to members
      if (member.bitmapDeclaration()) {
        const bitmapDecl = member.bitmapDeclaration()!;
        const bitmapName = bitmapDecl.IDENTIFIER().getText();
        members.add(bitmapName);
      }

      // Handle registers declared inside scopes
      if (member.registerDeclaration()) {
        const regDecl = member.registerDeclaration()!;
        const regName = regDecl.IDENTIFIER().getText();
        const fullRegName = `${name}_${regName}`; // Scope_RegisterName
        members.add(regName);

        this._knownRegisters.add(fullRegName);
        this._scopedRegisters.set(fullRegName, name);

        // Track access modifiers and types for each register member
        for (const regMember of regDecl.registerMember()) {
          const memberName = regMember.IDENTIFIER().getText();
          const accessMod = regMember.accessModifier().getText();
          const fullMemberName = `${fullRegName}_${memberName}`; // Scope_Register_Member
          this._registerMemberAccess.set(fullMemberName, accessMod);

          // Track register member type (especially for bitmap types)
          const typeName = this.getTypeName(regMember.type());
          const scopedTypeName = `${name}_${typeName}`;
          if (this._knownBitmaps.has(scopedTypeName)) {
            this._registerMemberTypes.set(fullMemberName, scopedTypeName);
          } else if (this._knownBitmaps.has(typeName)) {
            this._registerMemberTypes.set(fullMemberName, typeName);
          }
        }
      }
    }

    this._scopeMembers.set(name, members);

    // Clear collecting scope
    this._collectingScope = null;
  }

  /**
   * Collect struct declarations and track field types
   */
  private collectStruct(structDecl: Parser.StructDeclarationContext): void {
    const name = structDecl.IDENTIFIER().getText();
    this._knownStructs.add(name);

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

    this._structFields.set(name, fields);
    this._structFieldArrays.set(name, arrayFields);
    this._structFieldDimensions.set(name, fieldDimensions);
  }

  /**
   * Collect register declarations
   */
  private collectRegister(regDecl: Parser.RegisterDeclarationContext): void {
    const regName = regDecl.IDENTIFIER().getText();
    this._knownRegisters.add(regName);

    // Track access modifiers and types for each register member
    for (const member of regDecl.registerMember()) {
      const memberName = member.IDENTIFIER().getText();
      const accessMod = member.accessModifier().getText(); // rw, ro, wo, w1c, w1s
      const fullName = `${regName}_${memberName}`;
      this._registerMemberAccess.set(fullName, accessMod);

      // ADR-034: Track register member type (especially for bitmap types)
      const typeName = this.getTypeName(member.type());
      if (this._knownBitmaps.has(typeName)) {
        this._registerMemberTypes.set(fullName, typeName);
      }
    }
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
}

export default SymbolCollector;
