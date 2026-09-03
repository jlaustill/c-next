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
interface IRegisterMemberSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "register_member" */
  readonly kind: "register_member";

  /** Offset from base address (as string to support expressions like "0x04") */
  readonly offset: string;

  /** C type for the register (e.g., "uint32_t") */
  readonly cType: string;

  /** Access mode for the register */
  readonly access: "rw" | "ro" | "wo" | "w1c" | "w1s";

  /** Optional bitmap type for structured bit access */
  readonly bitmapType?: string;
}

export default IRegisterMemberSymbol;
