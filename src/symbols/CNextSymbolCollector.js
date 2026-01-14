"use strict";
/**
 * C-Next Symbol Collector
 * Extracts symbols from C-Next parse trees for the unified symbol table
 */
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const ESymbolKind_1 = __importDefault(require("../types/ESymbolKind"));
const ESourceLanguage_1 = __importDefault(require("../types/ESourceLanguage"));
/**
 * Collects symbols from a C-Next parse tree
 */
class CNextSymbolCollector {
  sourceFile;
  symbols = [];
  constructor(sourceFile) {
    this.sourceFile = sourceFile;
  }
  /**
   * Collect all symbols from a C-Next program
   */
  collect(tree) {
    this.symbols = [];
    for (const decl of tree.declaration()) {
      this.collectDeclaration(decl);
    }
    return this.symbols;
  }
  collectDeclaration(decl) {
    // ADR-016: Handle scope declarations (renamed from namespace)
    if (decl.scopeDeclaration()) {
      this.collectScope(decl.scopeDeclaration());
    }
    if (decl.structDeclaration()) {
      this.collectStruct(decl.structDeclaration());
    }
    if (decl.registerDeclaration()) {
      this.collectRegister(decl.registerDeclaration());
    }
    if (decl.functionDeclaration()) {
      this.collectFunction(decl.functionDeclaration(), undefined);
    }
    if (decl.variableDeclaration()) {
      this.collectVariable(decl.variableDeclaration(), undefined);
    }
    // ADR-034: Handle bitmap declarations
    if (decl.bitmapDeclaration()) {
      this.collectBitmap(decl.bitmapDeclaration(), undefined);
    }
  }
  // ADR-016: Collect scope declarations (renamed from namespace)
  collectScope(scopeDecl) {
    const name = scopeDecl.IDENTIFIER().getText();
    const line = scopeDecl.start?.line ?? 0;
    this.symbols.push({
      name,
      kind: ESymbolKind_1.default.Namespace, // Keep as Namespace kind for backwards compat
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage_1.default.CNext,
      isExported: true,
    });
    // Collect scope members
    for (const member of scopeDecl.scopeMember()) {
      if (member.variableDeclaration()) {
        this.collectVariable(member.variableDeclaration(), name);
      }
      if (member.functionDeclaration()) {
        this.collectFunction(member.functionDeclaration(), name);
      }
      // ADR-034: Handle bitmap declarations in scopes
      if (member.bitmapDeclaration()) {
        this.collectBitmap(member.bitmapDeclaration(), name);
      }
      // Handle register declarations in scopes
      if (member.registerDeclaration()) {
        this.collectScopedRegister(member.registerDeclaration(), name);
      }
    }
  }
  // Collect scoped register declarations (e.g., scope.register -> Scope_Register)
  collectScopedRegister(reg, scopeName) {
    const regName = reg.IDENTIFIER().getText();
    const fullName = `${scopeName}_${regName}`;
    const line = reg.start?.line ?? 0;
    this.symbols.push({
      name: fullName,
      kind: ESymbolKind_1.default.Register,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage_1.default.CNext,
      isExported: true,
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
        kind: ESymbolKind_1.default.RegisterMember,
        type: memberType,
        sourceFile: this.sourceFile,
        sourceLine: memberLine,
        sourceLanguage: ESourceLanguage_1.default.CNext,
        isExported: true,
        parent: fullName,
        accessModifier: accessMod,
      });
    }
  }
  collectStruct(struct) {
    const name = struct.IDENTIFIER().getText();
    const line = struct.start?.line ?? 0;
    this.symbols.push({
      name,
      kind: ESymbolKind_1.default.Struct,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage_1.default.CNext,
      isExported: true,
    });
  }
  collectRegister(reg) {
    const name = reg.IDENTIFIER().getText();
    const line = reg.start?.line ?? 0;
    this.symbols.push({
      name,
      kind: ESymbolKind_1.default.Register,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage_1.default.CNext,
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
        kind: ESymbolKind_1.default.RegisterMember,
        type: memberType,
        sourceFile: this.sourceFile,
        sourceLine: memberLine,
        sourceLanguage: ESourceLanguage_1.default.CNext,
        isExported: true,
        parent: name,
        accessModifier: accessMod,
      });
    }
  }
  // ADR-034: Collect bitmap declarations
  collectBitmap(bitmap, parent) {
    const name = bitmap.IDENTIFIER().getText();
    const line = bitmap.start?.line ?? 0;
    const bitmapType = bitmap.bitmapType().getText();
    const fullName = parent ? `${parent}_${name}` : name;
    // Add the bitmap type symbol
    this.symbols.push({
      name: fullName,
      kind: ESymbolKind_1.default.Bitmap,
      type: bitmapType,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage_1.default.CNext,
      isExported: true,
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
        kind: ESymbolKind_1.default.BitmapField,
        type:
          width === 1 ? "bool" : `u${width <= 8 ? 8 : width <= 16 ? 16 : 32}`,
        sourceFile: this.sourceFile,
        sourceLine: fieldLine,
        sourceLanguage: ESourceLanguage_1.default.CNext,
        isExported: true,
        parent: fullName,
        signature: `${bitRange} (${width} bit${width > 1 ? "s" : ""})`,
      });
      bitOffset += width;
    }
  }
  collectFunction(func, parent) {
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
      kind: ESymbolKind_1.default.Function,
      type: returnType,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage_1.default.CNext,
      isExported: true,
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
        kind: ESymbolKind_1.default.Variable,
        type: displayType,
        sourceFile: this.sourceFile,
        sourceLine: paramLine,
        sourceLanguage: ESourceLanguage_1.default.CNext,
        isExported: false,
        parent: fullName, // Parent is the function
      });
    }
  }
  collectVariable(varDecl, parent) {
    const name = varDecl.IDENTIFIER().getText();
    const line = varDecl.start?.line ?? 0;
    const typeCtx = varDecl.type();
    const varType = typeCtx ? typeCtx.getText() : "unknown";
    const fullName = parent ? `${parent}_${name}` : name;
    // Check for array (ADR-036: arrayDimension() now returns array for multi-dim)
    const arrayDims = varDecl.arrayDimension();
    let size;
    if (arrayDims.length > 0) {
      // Get first dimension size for symbol tracking
      const dimText = arrayDims[0].getText();
      const match = dimText.match(/\[(\d+)\]/);
      if (match) {
        size = parseInt(match[1], 10);
      }
    }
    this.symbols.push({
      name: fullName,
      kind: ESymbolKind_1.default.Variable,
      type: varType,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage_1.default.CNext,
      isExported: true,
      parent,
      size,
    });
  }
}
exports.default = CNextSymbolCollector;
