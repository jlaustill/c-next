/**
 * C-Next Symbol Collector
 * Extracts symbols from C-Next parse trees for the unified symbol table
 */

import * as Parser from "../parser/grammar/CNextParser";
import ISymbol from "../types/ISymbol";
import ESymbolKind from "../types/ESymbolKind";
import ESourceLanguage from "../types/ESourceLanguage";

/**
 * Collects symbols from a C-Next parse tree
 */
class CNextSymbolCollector {
  private sourceFile: string;

  private symbols: ISymbol[] = [];

  constructor(sourceFile: string) {
    this.sourceFile = sourceFile;
  }

  /**
   * Collect all symbols from a C-Next program
   */
  collect(tree: Parser.ProgramContext): ISymbol[] {
    this.symbols = [];

    for (const decl of tree.declaration()) {
      this.collectDeclaration(decl);
    }

    return this.symbols;
  }

  private collectDeclaration(decl: Parser.DeclarationContext): void {
    // ADR-016: Handle scope declarations (renamed from namespace)
    if (decl.scopeDeclaration()) {
      this.collectScope(decl.scopeDeclaration()!);
    }

    if (decl.structDeclaration()) {
      this.collectStruct(decl.structDeclaration()!);
    }

    if (decl.registerDeclaration()) {
      this.collectRegister(decl.registerDeclaration()!);
    }

    if (decl.functionDeclaration()) {
      this.collectFunction(decl.functionDeclaration()!, undefined);
    }

    if (decl.variableDeclaration()) {
      this.collectVariable(decl.variableDeclaration()!, undefined);
    }

    // ADR-034: Handle bitmap declarations
    if (decl.bitmapDeclaration()) {
      this.collectBitmap(decl.bitmapDeclaration()!, undefined);
    }

    // Issue #220: Handle enum declarations for header generation
    if (decl.enumDeclaration()) {
      this.collectEnum(decl.enumDeclaration()!, undefined);
    }
  }

  // ADR-016: Collect scope declarations (renamed from namespace)
  private collectScope(scopeDecl: Parser.ScopeDeclarationContext): void {
    const name = scopeDecl.IDENTIFIER().getText();
    const line = scopeDecl.start?.line ?? 0;

    this.symbols.push({
      name,
      kind: ESymbolKind.Namespace, // Keep as Namespace kind for backwards compat
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
    });

    // Collect scope members
    for (const member of scopeDecl.scopeMember()) {
      // Issue #218: Check visibility modifier - default is "private"
      const visibilityMod = member.visibilityModifier();
      const visibility = visibilityMod?.getText() ?? "private";
      const isPublic = visibility === "public";

      if (member.variableDeclaration()) {
        this.collectVariable(member.variableDeclaration()!, name, isPublic);
      }
      if (member.functionDeclaration()) {
        this.collectFunction(member.functionDeclaration()!, name, isPublic);
      }
      // ADR-034: Handle bitmap declarations in scopes
      if (member.bitmapDeclaration()) {
        this.collectBitmap(member.bitmapDeclaration()!, name, isPublic);
      }
      // Handle register declarations in scopes
      if (member.registerDeclaration()) {
        this.collectScopedRegister(
          member.registerDeclaration()!,
          name,
          isPublic,
        );
      }
      // Issue #220: Handle enum declarations in scopes
      if (member.enumDeclaration()) {
        this.collectEnum(member.enumDeclaration()!, name, isPublic);
      }
    }
  }

  // Collect scoped register declarations (e.g., scope.register -> Scope_Register)
  // Issue #218: isPublic parameter controls header export
  private collectScopedRegister(
    reg: Parser.RegisterDeclarationContext,
    scopeName: string,
    isPublic: boolean = true,
  ): void {
    const regName = reg.IDENTIFIER().getText();
    const fullName = `${scopeName}_${regName}`;
    const line = reg.start?.line ?? 0;

    this.symbols.push({
      name: fullName,
      kind: ESymbolKind.Register,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: isPublic,
      parent: scopeName,
    });

    // Collect register members with full scoped prefix
    for (const member of reg.registerMember()) {
      const memberName = member.IDENTIFIER().getText();
      const memberLine = member.start?.line ?? 0;
      const accessMod = member.accessModifier().getText();
      const memberType = member.type()?.getText() ?? "u32";

      this.symbols.push({
        name: `${fullName}_${memberName}`,
        kind: ESymbolKind.RegisterMember,
        type: memberType,
        sourceFile: this.sourceFile,
        sourceLine: memberLine,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: isPublic,
        parent: fullName,
        accessModifier: accessMod,
      });
    }
  }

  private collectStruct(struct: Parser.StructDeclarationContext): void {
    const name = struct.IDENTIFIER().getText();
    const line = struct.start?.line ?? 0;

    this.symbols.push({
      name,
      kind: ESymbolKind.Struct,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
    });
  }

  private collectRegister(reg: Parser.RegisterDeclarationContext): void {
    const name = reg.IDENTIFIER().getText();
    const line = reg.start?.line ?? 0;

    this.symbols.push({
      name,
      kind: ESymbolKind.Register,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
    });

    // Collect register members
    for (const member of reg.registerMember()) {
      const memberName = member.IDENTIFIER().getText();
      const memberLine = member.start?.line ?? 0;
      const accessMod = member.accessModifier().getText();
      const memberType = member.type()?.getText() ?? "u32";

      this.symbols.push({
        name: `${name}_${memberName}`,
        kind: ESymbolKind.RegisterMember,
        type: memberType,
        sourceFile: this.sourceFile,
        sourceLine: memberLine,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: name,
        accessModifier: accessMod,
      });
    }
  }

