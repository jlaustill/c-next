/** A C++ enum specifier as 1.2 lowers it (#1991) */
interface ICppEnumSyntax {
  readonly name: string | null;
  /** The underlying type as written, `uint8_t` in `enum E : uint8_t` */
  readonly baseType: string | null;
}

export default ICppEnumSyntax;
