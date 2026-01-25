/**
 * Metadata for a register member.
 * Registers map memory-mapped I/O with typed access patterns.
 */
interface IRegisterMemberInfo {
  /** Offset from base address (as string to support expressions like "0x04") */
  offset: string;

  /** C type for the register (e.g., "uint32_t") */
  cType: string;

  /** Access mode for the register */
  access: "rw" | "ro" | "wo" | "w1c" | "w1s";

  /** Optional bitmap type for structured bit access */
  bitmapType?: string;
}

export default IRegisterMemberInfo;
