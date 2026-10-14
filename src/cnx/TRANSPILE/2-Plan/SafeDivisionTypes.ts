import TYPE_MAP from "./types/TYPE_MAP";

/**
 * ADR-051: the C types a `cnx_safe_div`/`cnx_safe_mod` helper is written in
 * -- 2.2 plans its headers from them and 2.3 writes them (#1991)
 */
class SafeDivisionTypes {
  /** The helper returns whether the divisor was zero */
  static readonly RESULT_C_TYPE = "bool";

  /** The C type of the helper's output, operands and default */
  static operandOf(cnxType: string): string {
    return TYPE_MAP[cnxType];
  }

  /** Every C type the helper for `cnxType` writes */
  static cTypesOf(cnxType: string): readonly string[] {
    return [
      SafeDivisionTypes.RESULT_C_TYPE,
      SafeDivisionTypes.operandOf(cnxType),
    ];
  }
}

export default SafeDivisionTypes;
