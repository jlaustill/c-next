/**
 * Parser for Prettier C-Next Plugin
 *
 * Wraps the ANTLR-generated parser and converts parse trees to
 * Prettier-friendly AST nodes.
 */

import {
  CharStream,
  CommonTokenStream,
  ParserRuleContext,
  Token,
  BaseErrorListener,
  RecognitionException,
  Recognizer,
  ATNSimulator,
} from "antlr4ng";
import { CNextLexer } from "../../src/parser/grammar/CNextLexer";
import { CNextParser } from "../../src/parser/grammar/CNextParser";
import * as AST from "./nodes";

/**
 * Error listener that collects syntax errors
 */
class ErrorCollector extends BaseErrorListener {
  errors: string[] = [];

  syntaxError<S extends Token, T extends ATNSimulator>(
    _recognizer: Recognizer<T>,
    _offendingSymbol: S | null,
    line: number,
    charPositionInLine: number,
    msg: string,
    _e: RecognitionException | null,
  ): void {
    this.errors.push(`${line}:${charPositionInLine} ${msg}`);
  }
}

/**
 * Parse C-Next source code into a Prettier-friendly AST
 */
function parse(text: string): AST.Program {
  const charStream = CharStream.fromString(text);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);

  // Collect errors instead of printing them
  const errorCollector = new ErrorCollector();
  lexer.removeErrorListeners();
  parser.removeErrorListeners();
  lexer.addErrorListener(errorCollector);
  parser.addErrorListener(errorCollector);

  const tree = parser.program();

  // Throw if there were parse errors - don't format broken code
  if (errorCollector.errors.length > 0) {
    throw new SyntaxError(`Parse errors:\n${errorCollector.errors.join("\n")}`);
  }

  // Extract comments for Prettier's comment attachment system
  const comments = extractComments(tokenStream);

  const program = convertProgram(tree, comments);

  // Attach comments array to root for Prettier
  // Prettier will use locStart/locEnd to attach comments to nodes
  (program as AST.Program & { comments: AST.Comment[] }).comments = comments;

  return program;
}

/**
 * Extract comments from the token stream (they're on the HIDDEN channel)
 */
function extractComments(tokenStream: CommonTokenStream): AST.Comment[] {
  const comments: AST.Comment[] = [];
  tokenStream.fill();
  const tokens = tokenStream.getTokens();

  for (const token of tokens) {
    if (token.channel === CNextLexer.HIDDEN) {
      const text = token.text || "";
      let commentType: "line" | "block" | "doc" = "line";

      if (text.startsWith("///")) {
        commentType = "doc";
      } else if (text.startsWith("/*")) {
        commentType = "block";
      }

      comments.push({
        type: "Comment",
        value: text,
        commentType,
        start: token.start,
        end: token.stop,
      });
    }
  }

  return comments;
}

// ============================================================================
// Conversion Functions
// ============================================================================

function loc(ctx: ParserRuleContext): { start: number; end: number } {
  return {
    start: ctx.start?.start ?? 0,
    end: ctx.stop?.stop ?? 0,
  };
}

function tokenLoc(token: Token | null): { start: number; end: number } {
  if (!token) return { start: 0, end: 0 };
  return { start: token.start, end: token.stop };
}

function convertProgram(
  ctx: ReturnType<CNextParser["program"]>,
  comments: AST.Comment[],
): AST.Program {
  const includes: AST.IncludeDirective[] = [];
  const preprocessor: AST.PreprocessorDirective[] = [];
  const declarations: AST.Declaration[] = [];

  // Process includes
  for (const inc of ctx.includeDirective()) {
    includes.push(convertIncludeDirective(inc));
  }

  // Process preprocessor directives
  for (const pp of ctx.preprocessorDirective()) {
    preprocessor.push(convertPreprocessorDirective(pp));
  }

  // Process declarations
  for (const decl of ctx.declaration()) {
    declarations.push(convertDeclaration(decl));
  }

  return {
    type: "Program",
    includes,
    preprocessor,
    declarations,
    comments,
    ...loc(ctx),
  };
}

function convertIncludeDirective(
  ctx: ReturnType<CNextParser["includeDirective"]>,
): AST.IncludeDirective {
  const text = ctx.getText();
  const isSystem = text.includes("<");
  const pathMatch = text.match(/<([^>]+)>|"([^"]+)"/);
  const path = pathMatch ? pathMatch[1] || pathMatch[2] : "";

  return {
    type: "IncludeDirective",
    path,
    isSystem,
    ...loc(ctx),
  };
}

function convertPreprocessorDirective(
  ctx: ReturnType<CNextParser["preprocessorDirective"]>,
): AST.PreprocessorDirective {
  const define = ctx.defineDirective();
  if (define) {
    return convertDefineDirective(define);
  }

  const conditional = ctx.conditionalDirective();
  if (conditional) {
    return convertConditionalDirective(conditional);
  }

  const pragma = ctx.pragmaDirective();
  if (pragma) {
    return convertPragmaDirective(pragma);
  }

  throw new Error("Unknown preprocessor directive");
}

