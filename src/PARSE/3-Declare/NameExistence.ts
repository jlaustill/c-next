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

import ESourceLanguage from "../../utils/types/ESourceLanguage";
import ICodeGenSymbols from "../../transpiler/types/ICodeGenSymbols";
import SymbolTable from "../../transpiler/logic/symbols/SymbolTable";

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
   *
   * ## A register is not a type (#1336)
   *
   * `symbols.knownRegisters` is deliberately NOT consulted. `TYPE_FORMING_KINDS`
   * already owns "does this kind introduce a type name" and already excludes
   * `register` for this reason; this predicate answers the same question from
   * the per-file name sets, and used to disagree with that owner. The
   * disagreement WAS the bug: E0426 asks whether a name is a type, the register
   * set answered "yes", and `Control c;` reached codegen with no typedef behind
   * it -- exit 0, then `unknown type name 'Control'` from the C compiler.
   *
   * ADR-004 is what makes the exclusion correct today: a register declares a
   * variable at an address, not a type. ADR-111 would make a register name a
   * type, but it is `Research`, and its own header states that while it is
   * Research "a register is still not a type".
   *
   * ADR-111: when it is IMPLEMENTED (not merely Accepted), add `knownRegisters`
   * back here, drop `isValueName` and `isRegisterName`, and retire E0429.
   */
  static isTypeName(
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
   * Whether a bare name denotes anything usable in a VALUE position.
   *
   * This is `isTypeName` plus registers plus file-scope variables, and the
   * difference is the whole point of the split (#1336). A type answers here
   * because it is the base of `Type.MEMBER`; a register answers here because
   * `GPIO.DR` reads a value at an address; a variable answers here because
   * being a value is what it is. One predicate served both positions and so
   * had to say "yes" to a register, which suppressed the type-position
   * diagnostic and let `Control c;` reach codegen with no type behind it.
   *
   * Each added term is named in exactly one place -- `isRegisterName`, and the
   * `knownVariables` read below -- so the two positions differ by those terms
   * rather than by two lists that must be kept in step.
   *
   * ## Why the variable term lives here (#1502 review)
   *
   * It was written in `UndeclaredValueAnalyzer.isVisible` first, three lines
   * above the call to this predicate, which made the opening sentence of this
   * comment false: a file-scope `const` is the most ordinary thing usable in a
   * value position, and this answered no while the caller quietly answered yes.
   * That is two modules deciding one question -- CLAUDE.md's rule that a single
   * source of truth is the DECISION and not merely the data -- with the module
   * that claims the question holding the incomplete answer.
   *
   * `knownVariables` is a per-file set, so it belongs on the per-file side of
   * the table above, beside the type-forming kinds. The run-wide `SymbolTable`
   * must NOT answer it, and that is #1398 itself: a const declared in a sibling
   * this file never included was reachable through `ScopeFrameResolver`'s
   * run-wide fallback, so E0427 could not fire across a file boundary while
   * E0426 fired for the identical type case.
   *
   * One call site passes a qualified `Scope__name`, which no bare file-scope
   * name can equal unless a variable is declared spelled with the transpiler's
   * own separator. That exposure is neither new nor specific to variables --
   * every `known*` set above is read on the same key by the same call -- and it
   * errs toward NOT firing, so its cost is a missed diagnostic rather than a
   * rejection of valid code.
   *
   * ADR-111: if a register becomes a type, this stops differing from
   * `isTypeName` by the register term. The variable term stays either way.
   */
  static isValueName(
    name: string,
    symbols: ICodeGenSymbols,
    symbolTable: SymbolTable,
  ): boolean {
    return (
      NameExistence.isTypeName(name, symbols, symbolTable) ||
      NameExistence.isRegisterName(name, symbols) ||
      // #1398: a file-scope variable or const declared in this file or in a
      // `.cnx` file it includes. Per-file on purpose -- see above.
      symbols.knownVariables.has(name)
    );
  }

  /**
   * Whether a bare name denotes a register (ADR-004).
   *
   * Separate from the two position predicates because the type position needs
   * to tell "this name is a register" apart from "this name is nothing at all"
   * -- E0429 against E0426. Answering "not a type" is enough to reject; naming
   * *why* is what makes the diagnostic worth reading, since the register is
   * declared right there in the file.
   *
   * ADR-111: retire this along with E0429 when a register becomes a type.
   */
  static isRegisterName(name: string, symbols: ICodeGenSymbols): boolean {
    return symbols.knownRegisters.has(name);
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
