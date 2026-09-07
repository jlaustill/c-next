/**
 * Which C-Next function a spelling denotes.
 *
 * #1322. Three questions in pass 2.1 end at the program's symbol for one
 * function: "what does this call target?" (E0878's callee, E0708's), "which
 * function is this VALUE?" (a function placed into a callback-typed slot,
 * ADR-029) and "which function does this TYPE name?" (the slot itself, whose
 * declared type is a function under ADR-029's function-as-type rule). All
 * three start from the same spellings -- `f`, `this.f`, `global.f`,
 * `Scope.f` -- and `CalleeNameResolver` owns turning a spelling into a
 * candidate name. What this class owns is the LOOKUP: which candidates are
 * tried, in which order, against the program.
 *
 * ## The order is the decision
 *
 * ADR-057: inside a scope, a bare `f` means the scope's own `f` when one
 * exists, and the global `f` otherwise -- codegen emits `S__f()` for a bare
 * `f()` inside `S` whichever of the two is declared. Before this class, two
 * analyzers held that order independently and one held it backwards: the
 * ADR-070 check asked "is the GLOBAL `f` non-void?" first and fell back to the
 * scope's, so with a global `u8 f()` beside a scope's `void f()` it rejected
 * a bare `f();` that codegen lowered to the void call. `candidates` is now the
 * one place the order is written, and every lookup walks it.
 */

import * as Parser from "../../../transpiler/logic/parser/grammar/CNextParser";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import IFunctionSymbol from "../../../transpiler/types/symbols/IFunctionSymbol";
import ExpressionUnwrapper from "../../../utils/ExpressionUnwrapper";
import QualifiedCName from "../../../utils/QualifiedCName";
import ScopeUtils from "../../../utils/ScopeUtils";
import CalleeNameResolver from "./CalleeNameResolver";

class FunctionReference {
  /**
   * The C names a resolved spelling may denote, most specific first: the
   * enclosing scope's member (ADR-057), then the name as resolved. A
   * `global.`-qualified or already-qualified name has one candidate.
   */
  static candidates(
    resolvedName: string,
    scopePath: string,
    isGlobalCall: boolean,
  ): string[] {
    const scoped = CalleeNameResolver.scopeQualifiedCandidate(
      resolvedName,
      scopePath,
      isGlobalCall,
    );
    return scoped === null ? [resolvedName] : [scoped, resolvedName];
  }

  /**
   * The candidates for a TYPE spelling as written in a declaration:
   * `onDown`, `this.handler`, `global.onDown`, `S.handler`, or the C name a
   * struct field's type is recorded under. An array spelling names its
   * element type.
   */
  static candidatesForTypeText(typeText: string, scopePath: string): string[] {
    const text = typeText.replace(/\[.*$/, "");
    if (text.startsWith("this.")) {
      return scopePath === ""
        ? []
        : [ScopeUtils.qualifyInScope(text.slice("this.".length), scopePath)];
    }
    if (text.startsWith("global.")) {
      return [text.slice("global.".length)];
    }
    if (text.includes(".")) {
      return [QualifiedCName.fromParts(text.split("."))];
    }
    return FunctionReference.candidates(text, scopePath, false);
  }

  /**
   * The function a call chain targets, or null: a foreign function, a call
   * through a value (`p.handler(5)`), or a name the program does not declare.
   */
  static ofCall(
    postfix: Parser.PostfixExpressionContext,
    scopePath: string,
  ): IFunctionSymbol | null {
    const resolved = CalleeNameResolver.resolveDetailed(
      postfix,
      scopePath,
      (name) => CodeGenState.isKnownScope(name),
    );
    if (resolved === null) return null;
    return FunctionReference.lookup(
      FunctionReference.candidates(
        resolved.name,
        scopePath,
        resolved.isGlobalCall,
      ),
    );
  }

  /**
   * The function an expression NAMES without calling it -- `onUp`,
   * `this.handler`, `global.onUp`, `S.handler` -- or null for anything else:
   * a variable of callback type, a call, a subscript, an expression.
   */
  static ofValue(
    expression: Parser.ExpressionContext,
    scopePath: string,
  ): IFunctionSymbol | null {
    const postfix = ExpressionUnwrapper.getPostfixExpression(expression);
    if (postfix === null) return null;
    const ops = postfix.postfixOp();
    if (ops.some((op) => op.DOT() === null)) return null;
    const base = CalleeNameResolver.baseName(postfix.primaryExpression());
    if (base === null) return null;
    let name = base;
    for (const op of ops) {
      const next = CalleeNameResolver.resolveMemberAccess(
        name,
        op,
        scopePath,
        (name) => CodeGenState.isKnownScope(name),
      );
      if (next === null) return null;
      name = next;
    }
    if (name === "this" || name === "global") return null;
    return FunctionReference.lookup(
      FunctionReference.candidates(name, scopePath, base === "global"),
    );
  }

  /** The function a declared TYPE names, or null when the type is not one. */
  static ofTypeText(
    typeText: string,
    scopePath: string,
  ): IFunctionSymbol | null {
    return FunctionReference.lookup(
      FunctionReference.candidatesForTypeText(typeText, scopePath),
    );
  }

  /** The symbol's C name -- the identity ADR-029's nominal rule compares. */
  static cNameOf(symbol: IFunctionSymbol): string {
    return ScopeUtils.getTranspiledCName(symbol);
  }

  private static lookup(candidates: readonly string[]): IFunctionSymbol | null {
    const program = CodeGenState.program;
    if (!program) return null;
    for (const cName of candidates) {
      const symbol = program.symbolByCName(cName);
      if (symbol?.kind === "function") return symbol;
    }
    return null;
  }
}

export default FunctionReference;
