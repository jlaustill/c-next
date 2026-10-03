import type IBaseSymbol from "./IBaseSymbol";
import type TType from "../TType";

/**
 * Symbol representing one field of a struct.
 *
 * Was `IFieldInfo`, a plain record with no position and no identity (#1318).
 * Every field of a struct declared across twenty lines reported the struct's
 * line, or reported nothing at all, because there was nowhere to put one.
 *
 * `fullyQualifiedCName` here is an INDEX KEY, not an emitted identifier -- see
 * the note on `IBaseSymbol`. A struct field is emitted `p.x`; `SPoint__x` is
 * what distinguishes this field from `SOther__x` in the symbol table, and
 * nothing generated ever contains it.
 */
interface IStructFieldSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "struct_field" */
  readonly kind: "struct_field";

  /** Field type */
  readonly type: TType;

  /** Whether this field is const */
  readonly isConst: boolean;

  /** Whether this field is atomic (volatile in C) */
  readonly isAtomic: boolean;

  /** Whether this field is an array */
  readonly isArray: boolean;

  /** Array dimensions if isArray is true */
  readonly dimensions?: ReadonlyArray<number | string>;
}

export default IStructFieldSymbol;
