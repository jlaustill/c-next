import type IStringConcatOps from "./IStringConcatOps";
import type ISubstringOps from "./ISubstringOps";

/**
 * How a bounded string's initializer is rendered (ADR-045).
 *
 * `string<N> s <- ...` admits four initializers and they are distinguished in
 * a FIXED ORDER: concatenation, then substring extraction, then a literal,
 * then a copy from another string. The order is not cosmetic -- each question
 * is asked of the same expression, and the first that answers wins -- so this
 * is a record whose fields are consulted in declaration order rather than a
 * union whose arm is already chosen.
 *
 * ## Why the last two questions are thunks
 *
 * Generating an expression registers effects: it can request an include and it
 * can allocate a C++ temp into `pendingTempDeclarations`, which the enclosing
 * block then emits. An effect raised for a value that is afterwards discarded
 * changes the emitted C. So a field whose answer is needed on only SOME arms
 * comes over unevaluated, and the renderer pays for exactly the arm it takes.
 *
 * `concat` is the exception and is eager: deciding it reads the type registry
 * by name and generates nothing (`StringOperationsHelper.getStringConcatOperands`
 * takes two source texts), so asking it always costs what asking it once cost.
 *
 * `renderSubstring` is the sharp one. `getSubstringOperands` asks the source's
 * capacity FIRST -- that lookup is what makes `s[i]` a substring rather than an
 * array index -- and generates the index expressions only once the answer is
 * yes. Calling it is therefore free when it declines and raises effects when
 * it does not, which is precisely the combination that must not be hoisted to
 * plan time on the chance that a caller wants it.
 */
interface IPlannedStringInit {
  /**
   * ADR-045 concatenation operands, or null.
   *
   * Asked FIRST. Pure -- see the class comment.
   */
  readonly concat: IStringConcatOps | null;

  /**
   * ADR-045 substring operands, or null when the source is not a string.
   *
   * Asked SECOND, and only when `concat` is null. Raises effects when it
   * answers, none when it declines.
   */
  readonly renderSubstring: () => ISubstringOps | null;

  /**
   * The initializer's SOURCE text.
   *
   * What decides literal-versus-copy, and what the capacity diagnostics quote.
   * It is deliberately not generated code: a string literal's length and a
   * declared string's capacity are both answered from the spelling.
   */
  readonly text: string;

  /**
   * The initializer as generated C.
   *
   * Asked LAST, on the literal and copy arms only.
   */
  readonly render: () => string;
}

export default IPlannedStringInit;
