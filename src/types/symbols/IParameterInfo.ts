import type TType from "../TType";
import type TConstExpr from "../TConstExpr";

/**
 * Metadata for a function parameter.
 */
interface IParameterInfo {
  /** Parameter name */
  readonly name: string;

  /** Parameter type */
  readonly type: TType;

  /** Whether this parameter is const */
  readonly isConst: boolean;

  /** Whether this parameter is an array */
  readonly isArray: boolean;

  /** Array dimensions if isArray is true */
  readonly arrayDimensions?: ReadonlyArray<number | string>;
  /**
   * #1175: each dimension as written, index-aligned with the dimensions --
   * null where 1.3 already knew the size (a literal, `sizeof` of a primitive,
   * an unsized `[]`). 1.4 Resolve settles the rest from this, never from
   * source text.
   */
  readonly arrayDimensionExprs?: ReadonlyArray<TConstExpr | null>;

  /** Issue #268: true if parameter should get auto-const (unmodified pointer) */
  readonly isAutoConst?: boolean;

  /**
   * ADR-030 / #1722: the parameter's type is an opaque (incomplete) C type, so
   * it is held through a pointer -- for an array, each element is. Decided
   * once, by 1.4 Resolve, which knows which typedefs never received a body;
   * the `.c` signature, its call sites and the `.h` prototype all read this
   * stamp rather than asking the type again, so they cannot disagree.
   */
  readonly isOpaqueHandle?: boolean;
}

export default IParameterInfo;