  // ADR-034: Collect bitmap declarations
  // Issue #218: isPublic parameter controls header export
  private collectBitmap(
    bitmap: Parser.BitmapDeclarationContext,
    parent: string | undefined,
    isPublic: boolean = true,
  ): void {
    const name = bitmap.IDENTIFIER().getText();
    const line = bitmap.start?.line ?? 0;
    const bitmapType = bitmap.bitmapType().getText();
    const fullName = parent ? `${parent}_${name}` : name;

    // Add the bitmap type symbol
    this.symbols.push({
      name: fullName,
      kind: ESymbolKind.Bitmap,
      type: bitmapType,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: isPublic,
      parent,
    });

    // Collect bitmap fields
    let bitOffset = 0;
    for (const member of bitmap.bitmapMember()) {
      const fieldName = member.IDENTIFIER().getText();
      const fieldLine = member.start?.line ?? line;

      // Get field width: default 1 bit, or explicit [N]
      let width = 1;
      const intLiteral = member.INTEGER_LITERAL();
      if (intLiteral) {
        width = parseInt(intLiteral.getText(), 10);
      }

      // Calculate bit range for display
      const bitEnd = bitOffset + width - 1;
      const bitRange =
        width === 1 ? `bit ${bitOffset}` : `bits ${bitOffset}-${bitEnd}`;

      this.symbols.push({
        name: `${fullName}_${fieldName}`,
        kind: ESymbolKind.BitmapField,
        type:
          width === 1 ? "bool" : `u${width <= 8 ? 8 : width <= 16 ? 16 : 32}`,
        sourceFile: this.sourceFile,
        sourceLine: fieldLine,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: isPublic,
        parent: fullName,
        signature: `${bitRange} (${width} bit${width > 1 ? "s" : ""})`,
      });

      bitOffset += width;
    }
  }

  // Issue #220: Collect enum declarations for header generation
  private collectEnum(
    enumDecl: Parser.EnumDeclarationContext,
    parent: string | undefined,
    isPublic: boolean = true,
  ): void {
    const name = enumDecl.IDENTIFIER().getText();
    const line = enumDecl.start?.line ?? 0;
    const fullName = parent ? `${parent}_${name}` : name;

    this.symbols.push({
      name: fullName,
      kind: ESymbolKind.Enum,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: isPublic,
      parent,
    });
  }

  // Issue #218: isPublic parameter controls header export
  private collectFunction(
    func: Parser.FunctionDeclarationContext,
    parent: string | undefined,
    isPublic: boolean = true,
  ): void {
    const name = func.IDENTIFIER().getText();
    const line = func.start?.line ?? 0;
    const returnType = func.type()?.getText() ?? "void";
    const fullName = parent ? `${parent}_${name}` : name;

    // Build signature for overload detection
    const params = func.parameterList()?.parameter() ?? [];
    const paramTypes = params.map((p) => p.type()?.getText() ?? "unknown");
    const signature = `${returnType} ${fullName}(${paramTypes.join(", ")})`;

    // Build parameter info for header generation (ADR-030 compliance)
    const parameters = params.map((p) => {
      const arrayDims = p.arrayDimension();
      const dimensions = arrayDims.map((d) => {
        const text = d.getText();
        const match = text.match(/\[(\d*)\]/);
        return match ? match[1] : ""; // "" means unbounded array
      });

      return {
        name: p.IDENTIFIER().getText(),
        type: p.type()?.getText() ?? "unknown",
        isConst: !!p.constModifier(),
        isArray: arrayDims.length > 0,
        arrayDimensions: dimensions.length > 0 ? dimensions : undefined,
      };
    });

    this.symbols.push({
      name: fullName,
      kind: ESymbolKind.Function,
      type: returnType,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: isPublic,
      parent,
      signature,
      parameters,
    });

    // Collect function parameters as symbols for hover support
    for (const param of params) {
      const paramName = param.IDENTIFIER().getText();
      const paramLine = param.start?.line ?? line;
      const paramType = param.type()?.getText() ?? "unknown";
      const arrayDims = param.arrayDimension();
      const isArray = arrayDims.length > 0;
      const displayType = isArray ? `${paramType}[]` : paramType;

      this.symbols.push({
        name: paramName,
        kind: ESymbolKind.Variable,
        type: displayType,
        sourceFile: this.sourceFile,
        sourceLine: paramLine,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: false,
        parent: fullName, // Parent is the function
      });
    }
  }

  // Issue #218: isPublic parameter controls header export
  private collectVariable(
    varDecl: Parser.VariableDeclarationContext,
    parent: string | undefined,
    isPublic: boolean = true,
  ): void {
    const name = varDecl.IDENTIFIER().getText();
    const line = varDecl.start?.line ?? 0;
    const typeCtx = varDecl.type();
    const varType = typeCtx ? typeCtx.getText() : "unknown";
    const fullName = parent ? `${parent}_${name}` : name;

    // Check for array (ADR-036: arrayDimension() now returns array for multi-dim)
    const arrayDims = varDecl.arrayDimension();
    let size: number | undefined;
    if (arrayDims.length > 0) {
      // Get first dimension size for symbol tracking
      const dimText = arrayDims[0].getText();
      const match = dimText.match(/\[(\d+)\]/);
      if (match) {
        size = parseInt(match[1], 10);
      }
    }

    // Issue #288: Capture const modifier for extern declarations
    const isConst = varDecl.constModifier() !== null;

    this.symbols.push({
      name: fullName,
      kind: ESymbolKind.Variable,
      type: varType,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: isPublic,
      parent,
      size,
      isConst,
    });
  }
}

export default CNextSymbolCollector;
