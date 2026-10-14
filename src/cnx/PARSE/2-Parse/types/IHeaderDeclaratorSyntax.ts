import type IExtractedParameter from "../shared/IExtractedParameter";

/**
 * One C or C++ declarator as 1.2 lowers it (#1991): what 1.3 declares from
 * `x`, `*p`, `f(int a)`, `(*cb)(int)` or `buf[4]`.
 */
interface IHeaderDeclaratorSyntax {
  readonly name: string | null;
  /** It takes a parameter list: a function, or a pointer to one */
  readonly isFunction: boolean;
  /** It spells a pointer operator (in C++ a reference `&` counts too) */
  readonly hasPointer: boolean;
  /** How many `*` it spells */
  readonly pointerDepth: number;
  /** A function pointer's parameter list as written, else null */
  readonly functionPointerParams: string | null;
  readonly parameters: readonly IExtractedParameter[];
  readonly arrayDimensions: readonly (number | string)[];
}

export default IHeaderDeclaratorSyntax;
