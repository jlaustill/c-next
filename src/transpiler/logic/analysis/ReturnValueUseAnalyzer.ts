/**
 * Return-Value Use Analyzer (ADR-070, E0708)
 *
 * Rejects a non-void function call used as a bare expression statement, unless
 * the author explicitly discarded it with a cast to void:
 *
 *   next();            // E0708 -- return value discarded
 *   (void) next();     // OK    -- explicitly discarded
 *   u32 v <- next();   // OK    -- used
 *
 * ADR-070 splits discarded returns into two cases. This analyzer owns **Case 2**
 * (the author wrote the call). Case 1 -- calls the transpiler itself emits while
 * lowering string operations -- is codegen, and is cast to void at the single
 * emit site in StringUtils. The two never disagree because neither re-derives
 * the other's decision: an author-written call reaches this analyzer, a
 * transpiler-emitted one never exists at the C-Next source level at all.
 *
 * Domain boundary: a callee whose return type C-Next cannot resolve is outside
 * the rule, not an exception to it -- you cannot check a return type you cannot
 * see. This is ADR-070's "enforce where resolvable" boundary.
 *
 * `safe_div`/`safe_mod` (ADR-051) are deliberately NOT exempt. An earlier draft
 * of ADR-070 carved them out on the premise that they have "no bound return" at
 * the C-Next level; authors bind it constantly (`err <- safe_div(...)`), and the
 * same ADR names "a discarded `safe_div` outcome" as a motivating example of the
 * bug this rule prevents. They are ordinary non-void functions here.
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import CodeGenState from "../../state/CodeGenState";
import QualifiedCName from "../../../utils/QualifiedCName";
import StdlibFunctions from "./StdlibFunctions";
import IReturnValueUseError from "./types/IReturnValueUseError";

class ReturnValueUseListener extends CNextListener {
  public readonly errors: IReturnValueUseError[] = [];

  /** Enclosing `scope` name, so `this.member()` resolves to Scope__member. */
  private currentScope: string | null = null;

  override enterScopeDeclaration = (
    ctx: Parser.ScopeDeclarationContext,
  ): void => {
    this.currentScope = ctx.IDENTIFIER()?.getText() ?? null;
  };

  override exitScopeDeclaration = (): void => {
    this.currentScope = null;
  };

  override enterExpressionStatement = (
    ctx: Parser.ExpressionStatementContext,
  ): void => {
    const expr = ctx.expression();
    if (!expr) return;

    // An explicit `(void)` discard satisfies the rule outright.
    if (ReturnValueUseAnalyzer.isVoidCast(expr)) return;

    const postfix = ReturnValueUseAnalyzer.asBareCall(expr);
    if (!postfix) return;

    const funcName = ReturnValueUseAnalyzer.calleeName(
      postfix,
      this.currentScope,
    );
    if (!funcName) return;

    if (!ReturnValueUseAnalyzer.returnsAValue(funcName)) return;

    this.errors.push({
      line: ctx.start?.line ?? 0,
      column: ctx.start?.column ?? 0,
      code: "E0708",
      message: `Return value of non-void function '${funcName}' is discarded`,
      helpText: `Use the value, or discard it explicitly: (void) ${funcName}(...);`,
    });
  };
}

class ReturnValueUseAnalyzer {
  /**
   * True when the statement's expression is a cast to void wrapping anything.
   * Uses the existing ADR-017 cast expression -- no new syntax (ADR-070).
   */
  static isVoidCast(expr: Parser.ExpressionContext): boolean {
    const cast = ReturnValueUseAnalyzer.findCast(expr);
    return cast?.type()?.getText() === "void";
  }

  /** Descend single-child wrappers looking for a castExpression. */
  private static findCast(
    node: Parser.ExpressionContext | null,
  ): Parser.CastExpressionContext | null {
    let current: unknown = node;
    while (current && typeof current === "object") {
      if (current instanceof Parser.CastExpressionContext) return current;
      const ctx = current as {
        getChildCount?: () => number;
        getChild?: (i: number) => unknown;
      };
      if (
        typeof ctx.getChildCount !== "function" ||
        ctx.getChildCount() !== 1
      ) {
        return null;
      }
      current = ctx.getChild!(0);
    }
    return null;
  }

