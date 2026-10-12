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
interface IRegisterMemberSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "register_member" */
  readonly kind: "register_member";

  /** The offset from the base address as 1.2 lowered it; 2.3 renders it (#1991) */
  readonly offset: TExpression;

  /** C type for the register (e.g., "uint32_t") */
  readonly cType: string;

  /** Access mode for the register */
  readonly access: TRegisterAccessMode;

  /** Optional bitmap type for structured bit access */
  readonly bitmapType?: string;
}

export default IRegisterMemberSymbol;