function convertDefineDirective(
  ctx: ReturnType<CNextParser["defineDirective"]>,
): AST.DefineFlag | AST.DefineWithValue | AST.DefineFunction {
  const flag = ctx.DEFINE_FLAG();
  if (flag) {
    const text = flag.getText();
    const nameMatch = text.match(/#\s*define\s+(\w+)/);
    return {
      type: "DefineFlag",
      name: nameMatch ? nameMatch[1] : "",
      ...tokenLoc(flag.symbol),
    };
  }

  const withValue = ctx.DEFINE_WITH_VALUE();
  if (withValue) {
    return {
      type: "DefineWithValue",
      raw: withValue.getText(),
      ...tokenLoc(withValue.symbol),
    };
  }

  const func = ctx.DEFINE_FUNCTION();
  if (func) {
    return {
      type: "DefineFunction",
      raw: func.getText(),
      ...tokenLoc(func.symbol),
    };
  }

  throw new Error("Unknown define directive");
}

function convertConditionalDirective(
  ctx: ReturnType<CNextParser["conditionalDirective"]>,
): AST.PreprocessorDirective {
  const ifdef = ctx.IFDEF_DIRECTIVE();
  if (ifdef) {
    const text = ifdef.getText();
    const nameMatch = text.match(/#\s*ifdef\s+(\w+)/);
    return {
      type: "IfdefDirective",
      name: nameMatch ? nameMatch[1] : "",
      ...tokenLoc(ifdef.symbol),
    };
  }

  const ifndef = ctx.IFNDEF_DIRECTIVE();
  if (ifndef) {
    const text = ifndef.getText();
    const nameMatch = text.match(/#\s*ifndef\s+(\w+)/);
    return {
      type: "IfndefDirective",
      name: nameMatch ? nameMatch[1] : "",
      ...tokenLoc(ifndef.symbol),
    };
  }

  const elseDir = ctx.ELSE_DIRECTIVE();
  if (elseDir) {
    return {
      type: "ElseDirective",
      ...tokenLoc(elseDir.symbol),
    };
  }

  const endif = ctx.ENDIF_DIRECTIVE();
  if (endif) {
    return {
      type: "EndifDirective",
      ...tokenLoc(endif.symbol),
    };
  }

  throw new Error("Unknown conditional directive");
}

function convertPragmaDirective(
  ctx: ReturnType<CNextParser["pragmaDirective"]>,
): AST.PragmaTarget {
  const text = ctx.getText();
  const targetMatch = text.match(/#\s*pragma\s+target\s+(\S+)/);
  return {
    type: "PragmaTarget",
    target: targetMatch ? targetMatch[1] : "",
    ...loc(ctx),
  };
}

function convertDeclaration(
  ctx: ReturnType<CNextParser["declaration"]>,
): AST.Declaration {
  const scope = ctx.scopeDeclaration();
  if (scope) return convertScopeDeclaration(scope);

  const register = ctx.registerDeclaration();
  if (register) return convertRegisterDeclaration(register);

  const struct = ctx.structDeclaration();
  if (struct) return convertStructDeclaration(struct);

  const enumDecl = ctx.enumDeclaration();
  if (enumDecl) return convertEnumDeclaration(enumDecl);

  const bitmap = ctx.bitmapDeclaration();
  if (bitmap) return convertBitmapDeclaration(bitmap);

  const func = ctx.functionDeclaration();
  if (func) return convertFunctionDeclaration(func);

  const variable = ctx.variableDeclaration();
  if (variable) return convertVariableDeclaration(variable);

  throw new Error("Unknown declaration type");
}

function convertScopeDeclaration(
  ctx: ReturnType<CNextParser["scopeDeclaration"]>,
): AST.ScopeDeclaration {
  const name = ctx.IDENTIFIER().getText();
  const members = ctx.scopeMember().map(convertScopeMember);

  return {
    type: "ScopeDeclaration",
    name,
    members,
    ...loc(ctx),
  };
}

function convertScopeMember(
  ctx: ReturnType<CNextParser["scopeMember"]>,
): AST.ScopeMember {
  const visibility = ctx.visibilityModifier();
  let vis: "public" | "private" | null = null;
  if (visibility) {
    vis = visibility.getText() as "public" | "private";
  }

  let declaration: AST.ScopeMember["declaration"];

  const varDecl = ctx.variableDeclaration();
  if (varDecl) declaration = convertVariableDeclaration(varDecl);

  const funcDecl = ctx.functionDeclaration();
  if (funcDecl) declaration = convertFunctionDeclaration(funcDecl);

  const enumDecl = ctx.enumDeclaration();
  if (enumDecl) declaration = convertEnumDeclaration(enumDecl);

  const bitmapDecl = ctx.bitmapDeclaration();
  if (bitmapDecl) declaration = convertBitmapDeclaration(bitmapDecl);

  const registerDecl = ctx.registerDeclaration();
  if (registerDecl) declaration = convertRegisterDeclaration(registerDecl);

  return {
    type: "ScopeMember",
    visibility: vis,
    declaration: declaration!,
    ...loc(ctx),
  };
}

function convertRegisterDeclaration(
  ctx: ReturnType<CNextParser["registerDeclaration"]>,
): AST.RegisterDeclaration {
  const name = ctx.IDENTIFIER().getText();
  const address = convertExpression(ctx.expression());
  const members = ctx.registerMember().map(convertRegisterMember);

  return {
    type: "RegisterDeclaration",
    name,
    address,
    members,
    ...loc(ctx),
  };
}

function convertRegisterMember(
  ctx: ReturnType<CNextParser["registerMember"]>,
): AST.RegisterMember {
  const name = ctx.IDENTIFIER().getText();
  const dataType = convertType(ctx.type());
  const accessMod = ctx.accessModifier();
  const access = accessMod.getText() as "rw" | "ro" | "wo" | "w1c" | "w1s";
  const offset = convertExpression(ctx.expression());

  return {
    type: "RegisterMember",
    name,
    dataType,
    access,
    offset,
    ...loc(ctx),
  };
}

function convertStructDeclaration(
  ctx: ReturnType<CNextParser["structDeclaration"]>,
): AST.StructDeclaration {
  const name = ctx.IDENTIFIER().getText();
  const members = ctx.structMember().map(convertStructMember);

  return {
    type: "StructDeclaration",
    name,
    members,
    ...loc(ctx),
  };
}

function convertStructMember(
  ctx: ReturnType<CNextParser["structMember"]>,
): AST.StructMember {
  const dataType = convertType(ctx.type());
  const name = ctx.IDENTIFIER().getText();
  // Keep null values - they represent empty dimensions like []
  const dimensions = ctx.arrayDimension().map(convertArrayDimension);

  return {
    type: "StructMember",
    dataType,
    name,
    dimensions,
    ...loc(ctx),
  };
}

function convertEnumDeclaration(
  ctx: ReturnType<CNextParser["enumDeclaration"]>,
): AST.EnumDeclaration {
  const name = ctx.IDENTIFIER().getText();
  const members = ctx.enumMember().map(convertEnumMember);

  return {
    type: "EnumDeclaration",
    name,
    members,
    ...loc(ctx),
  };
}

function convertEnumMember(
  ctx: ReturnType<CNextParser["enumMember"]>,
): AST.EnumMember {
  const name = ctx.IDENTIFIER().getText();
  const expr = ctx.expression();
  const value = expr ? convertExpression(expr) : null;

  return {
    type: "EnumMember",
    name,
    value,
    ...loc(ctx),
  };
}

function convertBitmapDeclaration(
  ctx: ReturnType<CNextParser["bitmapDeclaration"]>,
): AST.BitmapDeclaration {
  const bitmapType = ctx
    .bitmapType()
    .getText() as AST.BitmapDeclaration["bitmapType"];
  const name = ctx.IDENTIFIER().getText();
  const members = ctx.bitmapMember().map(convertBitmapMember);

  return {
    type: "BitmapDeclaration",
    bitmapType,
    name,
    members,
    ...loc(ctx),
  };
}

function convertBitmapMember(
  ctx: ReturnType<CNextParser["bitmapMember"]>,
): AST.BitmapMember {
  const name = ctx.IDENTIFIER().getText();
  const literal = ctx.INTEGER_LITERAL();
  const width = literal ? parseInt(literal.getText(), 10) : null;

  return {
    type: "BitmapMember",
    name,
    width,
    ...loc(ctx),
  };
}

function convertFunctionDeclaration(
  ctx: ReturnType<CNextParser["functionDeclaration"]>,
): AST.FunctionDeclaration {
  const returnType = convertType(ctx.type());
  const name = ctx.IDENTIFIER().getText();
  const paramList = ctx.parameterList();
  const parameters = paramList
    ? paramList.parameter().map(convertParameter)
    : [];
  const body = convertBlock(ctx.block());

  return {
    type: "FunctionDeclaration",
    returnType,
    name,
    parameters,
    body,
    ...loc(ctx),
  };
}

function convertParameter(
  ctx: ReturnType<CNextParser["parameter"]>,
): AST.Parameter {
  const isConst = ctx.constModifier() !== null;
  const dataType = convertType(ctx.type());
  const name = ctx.IDENTIFIER().getText();
  // Keep null values - they represent empty dimensions like []
  const dimensions = ctx.arrayDimension().map(convertArrayDimension);

  return {
    type: "Parameter",
    isConst,
    dataType,
    name,
    dimensions,
    ...loc(ctx),
  };
}

function convertVariableDeclaration(
  ctx: ReturnType<CNextParser["variableDeclaration"]>,
): AST.VariableDeclaration {
  const isAtomic = ctx.atomicModifier() !== null;
  const isVolatile = ctx.volatileModifier() !== null;
  const isConst = ctx.constModifier() !== null;
  const overflowMod = ctx.overflowModifier();
  const overflow = overflowMod
    ? (overflowMod.getText() as "clamp" | "wrap")
    : null;
  const dataType = convertType(ctx.type());
  const name = ctx.IDENTIFIER().getText();
  // Keep null values - they represent empty dimensions like []
  const dimensions = ctx.arrayDimension().map(convertArrayDimension);
  const expr = ctx.expression();
  const initializer = expr ? convertExpression(expr) : null;

  return {
    type: "VariableDeclaration",
    isAtomic,
    isVolatile,
    isConst,
    overflow,
    dataType,
    name,
    dimensions,
    initializer,
    ...loc(ctx),
  };
}

function convertArrayDimension(
  ctx: ReturnType<CNextParser["arrayDimension"]>,
): AST.Expression | null {
  const expr = ctx.expression();
  return expr ? convertExpression(expr) : null;
}

function convertBlock(ctx: ReturnType<CNextParser["block"]>): AST.Block {
  const statements = ctx.statement().map(convertStatement);

  return {
    type: "Block",
    statements,
    ...loc(ctx),
  };
}

function convertStatement(
  ctx: ReturnType<CNextParser["statement"]>,
): AST.Statement {
  const varDecl = ctx.variableDeclaration();
  if (varDecl) return convertVariableDeclaration(varDecl);

  const assign = ctx.assignmentStatement();
  if (assign) return convertAssignmentStatement(assign);

  const exprStmt = ctx.expressionStatement();
  if (exprStmt) return convertExpressionStatement(exprStmt);

  const ifStmt = ctx.ifStatement();
  if (ifStmt) return convertIfStatement(ifStmt);

  const whileStmt = ctx.whileStatement();
  if (whileStmt) return convertWhileStatement(whileStmt);

  const doWhile = ctx.doWhileStatement();
  if (doWhile) return convertDoWhileStatement(doWhile);

  const forStmt = ctx.forStatement();
  if (forStmt) return convertForStatement(forStmt);

  const switchStmt = ctx.switchStatement();
  if (switchStmt) return convertSwitchStatement(switchStmt);

  const returnStmt = ctx.returnStatement();
  if (returnStmt) return convertReturnStatement(returnStmt);

  const critical = ctx.criticalStatement();
  if (critical) return convertCriticalStatement(critical);

  const block = ctx.block();
  if (block) return convertBlock(block);

  throw new Error("Unknown statement type");
}

function convertAssignmentStatement(
  ctx: ReturnType<CNextParser["assignmentStatement"]>,
): AST.AssignmentStatement {
  const target = convertAssignmentTarget(ctx.assignmentTarget());
  const operator = ctx.assignmentOperator().getText();
  const value = convertExpression(ctx.expression());

  return {
    type: "AssignmentStatement",
    target,
    operator,
    value,
    ...loc(ctx),
  };
}

function convertAssignmentTarget(
  ctx: ReturnType<CNextParser["assignmentTarget"]>,
): AST.AssignmentTarget {
  const globalArray = ctx.globalArrayAccess();
  if (globalArray) return convertGlobalArrayAccess(globalArray);

  const globalMember = ctx.globalMemberAccess();
  if (globalMember) return convertGlobalMemberAccess(globalMember);

  const globalAcc = ctx.globalAccess();
  if (globalAcc) return convertGlobalAccess(globalAcc);

  const thisArray = ctx.thisArrayAccess();
  if (thisArray) return convertThisArrayAccess(thisArray);

  const thisMember = ctx.thisMemberAccess();
  if (thisMember) return convertThisMemberAccess(thisMember);

  const thisAcc = ctx.thisAccess();
  if (thisAcc) return convertThisAccess(thisAcc);

  const arrayAcc = ctx.arrayAccess();
  if (arrayAcc) return convertArrayAccess(arrayAcc);

  const memberAcc = ctx.memberAccess();
  if (memberAcc) return convertMemberAccess(memberAcc);

  const identifier = ctx.IDENTIFIER();
  if (identifier) {
    return {
      type: "Identifier",
      name: identifier.getText(),
      ...tokenLoc(identifier.symbol),
    };
  }

  throw new Error("Unknown assignment target");
}

function convertThisAccess(
  ctx: ReturnType<CNextParser["thisAccess"]>,
): AST.ThisAccess {
  const path = [ctx.IDENTIFIER().getText()];
  return {
    type: "ThisAccess",
    path,
    index: null,
    width: null,
    ...loc(ctx),
  };
}

function convertThisMemberAccess(
  ctx: ReturnType<CNextParser["thisMemberAccess"]>,
): AST.ThisAccess {
  const path = ctx.IDENTIFIER().map((id) => id.getText());
  return {
    type: "ThisAccess",
    path,
    index: null,
    width: null,
    ...loc(ctx),
  };
}

function convertThisArrayAccess(
  ctx: ReturnType<CNextParser["thisArrayAccess"]>,
): AST.ThisAccess {
  const path = ctx.IDENTIFIER().map((id) => id.getText());
  const expressions = ctx.expression();
  const index =
    expressions.length > 0 ? convertExpression(expressions[0]) : null;
  const width =
    expressions.length > 1 ? convertExpression(expressions[1]) : null;

  return {
    type: "ThisAccess",
    path,
    index,
    width,
    ...loc(ctx),
  };
}

function convertGlobalAccess(
  ctx: ReturnType<CNextParser["globalAccess"]>,
): AST.GlobalAccess {
  const path = [ctx.IDENTIFIER().getText()];
  return {
    type: "GlobalAccess",
    path,
    index: null,
    width: null,
    ...loc(ctx),
  };
}

function convertGlobalMemberAccess(
  ctx: ReturnType<CNextParser["globalMemberAccess"]>,
): AST.GlobalAccess {
  const path = ctx.IDENTIFIER().map((id) => id.getText());
  return {
    type: "GlobalAccess",
    path,
    index: null,
    width: null,
    ...loc(ctx),
  };
}

function convertGlobalArrayAccess(
  ctx: ReturnType<CNextParser["globalArrayAccess"]>,
): AST.GlobalAccess {
  const path = ctx.IDENTIFIER().map((id) => id.getText());
  const expressions = ctx.expression();
  const index =
    expressions.length > 0 ? convertExpression(expressions[0]) : null;
  const width =
    expressions.length > 1 ? convertExpression(expressions[1]) : null;

  return {
    type: "GlobalAccess",
    path,
    index,
    width,
    ...loc(ctx),
  };
}

function convertExpressionStatement(
  ctx: ReturnType<CNextParser["expressionStatement"]>,
): AST.ExpressionStatement {
  return {
    type: "ExpressionStatement",
    expression: convertExpression(ctx.expression()),
    ...loc(ctx),
  };
}

function convertIfStatement(
  ctx: ReturnType<CNextParser["ifStatement"]>,
): AST.IfStatement {
  const condition = convertExpression(ctx.expression());
  const statements = ctx.statement();
  const consequent = convertStatement(statements[0]);
  const alternate =
    statements.length > 1 ? convertStatement(statements[1]) : null;

  return {
    type: "IfStatement",
    condition,
    consequent,
    alternate,
    ...loc(ctx),
  };
}

function convertWhileStatement(
  ctx: ReturnType<CNextParser["whileStatement"]>,
): AST.WhileStatement {
  const condition = convertExpression(ctx.expression());
  const body = convertStatement(ctx.statement());

  return {
    type: "WhileStatement",
    condition,
    body,
    ...loc(ctx),
  };
}

function convertDoWhileStatement(
  ctx: ReturnType<CNextParser["doWhileStatement"]>,
): AST.DoWhileStatement {
  const body = convertBlock(ctx.block());
  const condition = convertExpression(ctx.expression());

  return {
    type: "DoWhileStatement",
    body,
    condition,
    ...loc(ctx),
  };
}

function convertForStatement(
  ctx: ReturnType<CNextParser["forStatement"]>,
): AST.ForStatement {
  const forInit = ctx.forInit();
  const init = forInit ? convertForInit(forInit) : null;
  const expr = ctx.expression();
  const condition = expr ? convertExpression(expr) : null;
  const forUpdate = ctx.forUpdate();
  const update = forUpdate ? convertForUpdate(forUpdate) : null;
  const body = convertStatement(ctx.statement());

  return {
    type: "ForStatement",
    init,
    condition,
    update,
    body,
    ...loc(ctx),
  };
}

function convertForInit(ctx: ReturnType<CNextParser["forInit"]>): AST.ForInit {
  const varDecl = ctx.forVarDecl();
  if (varDecl) {
    return convertForVarDecl(varDecl);
  }

  const assign = ctx.forAssignment();
  if (assign) {
    return convertForAssignment(assign);
  }

  throw new Error("Unknown for init type");
}

function convertForVarDecl(
  ctx: ReturnType<CNextParser["forVarDecl"]>,
): AST.ForVarDecl {
  const isAtomic = ctx.atomicModifier() !== null;
  const isVolatile = ctx.volatileModifier() !== null;
  const overflowMod = ctx.overflowModifier();
  const overflow = overflowMod
    ? (overflowMod.getText() as "clamp" | "wrap")
    : null;
  const dataType = convertType(ctx.type());
  const name = ctx.IDENTIFIER().getText();
  // Keep null values - they represent empty dimensions like []
  const dimensions = ctx.arrayDimension().map(convertArrayDimension);
  const expr = ctx.expression();
  const initializer = expr ? convertExpression(expr) : null;

  return {
    type: "ForVarDecl",
    isAtomic,
    isVolatile,
    overflow,
    dataType,
    name,
    dimensions,
    initializer,
    ...loc(ctx),
  };
}

function convertForAssignment(
  ctx: ReturnType<CNextParser["forAssignment"]>,
): AST.ForAssignment {
  const target = convertAssignmentTarget(ctx.assignmentTarget());
  const operator = ctx.assignmentOperator().getText();
  const value = convertExpression(ctx.expression());

  return {
    type: "ForAssignment",
    target,
    operator,
    value,
    ...loc(ctx),
  };
}

function convertForUpdate(
  ctx: ReturnType<CNextParser["forUpdate"]>,
): AST.ForUpdate {
  const target = convertAssignmentTarget(ctx.assignmentTarget());
  const operator = ctx.assignmentOperator().getText();
  const value = convertExpression(ctx.expression());

  return {
    type: "ForUpdate",
    target,
    operator,
    value,
    ...loc(ctx),
  };
}

function convertSwitchStatement(
  ctx: ReturnType<CNextParser["switchStatement"]>,
): AST.SwitchStatement {
  const expression = convertExpression(ctx.expression());
  const cases = ctx.switchCase().map(convertSwitchCase);
  const defaultCtx = ctx.defaultCase();
  const defaultCase = defaultCtx ? convertDefaultCase(defaultCtx) : null;

  return {
    type: "SwitchStatement",
    expression,
    cases,
    defaultCase,
    ...loc(ctx),
  };
}

function convertSwitchCase(
  ctx: ReturnType<CNextParser["switchCase"]>,
): AST.SwitchCase {
  const labels = ctx.caseLabel().map(convertCaseLabel);
  const body = convertBlock(ctx.block());

  return {
    type: "SwitchCase",
    labels,
    body,
    ...loc(ctx),
  };
}

function convertCaseLabel(
  ctx: ReturnType<CNextParser["caseLabel"]>,
): AST.CaseLabel {
  const qualified = ctx.qualifiedType();
  if (qualified) return convertQualifiedType(qualified);

  const identifier = ctx.IDENTIFIER();
  if (identifier) {
    return {
      type: "Identifier",
      name: identifier.getText(),
      ...tokenLoc(identifier.symbol),
    };
  }

  const intLiteral = ctx.INTEGER_LITERAL();
  if (intLiteral) {
    const minus = ctx.MINUS();
    const value = minus ? `-${intLiteral.getText()}` : intLiteral.getText();
    return {
      type: "Literal",
      value,
      literalType: "integer",
      ...tokenLoc(intLiteral.symbol),
    };
  }

  const hexLiteral = ctx.HEX_LITERAL();
  if (hexLiteral) {
    const minus = ctx.MINUS();
    const value = minus ? `-${hexLiteral.getText()}` : hexLiteral.getText();
    return {
      type: "Literal",
      value,
      literalType: "hex",
      ...tokenLoc(hexLiteral.symbol),
    };
  }

  const binaryLiteral = ctx.BINARY_LITERAL();
  if (binaryLiteral) {
    return {
      type: "Literal",
      value: binaryLiteral.getText(),
      literalType: "binary",
      ...tokenLoc(binaryLiteral.symbol),
    };
  }

  const charLiteral = ctx.CHAR_LITERAL();
  if (charLiteral) {
    return {
      type: "Literal",
      value: charLiteral.getText(),
      literalType: "char",
      ...tokenLoc(charLiteral.symbol),
    };
  }

  throw new Error("Unknown case label type");
}

function convertDefaultCase(
  ctx: ReturnType<CNextParser["defaultCase"]>,
): AST.DefaultCase {
  const intLiteral = ctx.INTEGER_LITERAL();
  const count = intLiteral ? parseInt(intLiteral.getText(), 10) : null;
  const body = convertBlock(ctx.block());

  return {
    type: "DefaultCase",
    count,
    body,
    ...loc(ctx),
  };
}

function convertReturnStatement(
  ctx: ReturnType<CNextParser["returnStatement"]>,
): AST.ReturnStatement {
  const expr = ctx.expression();
  const value = expr ? convertExpression(expr) : null;

  return {
    type: "ReturnStatement",
    value,
    ...loc(ctx),
  };
}

function convertCriticalStatement(
  ctx: ReturnType<CNextParser["criticalStatement"]>,
): AST.CriticalStatement {
  const body = convertBlock(ctx.block());

  return {
    type: "CriticalStatement",
    body,
    ...loc(ctx),
  };
}

// ============================================================================
// Expressions
// ============================================================================

function convertExpression(
  ctx: ReturnType<CNextParser["expression"]>,
): AST.Expression {
  return convertTernaryExpression(ctx.ternaryExpression());
}

function convertTernaryExpression(
  ctx: ReturnType<CNextParser["ternaryExpression"]>,
): AST.Expression {
  const orExpressions = ctx.orExpression();

  if (orExpressions.length === 3) {
    // Ternary: (condition) ? consequent : alternate
    return {
      type: "TernaryExpression",
      condition: convertOrExpression(orExpressions[0]),
      consequent: convertOrExpression(orExpressions[1]),
      alternate: convertOrExpression(orExpressions[2]),
      ...loc(ctx),
    };
  }

  return convertOrExpression(orExpressions[0]);
}

function convertOrExpression(
  ctx: ReturnType<CNextParser["orExpression"]>,
): AST.Expression {
  const andExprs = ctx.andExpression();
  let result = convertAndExpression(andExprs[0]);

  for (let i = 1; i < andExprs.length; i++) {
    result = {
      type: "BinaryExpression",
      operator: "||",
      left: result,
      right: convertAndExpression(andExprs[i]),
      ...loc(ctx),
    };
  }

  return result;
}

function convertAndExpression(
  ctx: ReturnType<CNextParser["andExpression"]>,
): AST.Expression {
  const eqExprs = ctx.equalityExpression();
  let result = convertEqualityExpression(eqExprs[0]);

  for (let i = 1; i < eqExprs.length; i++) {
    result = {
      type: "BinaryExpression",
      operator: "&&",
      left: result,
      right: convertEqualityExpression(eqExprs[i]),
      ...loc(ctx),
    };
  }

  return result;
}

function convertEqualityExpression(
  ctx: ReturnType<CNextParser["equalityExpression"]>,
): AST.Expression {
  const relExprs = ctx.relationalExpression();
  let result = convertRelationalExpression(relExprs[0]);

  // Get operators by checking for EQ and NEQ tokens
  const eqTokens = ctx.EQ();
  const neqTokens = ctx.NEQ();
  const operators: string[] = [];

  // Build operator list based on token positions
  for (let i = 1; i < relExprs.length; i++) {
    // Check which operator comes next
    const eqIdx = eqTokens.findIndex(
      (t) =>
        t.symbol.tokenIndex > relExprs[i - 1].stop!.tokenIndex &&
        t.symbol.tokenIndex < relExprs[i].start!.tokenIndex,
    );
    const neqIdx = neqTokens.findIndex(
      (t) =>
        t.symbol.tokenIndex > relExprs[i - 1].stop!.tokenIndex &&
        t.symbol.tokenIndex < relExprs[i].start!.tokenIndex,
    );

    if (eqIdx >= 0) {
      operators.push("=");
    } else if (neqIdx >= 0) {
      operators.push("!=");
    }
  }

  for (let i = 1; i < relExprs.length; i++) {
    result = {
      type: "BinaryExpression",
      operator: operators[i - 1] || "=",
      left: result,
      right: convertRelationalExpression(relExprs[i]),
      ...loc(ctx),
    };
  }

  return result;
}

function convertRelationalExpression(
  ctx: ReturnType<CNextParser["relationalExpression"]>,
): AST.Expression {
  const bitOrExprs = ctx.bitwiseOrExpression();
  let result = convertBitwiseOrExpression(bitOrExprs[0]);

  // Get operators
  const ltTokens = ctx.LT();
  const gtTokens = ctx.GT();
  const lteTokens = ctx.LTE();
  const gteTokens = ctx.GTE();

  for (let i = 1; i < bitOrExprs.length; i++) {
    let operator = "<";
    const prevEnd = bitOrExprs[i - 1].stop!.tokenIndex;
    const currStart = bitOrExprs[i].start!.tokenIndex;

    for (const t of lteTokens) {
      if (t.symbol.tokenIndex > prevEnd && t.symbol.tokenIndex < currStart) {
        operator = "<=";
        break;
      }
    }
    for (const t of gteTokens) {
      if (t.symbol.tokenIndex > prevEnd && t.symbol.tokenIndex < currStart) {
        operator = ">=";
        break;
      }
    }
    for (const t of ltTokens) {
      if (
        t.symbol.tokenIndex > prevEnd &&
        t.symbol.tokenIndex < currStart &&
        operator !== "<="
      ) {
        operator = "<";
        break;
      }
    }
    for (const t of gtTokens) {
      if (
        t.symbol.tokenIndex > prevEnd &&
        t.symbol.tokenIndex < currStart &&
        operator !== ">="
      ) {
        operator = ">";
        break;
      }
    }

    result = {
      type: "BinaryExpression",
      operator,
      left: result,
      right: convertBitwiseOrExpression(bitOrExprs[i]),
      ...loc(ctx),
    };
  }

  return result;
}

function convertBitwiseOrExpression(
  ctx: ReturnType<CNextParser["bitwiseOrExpression"]>,
): AST.Expression {
  const xorExprs = ctx.bitwiseXorExpression();
  let result = convertBitwiseXorExpression(xorExprs[0]);

  for (let i = 1; i < xorExprs.length; i++) {
    result = {
      type: "BinaryExpression",
      operator: "|",
      left: result,
      right: convertBitwiseXorExpression(xorExprs[i]),
      ...loc(ctx),
    };
  }

  return result;
}

function convertBitwiseXorExpression(
  ctx: ReturnType<CNextParser["bitwiseXorExpression"]>,
): AST.Expression {
  const andExprs = ctx.bitwiseAndExpression();
  let result = convertBitwiseAndExpression(andExprs[0]);

  for (let i = 1; i < andExprs.length; i++) {
    result = {
      type: "BinaryExpression",
      operator: "^",
      left: result,
      right: convertBitwiseAndExpression(andExprs[i]),
      ...loc(ctx),
    };
  }

  return result;
}

function convertBitwiseAndExpression(
  ctx: ReturnType<CNextParser["bitwiseAndExpression"]>,
): AST.Expression {
  const shiftExprs = ctx.shiftExpression();
  let result = convertShiftExpression(shiftExprs[0]);

  for (let i = 1; i < shiftExprs.length; i++) {
    result = {
      type: "BinaryExpression",
      operator: "&",
      left: result,
      right: convertShiftExpression(shiftExprs[i]),
      ...loc(ctx),
    };
  }

  return result;
}

function convertShiftExpression(
  ctx: ReturnType<CNextParser["shiftExpression"]>,
): AST.Expression {
  const addExprs = ctx.additiveExpression();
  let result = convertAdditiveExpression(addExprs[0]);

  const _lshiftTokens = ctx.LSHIFT();
  const rshiftTokens = ctx.RSHIFT();

  for (let i = 1; i < addExprs.length; i++) {
    let operator = "<<";
    const prevEnd = addExprs[i - 1].stop!.tokenIndex;
    const currStart = addExprs[i].start!.tokenIndex;

    for (const t of rshiftTokens) {
      if (t.symbol.tokenIndex > prevEnd && t.symbol.tokenIndex < currStart) {
        operator = ">>";
        break;
      }
    }

    result = {
      type: "BinaryExpression",
      operator,
      left: result,
      right: convertAdditiveExpression(addExprs[i]),
      ...loc(ctx),
    };
  }

  return result;
}

function convertAdditiveExpression(
  ctx: ReturnType<CNextParser["additiveExpression"]>,
): AST.Expression {
  const mulExprs = ctx.multiplicativeExpression();
  let result = convertMultiplicativeExpression(mulExprs[0]);

  const _plusTokens = ctx.PLUS();
  const minusTokens = ctx.MINUS();

  for (let i = 1; i < mulExprs.length; i++) {
    let operator = "+";
    const prevEnd = mulExprs[i - 1].stop!.tokenIndex;
    const currStart = mulExprs[i].start!.tokenIndex;

    for (const t of minusTokens) {
      if (t.symbol.tokenIndex > prevEnd && t.symbol.tokenIndex < currStart) {
        operator = "-";
        break;
      }
    }

    result = {
      type: "BinaryExpression",
      operator,
      left: result,
      right: convertMultiplicativeExpression(mulExprs[i]),
      ...loc(ctx),
    };
  }

  return result;
}

function convertMultiplicativeExpression(
  ctx: ReturnType<CNextParser["multiplicativeExpression"]>,
): AST.Expression {
  const unaryExprs = ctx.unaryExpression();
  let result = convertUnaryExpression(unaryExprs[0]);

  const _starTokens = ctx.STAR();
  const slashTokens = ctx.SLASH();
  const percentTokens = ctx.PERCENT();

  for (let i = 1; i < unaryExprs.length; i++) {
    let operator = "*";
    const prevEnd = unaryExprs[i - 1].stop!.tokenIndex;
    const currStart = unaryExprs[i].start!.tokenIndex;

    for (const t of slashTokens) {
      if (t.symbol.tokenIndex > prevEnd && t.symbol.tokenIndex < currStart) {
        operator = "/";
        break;
      }
    }
    for (const t of percentTokens) {
      if (t.symbol.tokenIndex > prevEnd && t.symbol.tokenIndex < currStart) {
        operator = "%";
        break;
      }
    }

    result = {
      type: "BinaryExpression",
      operator,
      left: result,
      right: convertUnaryExpression(unaryExprs[i]),
      ...loc(ctx),
    };
  }

  return result;
}

function convertUnaryExpression(
  ctx: ReturnType<CNextParser["unaryExpression"]>,
): AST.Expression {
  const notOp = ctx.NOT();
  if (notOp) {
    return {
      type: "UnaryExpression",
      operator: "!",
      operand: convertUnaryExpression(ctx.unaryExpression()!),
      ...loc(ctx),
    };
  }

  const minusOp = ctx.MINUS();
  if (minusOp) {
    return {
      type: "UnaryExpression",
      operator: "-",
      operand: convertUnaryExpression(ctx.unaryExpression()!),
      ...loc(ctx),
    };
  }

  const bitnotOp = ctx.BITNOT();
  if (bitnotOp) {
    return {
      type: "UnaryExpression",
      operator: "~",
      operand: convertUnaryExpression(ctx.unaryExpression()!),
      ...loc(ctx),
    };
  }

  const addrOp = ctx.BITAND();
  if (addrOp) {
    return {
      type: "UnaryExpression",
      operator: "&",
      operand: convertUnaryExpression(ctx.unaryExpression()!),
      ...loc(ctx),
    };
  }

  return convertPostfixExpression(ctx.postfixExpression()!);
}

function convertPostfixExpression(
  ctx: ReturnType<CNextParser["postfixExpression"]>,
): AST.Expression {
  let result = convertPrimaryExpression(ctx.primaryExpression());

  for (const op of ctx.postfixOp()) {
    const identifier = op.IDENTIFIER();
    if (identifier) {
      result = {
        type: "MemberAccess",
        object: result,
        property: identifier.getText(),
        ...loc(op),
      };
      continue;
    }

    const expressions = op.expression();
    if (expressions.length > 0 && op.LBRACKET()) {
      const index = convertExpression(expressions[0]);
      const width =
        expressions.length > 1 ? convertExpression(expressions[1]) : null;
      result = {
        type: "ArrayAccess",
        object: result,
        index,
        width,
        ...loc(op),
      };
      continue;
    }

    const argList = op.argumentList();
    if (op.LPAREN()) {
      const args = argList ? argList.expression().map(convertExpression) : [];
      result = {
        type: "CallExpression",
        callee: result,
        arguments: args,
        ...loc(op),
      };
    }
  }

  return result;
}

function convertPrimaryExpression(
  ctx: ReturnType<CNextParser["primaryExpression"]>,
): AST.Expression {
  const sizeofExpr = ctx.sizeofExpression();
  if (sizeofExpr) return convertSizeofExpression(sizeofExpr);

  const castExpr = ctx.castExpression();
  if (castExpr) return convertCastExpression(castExpr);

  const structInit = ctx.structInitializer();
  if (structInit) return convertStructInitializer(structInit);

  const arrayInit = ctx.arrayInitializer();
  if (arrayInit) return convertArrayInitializer(arrayInit);

  const thisToken = ctx.THIS();
  if (thisToken) {
    return {
      type: "Identifier",
      name: "this",
      ...tokenLoc(thisToken.symbol),
    };
  }

  const globalToken = ctx.GLOBAL();
  if (globalToken) {
    return {
      type: "Identifier",
      name: "global",
      ...tokenLoc(globalToken.symbol),
    };
  }

  const identifier = ctx.IDENTIFIER();
  if (identifier) {
    return {
      type: "Identifier",
      name: identifier.getText(),
      ...tokenLoc(identifier.symbol),
    };
  }

  const literal = ctx.literal();
  if (literal) return convertLiteral(literal);

  const parenExpr = ctx.expression();
  if (parenExpr) {
    return {
      type: "ParenExpression",
      expression: convertExpression(parenExpr),
      ...loc(ctx),
    };
  }

  throw new Error("Unknown primary expression type");
}

function convertSizeofExpression(
  ctx: ReturnType<CNextParser["sizeofExpression"]>,
): AST.SizeofExpression {
  const typeCtx = ctx.type();
  const exprCtx = ctx.expression();

  return {
    type: "SizeofExpression",
    operand: typeCtx ? convertType(typeCtx) : convertExpression(exprCtx!),
    ...loc(ctx),
  };
}

function convertCastExpression(
  ctx: ReturnType<CNextParser["castExpression"]>,
): AST.CastExpression {
  const targetType = convertType(ctx.type());
  const expression = convertUnaryExpression(ctx.unaryExpression());

  return {
    type: "CastExpression",
    targetType,
    expression,
    ...loc(ctx),
  };
}

function convertStructInitializer(
  ctx: ReturnType<CNextParser["structInitializer"]>,
): AST.StructInitializer {
  const identifier = ctx.IDENTIFIER();
  const structName = identifier ? identifier.getText() : null;
  const fieldList = ctx.fieldInitializerList();
  const fields = fieldList
    ? fieldList.fieldInitializer().map(convertFieldInitializer)
    : [];

  return {
    type: "StructInitializer",
    structName,
    fields,
    ...loc(ctx),
  };
}

function convertFieldInitializer(
  ctx: ReturnType<CNextParser["fieldInitializer"]>,
): AST.FieldInitializer {
  const name = ctx.IDENTIFIER().getText();
  const value = convertExpression(ctx.expression());

  return {
    type: "FieldInitializer",
    name,
    value,
    ...loc(ctx),
  };
}

function convertArrayInitializer(
  ctx: ReturnType<CNextParser["arrayInitializer"]>,
): AST.ArrayInitializer {
  // Check for fill-all syntax: [0*]
  if (ctx.STAR()) {
    const expr = ctx.expression();
    return {
      type: "ArrayInitializer",
      elements: [],
      fillValue: expr ? convertExpression(expr) : null,
      ...loc(ctx),
    };
  }

  // List syntax: [1, 2, 3]
  const elements = ctx.arrayInitializerElement().map((elem) => {
    const expr = elem.expression();
    if (expr) return convertExpression(expr);

    const structInit = elem.structInitializer();
    if (structInit) return convertStructInitializer(structInit);

    const arrayInit = elem.arrayInitializer();
    if (arrayInit) return convertArrayInitializer(arrayInit);

    throw new Error("Unknown array initializer element type");
  });

  return {
    type: "ArrayInitializer",
    elements,
    fillValue: null,
    ...loc(ctx),
  };
}

function convertMemberAccess(
  ctx: ReturnType<CNextParser["memberAccess"]>,
): AST.MemberAccess | AST.ArrayAccess {
  // memberAccess can have many forms including multi-dimensional arrays and chained accesses
  // We need to interleave member accesses and array accesses based on token positions

  const identifierTokens = ctx.IDENTIFIER();
  const expressions = ctx.expression();
  const dotTokens = ctx.DOT();
  const bracketTokens = ctx.LBRACKET();
  // COMMA() returns a single TerminalNode if present, not an array
  const hasComma = ctx.COMMA() !== null;

  // Build a list of operations with their positions
  type Operation =
    | { type: "member"; name: string; pos: number }
    | { type: "array"; exprIndex: number; pos: number };

  const operations: Operation[] = [];

  // Add member access operations (skip first identifier as it's the base)
  for (let i = 1; i < identifierTokens.length; i++) {
    operations.push({
      type: "member",
      name: identifierTokens[i].getText(),
      pos: dotTokens[i - 1]?.symbol.start ?? identifierTokens[i].symbol.start,
    });
  }

  // Add array access operations
  for (let i = 0; i < bracketTokens.length; i++) {
    operations.push({
      type: "array",
      exprIndex: i,
      pos: bracketTokens[i].symbol.start,
    });
  }

  // Sort by position
  operations.sort((a, b) => a.pos - b.pos);

  // Start with first identifier
  let result: AST.Expression = {
    type: "Identifier",
    name: identifierTokens[0].getText(),
    start: ctx.start?.start ?? 0,
    end: ctx.stop?.stop ?? 0,
  };

  // Apply operations in order
  for (const op of operations) {
    if (op.type === "member") {
      result = {
        type: "MemberAccess",
        object: result,
        property: op.name,
        ...loc(ctx),
      };
    } else {
      // Handle bit range vs multi-dim array
      // Bit range: single bracket with comma
      if (hasComma && bracketTokens.length === 1 && expressions.length === 2) {
        const index = convertExpression(expressions[0]);
        const width = convertExpression(expressions[1]);
        result = {
          type: "ArrayAccess",
          object: result,
          index,
          width,
          ...loc(ctx),
        };
      } else {
        result = {
          type: "ArrayAccess",
          object: result,
          index: convertExpression(expressions[op.exprIndex]),
          width: null,
          ...loc(ctx),
        };
      }
    }
  }

  return result as AST.MemberAccess | AST.ArrayAccess;
}

function convertArrayAccess(
  ctx: ReturnType<CNextParser["arrayAccess"]>,
): AST.ArrayAccess {
  const identifier = ctx.IDENTIFIER().getText();
  const expressions = ctx.expression();
  // COMMA() returns a single TerminalNode if present, not an array
  const hasComma = ctx.COMMA() !== null;

  let result: AST.Expression = {
    type: "Identifier",
    name: identifier,
    ...tokenLoc(ctx.IDENTIFIER().symbol),
  };

  if (hasComma && expressions.length === 2) {
    // Bit range syntax: [index, width]
    const index = convertExpression(expressions[0]);
    const width = convertExpression(expressions[1]);
    return {
      type: "ArrayAccess",
      object: result,
      index,
      width,
      ...loc(ctx),
    };
  } else {
    // Single array access or multi-dimensional: [i] or [i][j]
    for (let i = 0; i < expressions.length; i++) {
      result = {
        type: "ArrayAccess",
        object: result,
        index: convertExpression(expressions[i]),
        width: null,
        ...loc(ctx),
      };
    }
    return result as AST.ArrayAccess;
  }
}

function convertLiteral(ctx: ReturnType<CNextParser["literal"]>): AST.Literal {
  const suffixedDecimal = ctx.SUFFIXED_DECIMAL();
  if (suffixedDecimal) {
    return {
      type: "Literal",
      value: suffixedDecimal.getText(),
      literalType: "suffixed_decimal",
      ...tokenLoc(suffixedDecimal.symbol),
    };
  }

  const suffixedHex = ctx.SUFFIXED_HEX();
  if (suffixedHex) {
    return {
      type: "Literal",
      value: suffixedHex.getText(),
      literalType: "suffixed_hex",
      ...tokenLoc(suffixedHex.symbol),
    };
  }

  const suffixedBinary = ctx.SUFFIXED_BINARY();
  if (suffixedBinary) {
    return {
      type: "Literal",
      value: suffixedBinary.getText(),
      literalType: "suffixed_binary",
      ...tokenLoc(suffixedBinary.symbol),
    };
  }

  const suffixedFloat = ctx.SUFFIXED_FLOAT();
  if (suffixedFloat) {
    return {
      type: "Literal",
      value: suffixedFloat.getText(),
      literalType: "suffixed_float",
      ...tokenLoc(suffixedFloat.symbol),
    };
  }

  const intLiteral = ctx.INTEGER_LITERAL();
  if (intLiteral) {
    return {
      type: "Literal",
      value: intLiteral.getText(),
      literalType: "integer",
      ...tokenLoc(intLiteral.symbol),
    };
  }

  const hexLiteral = ctx.HEX_LITERAL();
  if (hexLiteral) {
    return {
      type: "Literal",
      value: hexLiteral.getText(),
      literalType: "hex",
      ...tokenLoc(hexLiteral.symbol),
    };
  }

  const binaryLiteral = ctx.BINARY_LITERAL();
  if (binaryLiteral) {
    return {
      type: "Literal",
      value: binaryLiteral.getText(),
      literalType: "binary",
      ...tokenLoc(binaryLiteral.symbol),
    };
  }

  const floatLiteral = ctx.FLOAT_LITERAL();
  if (floatLiteral) {
    return {
      type: "Literal",
      value: floatLiteral.getText(),
      literalType: "float",
      ...tokenLoc(floatLiteral.symbol),
    };
  }

  const stringLiteral = ctx.STRING_LITERAL();
  if (stringLiteral) {
    return {
      type: "Literal",
      value: stringLiteral.getText(),
      literalType: "string",
      ...tokenLoc(stringLiteral.symbol),
    };
  }

  const charLiteral = ctx.CHAR_LITERAL();
  if (charLiteral) {
    return {
      type: "Literal",
      value: charLiteral.getText(),
      literalType: "char",
      ...tokenLoc(charLiteral.symbol),
    };
  }

  if (ctx.TRUE()) {
    return {
      type: "Literal",
      value: "true",
      literalType: "bool",
      ...loc(ctx),
    };
  }

  if (ctx.FALSE()) {
    return {
      type: "Literal",
      value: "false",
      literalType: "bool",
      ...loc(ctx),
    };
  }

  if (ctx.C_NULL()) {
    return {
      type: "Literal",
      value: "NULL",
      literalType: "null",
      ...loc(ctx),
    };
  }

  throw new Error("Unknown literal type");
}

// ============================================================================
// Types
// ============================================================================

function convertType(ctx: ReturnType<CNextParser["type"]>): AST.TypeNode {
  const primitive = ctx.primitiveType();
  if (primitive) return convertPrimitiveType(primitive);

  const stringType = ctx.stringType();
  if (stringType) return convertStringType(stringType);

  const scopedType = ctx.scopedType();
  if (scopedType) return convertScopedType(scopedType);

  const qualifiedType = ctx.qualifiedType();
  if (qualifiedType) return convertQualifiedType(qualifiedType);

  const userType = ctx.userType();
  if (userType) return convertUserType(userType);

  const arrayType = ctx.arrayType();
  if (arrayType) return convertArrayType(arrayType);

  if (ctx.VOID()) {
    return {
      type: "VoidType",
      ...loc(ctx),
    };
  }

  throw new Error("Unknown type");
}

function convertPrimitiveType(
  ctx: ReturnType<CNextParser["primitiveType"]>,
): AST.PrimitiveType {
  return {
    type: "PrimitiveType",
    name: ctx.getText(),
    ...loc(ctx),
  };
}

function convertStringType(
  ctx: ReturnType<CNextParser["stringType"]>,
): AST.StringType {
  const intLiteral = ctx.INTEGER_LITERAL();
  const capacity = intLiteral ? parseInt(intLiteral.getText(), 10) : null;

  return {
    type: "StringType",
    capacity,
    ...loc(ctx),
  };
}

function convertScopedType(
  ctx: ReturnType<CNextParser["scopedType"]>,
): AST.ScopedType {
  return {
    type: "ScopedType",
    name: ctx.IDENTIFIER().getText(),
    ...loc(ctx),
  };
}

function convertQualifiedType(
  ctx: ReturnType<CNextParser["qualifiedType"]>,
): AST.QualifiedType {
  const identifiers = ctx.IDENTIFIER();
  return {
    type: "QualifiedType",
    scope: identifiers[0].getText(),
    name: identifiers[1].getText(),
    ...loc(ctx),
  };
}

function convertUserType(
  ctx: ReturnType<CNextParser["userType"]>,
): AST.UserType {
  return {
    type: "UserType",
    name: ctx.IDENTIFIER().getText(),
    ...loc(ctx),
  };
}

function convertArrayType(
  ctx: ReturnType<CNextParser["arrayType"]>,
): AST.ArrayType {
  const primitive = ctx.primitiveType();
  const user = ctx.userType();

  const elementType = primitive
    ? convertPrimitiveType(primitive)
    : convertUserType(user!);

  const size = convertExpression(ctx.expression());

  return {
    type: "ArrayType",
    elementType: elementType as AST.PrimitiveType | AST.UserType,
    size,
    ...loc(ctx),
  };
}

export default parse;
