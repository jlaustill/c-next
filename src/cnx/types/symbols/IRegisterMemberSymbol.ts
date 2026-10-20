import type IBaseSymbol from "./IBaseSymbol";

/**
 * Symbol representing one memory-mapped member of a register block.
 *
 * Was `IRegisterMemberInfo`, which like the bitmap field carried no name and no
 * position (#1318).
 *
 * `fullyQualifiedCName` is an INDEX KEY, not an emitted identifier: a register
 * member is emitted as an offset from a base address.
 */
import type TRegisterAccessMode from "../TRegisterAccessMode";
import type TExpression from "../syntax/TExpression";
import type TType from "../TType";
interface IRegisterMemberSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "register_member" */
  readonly kind: "register_member";

  /** The offset from the base address as 1.2 lowered it; 2.3 renders it (#1991) */
  readonly offset: TExpression;

  /**
   * The member's type as written, settled by 1.4 Resolve like any other
   * (#1514). Whether it is a bitmap is asked of the names the file can see
   * (`DeclaredTypeFacts.registerMemberBitmap`), never stored here: Declare
   * sees one file.
   */
  readonly type: TType;

  /** Access mode for the register */
  readonly access: TRegisterAccessMode;
}

export default IRegisterMemberSymbol;
