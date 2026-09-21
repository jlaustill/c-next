/**
 * One argument of a function call, reduced to what the call generator asks of
 * it (#1445 box 3).
 *
 * The generator asks an argument node four things and nothing else: is it a
 * bare identifier, what type is it, render it, and render it through ADR-006
 * reference semantics. Three of the four are deferred, and each for a
 * different reason.
 *
 * ## Exactly one render happens per argument, and which one is the decision
 *
 * An argument takes one of three mutually exclusive routes: the Issue #937
 * callback-promoted branch returns the identifier and renders NOTHING; a C
 * function's argument renders with the target parameter's type expected; a
 * C-Next parameter renders either by value or by reference. Rendering the
 * losing route would register that route's includes and `needs*` flags on
 * `CodeGenState` -- and on the by-reference route, `ArgumentGenerator`'s C++
 * member conversion draws `CodeGenState.getNextTempVarName()` and pushes onto
 * `pendingTempDeclarations`, so a discarded render emits a stray `_tmp<N>`
 * into the enclosing function and shifts the numbering of every later temp.
 *
 * ## `expressionType` is deferred too, and that one is subtler
 *
 * It registers nothing, so laziness costs it nothing either -- but it is a
 * read of MUTABLE render-time state (`TypeResolver` reaches
 * `CodeGenState.getVariableTypeInfo` and `currentScopePath`), and today every
 * site that asks it does so AFTER the argument has rendered. Asking eagerly
 * would move every argument's read ahead of every argument's render. No live
 * divergence was found; the thunk keeps the evaluation point exact rather
 * than relying on that staying true.
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
