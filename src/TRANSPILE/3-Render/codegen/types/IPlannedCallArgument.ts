import type TTypeInfo from "../../../../types/TTypeInfo";
/**
 * One argument of a function call, reduced to what the call generator asks of
 * it (#1445 box 3).
 *
 * The generator asks an argument node five things and nothing else: is it a
 * bare identifier, what type is it, is it a whole array, render it, and render
 * it through ADR-006 reference semantics. Four of the five are deferred, for
 * the reasons below.
 *
 * ## Exactly one render happens per argument, and which one is the decision
 *
 * An argument takes one of three mutually exclusive routes: the Issue #937
 * callback-promoted branch returns the identifier and renders NOTHING; a C
 * function's argument renders with the target parameter's type expected; a
 * C-Next parameter renders either by value or by reference. Rendering the
 * losing route would register that route's includes and `needs*` flags on
 * `TranspileState` -- and on the by-reference route, `ArgumentGenerator`'s C++
 * member conversion draws `TranspileState.getNextTempVarName()` and pushes onto
 * `pendingTempDeclarations`, so a discarded render emits a stray `_tmp<N>`
 * into the enclosing function and shifts the numbering of every later temp.
 *
 * ## `expressionType` is deferred too
 *
 * It registers nothing, so laziness costs it nothing either. It used to read
 * mutable render-time state through the per-file type registry; since #1668
 * it reads the typer over 1.4's settled declarations, so an eager ask gives
 * the same answer. The thunk keeps it where every site asks it, after the
 * argument has rendered.
 */
interface IPlannedCallArgument {
  /**
   * The argument as one bare identifier, or null when it is an expression.
   *
   * Eager: it is a pure tree walk with no state behind it, and the Issue #268
   * pass-through tracking reads it for every argument before any of them
   * renders.
   */
  readonly simpleIdentifier: string | null;

  /** The argument's inferred type, asked where the generator asks it. */
  readonly expressionType: () => string | null;

  /**
   * #1668 (C7): the declared type of the variable the argument names, when
   * it is one (bare, `this.x`, `global.x`, `Scope.x`); undefined otherwise
   */
  readonly declared: TTypeInfo | undefined;

  /**
   * Whether the argument is a whole array, which C decays to a pointer to its
   * first element (`OperandTyper.decaysToPointer`).
   * Deferred like `expressionType`, and like it read from the typer over 1.4's
   * settled declarations.
   */
  readonly isArray: () => boolean;

  /**
   * ADR-030 / #996: whether the argument is one element of an array whose
   * elements are held through pointers (an array of handles). Such an element
   * is already the handle, so `&arr[i]` would be a `T**`. Decided from the
   * array's declaration by the typer's chain, not from the rendered text.
   */
  readonly isHandleArrayElement: () => boolean;

  /**
   * The argument, rendered.
   *
   * Zero-argument on purpose: Issue #872's `expectedType` scope, and the
   * ADR-gated bare-enum suppression inside it, are the generator's decision,
   * so the generator wraps this call rather than passing the type in.
   */
  readonly render: () => string;

  /** The argument, rendered through ADR-006 reference semantics. */
  readonly renderByReference: (
    targetParamBaseType: string | undefined,
  ) => string;
}

export default IPlannedCallArgument;
