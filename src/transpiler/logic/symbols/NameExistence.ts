/**
 * NameExistence — one answer to "does this name denote anything visible HERE?"
 *
 * `TypeBinding` maps a type context to a C name; it never asks whether the name
 * denotes a type, and its `null` means "no grammar alternative matched", not
 * "not found". So every position that consumes a name fell back to emitting the
 * raw source text: `CodeGenerator.getTypeName` via `resolved ?? ctx.getText()`
 * (#1312) and `TypeValidator.resolveBareIdentifier` via a `null` that conflates
 * "emit unchanged, it is fine" with "no idea what this is" (#1353). Both exited
 * 0 and emitted C that the C compiler rejects.
 *
 * ## Why two sources of truth, and which one answers which question
 *
 * The two available symbol views disagree, and the disagreement IS #1312:
 *
 * | view                              | scope     | sibling case says |
 * | --------------------------------- | --------- | ----------------- |
 * | `ICodeGenSymbols` `known*` sets    | per FILE  | `Mode` unknown    |
 * | `SymbolTable.getOverloadsByCName`  | whole RUN | `Mode` known      |
 *
 * `ICodeGenSymbols` is built by `_declareFile(tree, path, file.cnextIncludes)`
 * (`Transpiler.ts:485`), so it holds exactly what this file can see. The
 * `SymbolTable` accumulates every file in the run and is cleared once, so a
 * sibling that was never included is still in it. Asking the run-wide table
 * whether a C-Next type exists would answer "yes" in the file that cannot see
 * it, and the diagnostic would never fire where it is needed -- the trap #1312
 * names explicitly.
 *
 * So the two questions are routed to the view that can answer them:
 *
 *   - a **C-Next** name is checked against the per-file sets, because C-Next
 *     visibility is what the include graph governs;
 *   - a **C/C++** name is checked against the run-wide table, because external
 *     types arrive through header includes that are already resolved per file,
 *     and because the failure directions are not symmetric. Missing an external
 *     type means a diagnostic does not fire (the status quo). Wrongly rejecting
 *     one means valid code stops compiling. Only the second is a regression, so
 *     the external side is deliberately permissive.
 *
 * `CodeGenState.isScopeType()` cannot serve here on either count: it reads the
 * run-wide table, and it filters to `ESourceLanguage.CNext`, so it is wrong in
 * both directions at once for this question.
 */

import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import ICodeGenSymbols from "../../types/ICodeGenSymbols";
import SymbolTable from "./SymbolTable";

class NameExistence {
  /**
   * Whether a bare type name denotes a type this file can see.
   *
   * `CodeGenState.callbackTypes` is deliberately NOT consulted. It is codegen
   * state -- filled by `CodeGenerator.registerCallbackType` and cleared at the
   * start of `generate()`, both of which run after the analyzers -- so at
   * analysis time it is empty for the first file and holds file N-1's function
   * names for every file after. Reading it made E0426 order-dependent: the same
   * two files with their `#include` lines swapped either diagnosed the undefined
   * type or emitted C the compiler rejects at exit 0. `_isKnownCNextType` already asks
   * `symbols.functionReturnTypes`, which is the per-file view of the same
   * ADR-029 fact and is correct here.
   *
   * Only the bare `userType()` branch belongs here. `this.T`, `global.T` and
   * `Scope.T` state their scope in the syntax and are resolved by their own
   * branches; once a name is a string those answers are indistinguishable from
   * a bare one, which is the same reason `TypeBinding` keeps them separate.
   */
  static isKnownType(
    typeName: string,
    symbols: ICodeGenSymbols,
    symbolTable: SymbolTable,
  ): boolean {
    return (
      NameExistence._isKnownCNextType(typeName, symbols) ||
      NameExistence._isKnownForeignName(typeName, symbolTable)
    );
  }

  /**
   * ADR-017: an enum member may be written bare where the expected type makes
   * it unambiguous -- a variable declaration, a struct field initializer, a
   * switch case, a return statement, a ternary arm. It is a value, but it is
   * neither a variable nor a type, so neither of the other lookups sees it.
   */
  static isKnownEnumMember(name: string, symbols: ICodeGenSymbols): boolean {
    for (const members of symbols.enumMembers.values()) {
      if (members.has(name)) {
        return true;
      }
    }
    return false;
  }

  private static _isKnownCNextType(
    typeName: string,
    symbols: ICodeGenSymbols,
  ): boolean {
    return (
      symbols.knownEnums.has(typeName) ||
      symbols.knownStructs.has(typeName) ||
      symbols.knownBitmaps.has(typeName) ||
      symbols.knownRegisters.has(typeName) ||
      symbols.knownScopes.has(typeName) ||
      symbols.opaqueTypes.has(typeName) ||
      // ADR-029: a function definition creates a callback type, so every
      // function name is also a type name. `CodeGenState.callbackTypes` is
      // filled during codegen, which is after this runs, so the per-file
      // function map is the view that has the answer at analysis time.
      symbols.functionReturnTypes.has(typeName)
    );
  }

  /**
   * A name declared by an included C or C++ header. Checked against the
   * run-wide table on purpose -- see the class comment on why the external side
   * is permissive.
   */
  private static _isKnownForeignName(
    name: string,
    symbolTable: SymbolTable,
  ): boolean {
    return symbolTable
      .getOverloadsByCName(name)
      .some((symbol) => symbol.sourceLanguage !== ESourceLanguage.CNext);
  }
}

export default NameExistence;
