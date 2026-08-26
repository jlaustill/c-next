/**
 * Resolves the qualified name of the function a postfix expression calls.
 *
 * "What function does this call target?" is one decision, and it is asked by
 * more than one analyzer: FunctionCallAnalyzer (ADR-030 define-before-use) and
 * ReturnValueUseAnalyzer (ADR-070 / E0708). It is deliberately owned here
 * rather than implemented per-caller.
 *
 * This matters more than it looks. ADR-016 makes `this` and `global` their own
 * tokens, and each qualifier resolves differently (`this.m` -> CurrentScope__m,
 * `global.m` -> m, `Scope.m` -> Scope__m). Two implementations of that would
 * agree only for as long as nobody touched either -- and a caller that resolved
 * a name differently would silently enforce its rule on a different function
 * than the one being called.
 *
 * Callers supply their own context (enclosing scope, known scope names) rather
 * than this module reaching for global state, so the resolution is a pure
 * function of what the caller can see.
 */

import * as Parser from "../../parser/grammar/CNextParser";
import QualifiedCName from "../../../../utils/QualifiedCName";
import ICalleeResolution from "../types/ICalleeResolution";

class CalleeNameResolver {
  /**
   * The base name a postfix expression starts from: an identifier, or the
   * ADR-016 qualifier keywords, which are separate tokens rather than
   * identifiers. Returns null for anything that cannot start a named call.
   */
  static baseName(primary: Parser.PrimaryExpressionContext): string | null {
    if (primary.IDENTIFIER()) {
      return primary.IDENTIFIER()!.getText();
    }
    if (primary.THIS()) {
      return "this";
    }
    if (primary.GLOBAL()) {
      return "global";
    }
    return null;
  }

  /**
   * Resolve one member-access step. Returns the new qualified name, or null
   * when the base is not something a C-Next call can be named against.
   */
  static resolveMemberAccess(
    resolvedName: string,
    op: Parser.PostfixOpContext,
    currentScope: string | null,
    isScope: (name: string) => boolean,
  ): string | null {
    const memberName = op.IDENTIFIER()!.getText();

    // this.member -> CurrentScope__member (only meaningful inside a scope)
    if (resolvedName === "this") {
      return currentScope
        ? QualifiedCName.join(currentScope, memberName)
        : null;
    }

    // Issue #985: global.member -> member (strip the qualifier)
    if (resolvedName === "global") {
      return memberName;
    }

    if (isScope(resolvedName)) {
      return QualifiedCName.join(resolvedName, memberName);
    }

    // Object.method or a chained access -- not a C-Next function call
    return null;
  }

  /**
   * Walk a postfix expression's operations to the call, building the callee's
   * qualified name as it goes.
   */
  static resolveCallTarget(
    ops: Parser.PostfixOpContext[],
    baseName: string,
    currentScope: string | null,
    isScope: (name: string) => boolean,
  ): ICalleeResolution {
    let resolvedName = baseName;
    let isGlobalCall = baseName === "global";

    for (const op of ops) {
      if (op.IDENTIFIER()) {
        const resolved = CalleeNameResolver.resolveMemberAccess(
          resolvedName,
          op,
          currentScope,
          isScope,
        );
        if (resolved === null) {
          return { resolvedName, foundCall: false, isGlobalCall };
        }
        // Resolution through a known scope makes this a scope method call,
        // not a global function lookup.
        if (isGlobalCall && isScope(resolvedName)) {
          isGlobalCall = false;
        }
        resolvedName = resolved;
        continue;
      }

      if (op.argumentList() || op.getChildCount() === 2) {
        if (op.getText().startsWith("(")) {
          return { resolvedName, foundCall: true, isGlobalCall };
        }
      }
    }

    return { resolvedName, foundCall: false, isGlobalCall };
  }

  /**
   * Full resolution for a postfix expression: the callee's qualified name, or
   * null when this expression is not a named function call.
   */
  static resolve(
    postfix: Parser.PostfixExpressionContext,
    currentScope: string | null,
    isScope: (name: string) => boolean,
  ): string | null {
    const base = CalleeNameResolver.baseName(postfix.primaryExpression());
    if (base === null) return null;

    const result = CalleeNameResolver.resolveCallTarget(
      postfix.postfixOp(),
      base,
      currentScope,
      isScope,
    );
    if (!result.foundCall) return null;
    if (result.resolvedName === "this" || result.resolvedName === "global") {
      return null;
    }
    return result.resolvedName;
  }
}

export default CalleeNameResolver;
