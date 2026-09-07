/**
 * TypeValidator - Handles compile-time validation of types, assignments, and control flow
 * Static class using CodeGenState for all state access.
 * Issue #63: Validation logic separated for independent testing
 */
import { existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import * as Parser from "../../logic/parser/grammar/CNextParser";
import CodeGenState from "../../state/CodeGenState";
import AdrProvenance from "../../state/AdrProvenance";
// SonarCloud S3776: Extracted literal parsing to reduce complexity
import LiteralEvaluator from "./helpers/LiteralEvaluator";
import QualifiedCName from "../../../utils/QualifiedCName";
import ScopeUtils from "../../../utils/ScopeUtils";

/**
 * ADR-010: Implementation file extensions that should NOT be #included
 */
const IMPLEMENTATION_EXTENSIONS = new Set([
  ".c",
  ".cpp",
  ".cc",
  ".cxx",
  ".c++",
]);

/**
 * TypeValidator class - validates types, assignments, and control flow at compile time.
 * All methods are static - uses CodeGenState for state access.
 */
class TypeValidator {
  // ========================================================================
  // Include Validation (ADR-010)
  // ========================================================================

  /**
   * ADR-010: Validate that #include doesn't include implementation files
   */
  static validateIncludeNotImplementationFile(
    includeText: string,
    lineNumber: number,
  ): void {
    const angleMatch = /#\s*include\s*<([^>]+)>/.exec(includeText);
    const quoteMatch = /#\s*include\s*"([^"]+)"/.exec(includeText);

    const includePath = angleMatch?.[1] || quoteMatch?.[1];
    if (!includePath) {
      return;
    }

    const ext = includePath
      .substring(includePath.lastIndexOf("."))
      .toLowerCase();

    if (IMPLEMENTATION_EXTENSIONS.has(ext)) {
      throw new Error(
        `E0503: Cannot #include implementation file '${includePath}'. ` +
          `Only header files (.h, .hpp) are allowed. Line ${lineNumber}`,
      );
    }
  }

  /**
   * E0504: Validate that a .cnx alternative doesn't exist for a .h/.hpp include
   */
  static validateIncludeNoCnxAlternative(
    includeText: string,
    lineNumber: number,
    sourcePath: string | null,
    includePaths: string[],
    fileExists: (path: string) => boolean = existsSync,
  ): void {
    const parsed = TypeValidator._parseIncludeDirective(includeText);
    if (!parsed) return;
    if (parsed.path.endsWith(".cnx")) return;
    if (!TypeValidator._isHeaderFile(parsed.path)) return;

    const cnxPath = parsed.path.replace(/\.(h|hpp)$/i, ".cnx");

    if (parsed.isQuoted) {
      TypeValidator._checkQuotedIncludeForCnx(
        parsed.path,
        cnxPath,
        sourcePath,
        lineNumber,
        fileExists,
      );
    } else {
      TypeValidator._checkAngleIncludeForCnx(
        parsed.path,
        cnxPath,
        includePaths,
        lineNumber,
        fileExists,
      );
    }
  }

  private static _parseIncludeDirective(
    includeText: string,
  ): { path: string; isQuoted: boolean } | null {
    const angleMatch = /#\s*include\s*<([^>]+)>/.exec(includeText);
    const quoteMatch = /#\s*include\s*"([^"]+)"/.exec(includeText);

    if (quoteMatch) return { path: quoteMatch[1], isQuoted: true };
    if (angleMatch) return { path: angleMatch[1], isQuoted: false };
    return null;
  }

  private static _isHeaderFile(path: string): boolean {
    const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
    return ext === ".h" || ext === ".hpp";
  }

  private static _checkQuotedIncludeForCnx(
    includePath: string,
    cnxPath: string,
    sourcePath: string | null,
    lineNumber: number,
    fileExists: (path: string) => boolean,
  ): void {
    if (!sourcePath) return;

    const sourceDir = dirname(sourcePath);
    const fullCnxPath = resolve(sourceDir, cnxPath);
    if (fileExists(fullCnxPath)) {
      throw new Error(
        `E0504: Found #include "${includePath}" but '${cnxPath}' exists at the same location.\n` +
          `       Use #include "${cnxPath}" instead to use the C-Next version. Line ${lineNumber}`,
      );
    }
  }

  private static _checkAngleIncludeForCnx(
    includePath: string,
    cnxPath: string,
    includePaths: string[],
    lineNumber: number,
    fileExists: (path: string) => boolean,
  ): void {
    for (const searchDir of includePaths) {
      const fullCnxPath = join(searchDir, cnxPath);
      if (fileExists(fullCnxPath)) {
        throw new Error(
          `E0504: Found #include <${includePath}> but '${cnxPath}' exists at the same location.\n` +
            `       Use #include <${cnxPath}> instead to use the C-Next version. Line ${lineNumber}`,
        );
      }
    }
  }

  // ========================================================================
  // Bitmap Field Validation (ADR-034)
  // ========================================================================

  static validateBitmapFieldLiteral(
    expr: Parser.ExpressionContext,
    width: number,
    fieldName: string,
  ): void {
    const text = expr.getText().trim();
    const maxValue = (1 << width) - 1;

    let value: number | null = null;

    if (/^\d+$/.exec(text)) {
      value = Number.parseInt(text, 10);
    } else if (/^0[xX][0-9a-fA-F]+$/.exec(text)) {
      value = Number.parseInt(text, 16);
    } else if (/^0[bB][01]+$/.exec(text)) {
      value = Number.parseInt(text.substring(2), 2);
    }

    if (value !== null && value > maxValue) {
      throw new Error(
        `Error: Value ${value} exceeds ${width}-bit field '${fieldName}' maximum of ${maxValue}`,
      );
    }
  }

  // ========================================================================
  // Array Bounds Validation (ADR-036)
  // ========================================================================

  /**
   * ADR-036: compile-time bounds checking for a constant subscript.
   *
   * The whether-to-check decision lives HERE, not at each call site. Two
   * callers used to guard on different predicates -- `isArray &&
   * arrayDimensions` in `AssignmentValidator`, `arrayDimensions` alone in
   * `ArrayHandlers` -- which agreed only because `arrayDimensions` is set "if
   * isArray is true" by convention rather than by enforcement
   * (`IVariableSymbol.ts:32`). #1360 added a third caller, and three places
   * deciding whether a safety check happens is the divergence CLAUDE.md
   * forbids. The surviving predicate is the broader one: dimensions present
   * means there is a bound to check against, and unifying on the narrower one
   * would have LOOSENED an existing check.
   *
   * Callers still supply the name, because resolving it legitimately differs
   * by context -- a bare identifier on the declaration path, the
   * scope-resolved one in `ArrayHandlers` (#1139).
   *
   * @param dimensionOffset Which dimension `indexExprs[0]` indexes. The read
   *   path walks a postfix chain one subscript at a time, so it reports its
   *   depth rather than slicing `arrayDimensions`. Slicing would shift every
   *   later dimension and validate an index against the wrong bound -- e.g.
   *   `u8[N][4] grid` checking `grid[i]` against 4 -- which is exactly the
   *   defect `UNRESOLVED_DIMENSION` keeps a placeholder slot to prevent.
   */
  static checkArrayBounds(
    arrayName: string,
    indexExprs: Parser.ExpressionContext[],
    line: number,
    tryEvaluateConstant: (ctx: Parser.ExpressionContext) => number | undefined,
    dimensionOffset = 0,
  ): void {
    const dimensions =
      CodeGenState.getVariableTypeInfo(arrayName)?.arrayDimensions;
    if (!dimensions) {
      return;
    }

    for (let i = 0; i < indexExprs.length; i++) {
      const dimension = dimensionOffset + i;
      if (dimension >= dimensions.length) {
        break;
      }

      const constValue = tryEvaluateConstant(indexExprs[i]);
      if (constValue === undefined) {
        continue;
      }

      if (constValue < 0) {
        throw new Error(
          `Array index out of bounds: ${constValue} is negative for '${arrayName}' dimension ${dimension + 1} (line ${line})`,
        );
      }

      // A non-positive dimension is UNRESOLVED_DIMENSION -- size unknown,
      // cannot validate -- never a real bound of zero.
      if (dimensions[dimension] > 0 && constValue >= dimensions[dimension]) {
        throw new Error(
          `Array index out of bounds: ${constValue} >= ${dimensions[dimension]} for '${arrayName}' dimension ${dimension + 1} (line ${line})`,
        );
      }
    }
  }

  // ========================================================================
  // Callback Assignment Validation (ADR-029)
  // ========================================================================

  static validateCallbackAssignment(
    expectedType: string,
    valueExpr: Parser.ExpressionContext,
    fieldName: string,
    isCallbackTypeUsedAsFieldType: (funcName: string) => boolean,
  ): void {
    const valueText = valueExpr.getText();

    if (!CodeGenState.knownFunctions.has(valueText)) {
      return;
    }

    const expectedInfo = CodeGenState.callbackTypes.get(expectedType);
    const valueInfo = CodeGenState.callbackTypes.get(valueText);

    if (!expectedInfo || !valueInfo) {
      return;
    }

    if (!TypeValidator.callbackSignaturesMatch(expectedInfo, valueInfo)) {
      throw new Error(
        `Error: Function '${valueText}' signature does not match callback type '${expectedType}'`,
      );
    }

    if (
      isCallbackTypeUsedAsFieldType(valueText) &&
      valueText !== expectedType
    ) {
      throw new Error(
        `Error: Cannot assign '${valueText}' to callback field '${fieldName}' ` +
          `(expected ${expectedType} type, got ${valueText} type - nominal typing)`,
      );
    }
  }

  static callbackSignaturesMatch(
    a: {
      returnType: string;
      parameters: {
        type: string;
        isConst: boolean;
        isPointer: boolean;
        isArray: boolean;
      }[];
    },
    b: {
      returnType: string;
      parameters: {
        type: string;
        isConst: boolean;
        isPointer: boolean;
        isArray: boolean;
      }[];
    },
  ): boolean {
    if (a.returnType !== b.returnType) return false;
    if (a.parameters.length !== b.parameters.length) return false;

    for (let i = 0; i < a.parameters.length; i++) {
      const pa = a.parameters[i];
      const pb = b.parameters[i];
      if (pa.type !== pb.type) return false;
      if (pa.isConst !== pb.isConst) return false;
      if (pa.isPointer !== pb.isPointer) return false;
      if (pa.isArray !== pb.isArray) return false;
    }

    return true;
  }

  // ========================================================================
  // Const Assignment Validation (ADR-013)
  // ========================================================================

  static checkConstAssignment(identifier: string): string | null {
    const paramInfo = CodeGenState.currentParameters.get(identifier);
    if (paramInfo?.isConst) {
      return `cannot assign to const parameter '${identifier}'`;
    }

    const scopedName = CodeGenState.resolveIdentifier(identifier);

    const typeInfo = CodeGenState.getVariableTypeInfo(scopedName);
    if (typeInfo?.isConst) {
      return `cannot assign to const variable '${identifier}'`;
    }

    return null;
  }

  static isConstValue(identifier: string): boolean {
    const paramInfo = CodeGenState.currentParameters.get(identifier);
    if (paramInfo?.isConst) {
      return true;
    }

    const typeInfo = CodeGenState.getVariableTypeInfo(identifier);
    if (typeInfo?.isConst) {
      return true;
    }

    return false;
  }

  /**
   * @param line Source line of the reference, when the caller has one. Used only
   *   to record #1241 provenance: an ADR-057 resolution is invisible to the
   *   scope-context matrix without a position, because a successful resolution
   *   emits no diagnostic to take one from. Recorded HERE rather than at the
   *   three callers, which are required not to re-derive this decision.
   */
  static resolveBareIdentifier(
    identifier: string,
    isLocalVariable: boolean,
    isKnownStruct: (name: string) => boolean,
    line?: number,
  ): string | null {
    if (isLocalVariable) {
      // ADR-057: a local normally emits under its own name (null = "leave it
      // alone"). One that shadows a file-scope symbol was given a distinct C
      // identifier at its declaration, and every reference must follow it.
      const emitted = CodeGenState.emittedLocalName(identifier);
      if (emitted === identifier) {
        return null;
      }
      // The rename IS ADR-057's shadowing rule firing; a local that shadows
      // nothing is the rule declining to act, which is not evidence of it.
      AdrProvenance.record("057", line);
      return emitted;
    }

    const currentScopePath = CodeGenState.currentScopePath;

    if (currentScopePath) {
      const scopeResolved = TypeValidator._resolveScopeMember(
        identifier,
        currentScopePath,
      );
      if (scopeResolved) {
        AdrProvenance.record("057", line);
        return scopeResolved;
      }
    }

    if (
      TypeValidator._isKnownGlobalIdentifier(
        identifier,
        currentScopePath,
        isKnownStruct,
      )
    ) {
      return currentScopePath ? identifier : null;
    }

    return null;
  }

  private static _resolveScopeMember(
    identifier: string,
    currentScopePath: string,
  ): string | null {
    // #1295: getScopeMembers is keyed by the scope LEAF name.
    const scopeMembers = CodeGenState.getScopeMembers(
      ScopeUtils.leafOf(currentScopePath),
    );
    if (scopeMembers?.has(identifier)) {
      return ScopeUtils.qualifyInScope(identifier, currentScopePath);
    }

    const scopedFuncName = ScopeUtils.qualifyInScope(
      identifier,
      currentScopePath,
    );
    if (CodeGenState.knownFunctions.has(scopedFuncName)) {
      return scopedFuncName;
    }

    return null;
  }

  private static _isKnownGlobalIdentifier(
    identifier: string,
    currentScopePath: string,
    isKnownStruct: (name: string) => boolean,
  ): boolean {
    const typeInfo = CodeGenState.getVariableTypeInfo(identifier);
    if (typeInfo && !QualifiedCName.isQualified(identifier)) {
      return true;
    }

    if (
      CodeGenState.knownFunctions.has(identifier) &&
      !QualifiedCName.isInScope(identifier, ScopeUtils.leafOf(currentScopePath))
    ) {
      return true;
    }

    return (
      CodeGenState.symbols!.knownEnums.has(identifier) ||
      isKnownStruct(identifier) ||
      CodeGenState.symbols!.knownRegisters.has(identifier)
    );
  }

  static resolveForMemberAccess(identifier: string): string | null {
    if (CodeGenState.symbols!.knownScopes.has(identifier)) {
      return identifier;
    }
    return null;
  }

  // ========================================================================
  // Critical Section Validation (ADR-050)
  // ========================================================================

  // #1322: `validateNoEarlyExits` and its four private helpers are gone. The
  // rule is E0853 in pass 2.1, where a tree walk reaches every statement the
  // grammar can nest inside a `critical` block.
  //
  // The recursion here ENUMERATED the kinds it descended into -- return, if,
  // while, for, do-while -- and omitted `switch`, so a `return` in a switch
  // case compiled clean and emitted C that returns between
  // `__cnx_disable_irq()` and `__cnx_set_PRIMASK()`. On device, interrupts stay
  // off. A walk does not enumerate, so it cannot have that hole.

  // ========================================================================
  // Switch Statement Validation (ADR-025)
  // ========================================================================

  // #1322: ADR-025's switch rules are E0711-E0714 in pass 2.1 --
  // `validateSwitchStatement` and the three helpers only it used are gone.
  // All five throws reached the user as `1:0`, which seven fixtures under
  // `tests/switch/` asserted verbatim. Nothing here needed a fact the
  // analyzers could not already see: `knownEnums` and `enumMembers` are on the
  // per-file symbol view, and the clause count, the labels and `default(N)`
  // are in the parse tree. They lived here because this is where the switch
  // was being WRITTEN, not because this is where the facts were.

  // #1322: `validateNoNestedTernary` is gone. ADR-022's rule is E0710 in pass
  // 2.1, asked of the parse tree.
  //
  // What stood here was a SUBSTRING TEST on the branch's source text --
  // `text.includes("?") && text.includes(":")` -- which rejected
  // `(n = 1) ? "a?b:c" : "plain"`, a legal ternary whose true branch is a
  // string literal containing both characters. A rule about syntax asking
  // about characters.

  // #1322: ADR-022's controlling-expression rule is E0701/E0702 in pass 2.1.
  // Eight methods stood here -- the boolean check, its three-level decomposition
  // of `||`/`&&`, the help-text builder, and the two function-call checks. The
  // rule is purely SYNTACTIC, so none of it needed anything codegen had; only
  // the help text asked a type question, and 2.1 asks it of the lexical frames,
  // which honour shadowing where a flat registry lookup does not.

  // #1322: ADR-068's always-true loop condition (E0707) is in pass 2.1, with
  // `for (;;)` and E0705 beside it. Five methods stood here -- the literal
  // slice's comparison reader, its number parser and the verdict -- all facts
  // of the parse tree that never needed codegen.

  // ========================================================================
  // Shift Amount Validation (MISRA C:2012 Rule 12.2)
  // ========================================================================

  static validateShiftAmount(
    leftType: string,
    rightExpr: Parser.AdditiveExpressionContext,
    op: string,
    ctx: Parser.ShiftExpressionContext,
  ): void {
    const typeWidth = TypeValidator._getTypeWidth(leftType);
    if (!typeWidth) return;

    const shiftAmount = TypeValidator._evaluateShiftAmount(rightExpr);
    if (shiftAmount === null) return;

    if (shiftAmount < 0) {
      throw new Error(
        `Error: Negative shift amount (${shiftAmount}) is undefined behavior\n` +
          `  Type: ${leftType}\n` +
          `  Expression: ${ctx.getText()}\n` +
          `  Shift amounts must be non-negative`,
      );
    }

    if (shiftAmount >= typeWidth) {
      throw new Error(
        `Error: Shift amount (${shiftAmount}) exceeds type width (${typeWidth} bits) for type '${leftType}'\n` +
          `  Expression: ${ctx.getText()}\n` +
          `  Shift amount must be < ${typeWidth} for ${typeWidth}-bit types\n` +
          `  This violates MISRA C:2012 Rule 12.2 and causes undefined behavior`,
      );
    }
  }

  private static _getTypeWidth(type: string): number | null {
    switch (type) {
      case "u8":
      case "i8":
        return 8;
      case "u16":
      case "i16":
        return 16;
      case "u32":
      case "i32":
        return 32;
      case "u64":
      case "i64":
        return 64;
      default:
        return null;
    }
  }

  private static _evaluateShiftAmount(
    ctx: Parser.AdditiveExpressionContext,
  ): number | null {
    const multExprs = ctx.multiplicativeExpression();
    if (multExprs.length !== 1) return null;

    const multExpr = multExprs[0];
    const unaryExprs = multExpr.unaryExpression();
    if (unaryExprs.length !== 1) return null;

    return TypeValidator._evaluateUnaryExpression(unaryExprs[0]);
  }

  private static _evaluateUnaryExpression(
    ctx: Parser.UnaryExpressionContext,
  ): number | null {
    const unaryText = ctx.getText();
    const isNegative = unaryText.startsWith("-");

    const postfixExpr = ctx.postfixExpression();
    if (postfixExpr) {
      return TypeValidator._evaluateLiteralFromPostfix(postfixExpr, isNegative);
    }

    const nestedUnary = ctx.unaryExpression();
    if (nestedUnary) {
      const nestedValue = TypeValidator._evaluateUnaryExpression(nestedUnary);
      return LiteralEvaluator.applySign(nestedValue, isNegative);
    }

    return null;
  }

  private static _evaluateLiteralFromPostfix(
    postfixExpr: Parser.PostfixExpressionContext,
    isNegative: boolean,
  ): number | null {
    const primaryExpr = postfixExpr.primaryExpression();
    if (!primaryExpr) return null;

    const literal = primaryExpr.literal();
    if (!literal) return null;

    const text = literal.getText();
    const value = LiteralEvaluator.parseLiteral(text);
    return LiteralEvaluator.applySign(value, isNegative);
  }

  // #1322: `validateIntegerAssignment` stood here -- ADR-024's literal-range,
  // narrowing and sign-change rules, reached through `AssignmentValidator`,
  // which caught the throw and prefixed `${line}:${col}` onto it. E0868/E0869
  // in pass 2.1 now.
}

export default TypeValidator;
