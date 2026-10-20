/**
 * ADR-049: the ARM exclusive access an LDREX/STREX loop makes -- the
 * intrinsics, and the C type their pointer points to. 2.2 decides it once,
 * for an atomic whose C type is that type or its same-width signed twin
 * (#2208); 2.3 writes it as planned (#2155 review 9).
 */
interface IExclusiveAccess {
  readonly ldrex: string;
  readonly strex: string;
  /** The unsigned C type CMSIS's intrinsics take a pointer to */
  readonly pointee: string;
}

export default IExclusiveAccess;
