import type TType from "../TType";

/**
 * Metadata for a register member.
 * Registers map memory-mapped I/O with typed access patterns.
 */
interface IRegisterMemberInfo {
  /** Offset from base address */
  readonly offset: number;

  /** Type of the register */
  readonly type: TType;

  /** Whether this register is read-only */
  readonly isReadOnly: boolean;
}

export default IRegisterMemberInfo;