  /**
   * Return the postfix expression when the whole statement is exactly one call.
   * `foo().field;` is deliberately not a bare call -- ADR-070 puts that form
   * out of scope for v1.
   */
  static asBareCall(
    expr: Parser.ExpressionContext,
  ): Parser.PostfixExpressionContext | null {
    let current: unknown = expr;
    while (current && typeof current === "object") {
      if (current instanceof Parser.PostfixExpressionContext) {
        const ops = current.postfixOp();
        const last = ops.at(-1);
        // The final op must be the call itself, or the statement's value is a
        // member/subscript of a call result rather than the call.
        if (!last || !ReturnValueUseAnalyzer.isCallOp(last)) return null;
        return current;
      }
      const ctx = current as {
        getChildCount?: () => number;
        getChild?: (i: number) => unknown;
      };
      if (
        typeof ctx.getChildCount !== "function" ||
        ctx.getChildCount() !== 1
      ) {
        return null;
      }
      current = ctx.getChild!(0);
    }
    return null;
  }

  private static isCallOp(op: Parser.PostfixOpContext): boolean {
    return op.argumentList() !== null || op.getText().startsWith("(");
  }

  /**
   * Build the callee's qualified name, mirroring FunctionCallAnalyzer so the
   * two agree on what a call is named.
   */
  static calleeName(
    postfix: Parser.PostfixExpressionContext,
    currentScope: string | null = null,
  ): string | null {
    const primary = postfix.primaryExpression();
    const ident = primary.IDENTIFIER();

    // ADR-016 qualifiers are their own tokens, not identifiers:
    //   this.member()        -> the enclosing scope's member
    //   global.Scope.member() -> drop the qualifier, keep the rest
    // Missing either form would silently under-enforce the rule.
    let name: string;
    if (ident) {
      name = ident.getText();
    } else if (primary.THIS()) {
      if (!currentScope) return null;
      name = currentScope;
    } else if (primary.GLOBAL()) {
      name = "";
    } else {
      return null;
    }
    for (const op of postfix.postfixOp()) {
      if (op.IDENTIFIER()) {
        name = QualifiedCName.join(name, op.IDENTIFIER()!.getText());
      } else if (ReturnValueUseAnalyzer.isCallOp(op)) {
        break;
      } else {
        // A subscript before the call -- not a plain named callee.
        return null;
      }
    }
    return name || null;
  }

  /**
   * True only when C-Next can see a non-void return type for `name`.
   * Unresolvable names answer false: outside the rule's domain, not exempt.
   */
  static returnsAValue(name: string): boolean {
    const builtin = StdlibFunctions.builtinReturnType(name);
    if (builtin !== null) {
      return builtin !== "void";
    }

    const declared = CodeGenState.getFunctionReturnType(name);
    if (declared !== undefined) {
      return declared !== "void";
    }

    // Functions declared in included C/C++ headers reach the analyzer through
    // the symbol table rather than through CodeGenState.symbols, which only
    // merges .cnx includes. ADR-070 rejects blanket-exempting external C
    // precisely because these returns ARE visible -- just by a different route.
    const external = ReturnValueUseAnalyzer.externalReturnType(name);
    if (external !== null) {
      return external !== "void";
    }

    if (StdlibFunctions.isKnown(name)) {
      return !StdlibFunctions.returnsVoid(name);
    }

    return false;
  }

  /**
   * Return type of a function declared in an included C/C++ header.
   *
   * C symbols carry their types as plain strings and live in a different part
   * of the symbol table from C-Next symbols (`getCSymbol`, not the TSymbol
   * index), so they need their own lookup. ADR-070 rejects blanket-exempting
   * external C precisely because these returns are visible -- they just arrive
   * by a different route than CodeGenState.symbols, which merges only .cnx
   * includes.
   */
  static externalReturnType(name: string): string | null {
    const sym = CodeGenState.symbolTable?.getCSymbol?.(name);
    if (sym?.kind !== "function") return null;
    return sym.type ?? null;
  }

  /** Run the analysis over a parsed program. */
  static analyze(tree: Parser.ProgramContext): IReturnValueUseError[] {
    const listener = new ReturnValueUseListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors;
  }
}

export default ReturnValueUseAnalyzer;
