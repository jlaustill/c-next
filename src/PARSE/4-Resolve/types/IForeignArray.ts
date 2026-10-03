/** A C or C++ header's array, as its header declares it (#1175) */
interface IForeignArray {
  /** The element's C type, which C-Next does not measure */
  readonly type: string;
  readonly dimensions: ReadonlyArray<number | string>;
}

export default IForeignArray;
