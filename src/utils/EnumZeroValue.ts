import QualifiedCName from "./QualifiedCName";

/**
 * ADR-017: the value an enum zero-initializes to -- the member whose value is
 * 0, else the first member. Shared by declaration-site zero-init and
 * `StructDefault` (#1283, #1971), which gives every enum field and array
 * element this value.
 */
class EnumZeroValue {
  static of(
    enumMembers: ReadonlyMap<string, ReadonlyMap<string, number>>,
    enumName: string,
    separator: string = QualifiedCName.SEPARATOR,
  ): string {
    const members = enumMembers.get(enumName);
    if (!members) {
      return `(${enumName})0`;
    }

    for (const [memberName, value] of members.entries()) {
      if (value === 0) {
        return `${enumName}${separator}${memberName}`;
      }
    }

    const firstMember = members.keys().next().value;
    if (firstMember) {
      return `${enumName}${separator}${firstMember}`;
    }

    return `(${enumName})0`;
  }
}

export default EnumZeroValue;
