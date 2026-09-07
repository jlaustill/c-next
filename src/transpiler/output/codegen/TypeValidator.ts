/**
 * TypeValidator - Handles compile-time validation of types, assignments, and control flow
 * Static class using CodeGenState for all state access.
 * Issue #63: Validation logic separated for independent testing
 */
import { existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import CodeGenState from "../../state/CodeGenState";
import AdrProvenance from "../../state/AdrProvenance";
// SonarCloud S3776: Extracted literal parsing to reduce complexity
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

  // #1322: ADR-034's literal-overflow check is E0881 in pass 2.1.
  //
  // `validateBitmapFieldLiteral` stood here and was reached only from the
  // bitmap assignment handler, which had already resolved the field. The rule
  // is about the VALUE and the field's width, both of which the parse tree and
  // the per-file bitmap layouts carry, so it needs no handler to have run
  // first -- and asking it there meant it could never see a write reached by
  // any other path.

  // ========================================================================
  // Array Bounds Validation (ADR-036)
  // ========================================================================

  // #1322: ADR-036's constant index bounds check (E0854) is in pass 2.1,
  // asked at every subscript of an expression or a target through one prefix
  // walk. It was reached from three codegen paths that each resolved the
  // array's name their own way, and a struct field's dimensions were never
  // among them.
  // #1322: ADR-029's callback rules are E0879 and E0880 in pass 2.1.
  //
  // `validateCallbackAssignment` and `callbackSignaturesMatch` stood here and
  // compared `ICallbackTypeInfo`, whose `isConst` is `declared || inferred`.
  // The inferred half is #268 auto-const -- a 2.2 Plan fact about whether a
  // BODY modifies a parameter -- so the check could not move as written, and
  // it protected nothing: it read `getUnmodifiedParameters()` before
  // `modifiedParameters` was filled, so both sides came back "unmodified" and
  // the const comparison was vacuous. 2.1 compares the DECLARED signature,
  // which 1.4 Resolve settles onto the symbol.

  // ========================================================================
  // Const Assignment Validation (ADR-013)
  // ========================================================================

  // #1322: ADR-013's `checkConstAssignment` and `isConstValue` are E0877 and
  // E0878 in pass 2.1, decided once from the frames and the program's symbols
  // rather than from `currentParameters` and the type registry.
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

  // #1322: MISRA 12.2's shift-amount rule (E0873) is in pass 2.1, beside the
  // Rule 10.1 signed-operand rule it always belonged with. Five methods stood
  // here -- the width table, the literal amount evaluator and the two throws --
  // and the compound forms (`<<<-`, `>><-`) never reached them.

  // #1322: `validateIntegerAssignment` stood here -- ADR-024's literal-range,
  // narrowing and sign-change rules, reached through `AssignmentValidator`,
  // which caught the throw and prefixed `${line}:${col}` onto it. E0868/E0869
  // in pass 2.1 now.
}

export default TypeValidator;
