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
  /** Its parameter list ends in `...` */
  readonly isVariadic: boolean;
  /**
   * C's `f()` or `f(a, b)`: a parameter list with no parameter types, so no
   * prototype (C11 6.7.6.3p14). C++ never sets it: there `f()` is `f(void)`.
   */
  readonly isUnprototyped?: boolean;
  /** A C++ member function declared `const`: `int get() const;` */
  readonly isConstMember: boolean;
  readonly arrayDimensions: readonly (number | string)[];
  /**
   * A bit-field's declared width, `uint32_t a : 3`: a number, or the
   * expression as written when it is no integer literal (#1975 review)
   */
  readonly bitWidth?: number | string;
}

export default IHeaderDeclaratorSyntax;
