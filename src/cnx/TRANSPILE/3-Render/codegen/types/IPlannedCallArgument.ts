import type IPlannedArgument from "../../../2-Plan/types/IPlannedArgument";
import type TParameterInfo from "../../../../types/TParameterInfo";
/**
 * One argument of a function call, reduced to what the call generator asks of
 * it (#1445 box 3).
 *
 * The generator asks an argument node three things and nothing else: is it a
 * bare identifier, render it, and render it through ADR-006 reference
 * semantics. 2.2 decided everything else, `&` included (#1991). Both renders
 * are deferred, for the reason below.
 *
 * ## Exactly one render happens per argument, and which one is the decision
 *
 * An argument takes one of three mutually exclusive routes: the Issue #937
 * callback-promoted branch returns the identifier and renders NOTHING; a C
 * function's argument renders with the target parameter's type expected; a
 * cnx parameter renders either by value or by reference. Rendering the
 * losing route would register that route's includes and `needs*` flags on
 * `TranspileState` -- and on the by-reference route, `ArgumentGenerator`'s C++
 * member conversion draws `TranspileState.getNextTempVarName()` and pushes onto
 * `pendingTempDeclarations`, so a discarded render emits a stray `_tmp<N>`
 * into the enclosing function and shifts the numbering of every later temp.
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

  /**
   * #1969: the current function's parameter `simpleIdentifier` binds to where
   * the argument is written; undefined for any other argument. Eager for the
   * same reason.
   */
  readonly parameter: TParameterInfo | undefined;

  /**
   * The argument, rendered.
   *
   * Zero-argument on purpose: Issue #872's expected type, and the ADR-gated
   * bare-enum suppression with it, are planned by 2.2 for the argument's own
   * expression (#1991), so the generator passes nothing in.
   */
  readonly render: () => string;

  /** The argument, rendered by reference in the form 2.2 planned (ADR-006) */
  readonly renderByReference: () => string;

  /** 2.2's decision for how this argument is passed and written (#1991) */
  readonly planned: IPlannedArgument;
}

export default IPlannedCallArgument;
