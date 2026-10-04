import EnumMemberValues from "../EnumMemberValues";
import type IEnumSymbol from "../../types/symbols/IEnumSymbol";

/**
 * #1669: 1.3 records each enum member's value as written; its number is
 * settled by the one computation 1.4 uses. For an enum that names no const,
 * its own members are all the environment needs to answer.
 */
class SettledEnumValues {
  /** Each member's settled value, or the kind of answer it got instead */
  static of(symbol: IEnumSymbol): (number | string)[] {
    const members = [...symbol.members.values()];
    const names = members.map((member) => member.name);
    return EnumMemberValues.compute(members, (index, done) => ({
      cTypeName: (t) => t,
      valueOf: (name) =>
        EnumMemberValues.ownMember(
          names,
          index,
          done,
          name.path.at(-1)!,
          name.path.join("."),
          name.at,
        ),
    })).map((settled) =>
      settled.kind === "value" ? Number(settled.value) : settled.kind,
    );
  }
}

export default SettledEnumValues;
