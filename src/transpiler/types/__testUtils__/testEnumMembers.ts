import type IEnumMemberSymbol from "../symbols/IEnumMemberSymbol";
import TestMembers from "./testMembers";

/**
 * Builds the member map an `IEnumSymbol` carries, from a name-to-value object.
 *
 * Delegates to `TestMembers`, which owns what a member symbol's base half looks
 * like. This file used to hand-copy those nine fields (#1318 review), which is
 * the duplication `MemberSymbolBase` prevents on the production side leaking
 * back in on the mock side: a tenth field on `IBaseSymbol` meant editing two
 * places, and they would have drifted silently because a different set of tests
 * exercises each.
 *
 * Kept as a named entry point because `enum_member` is the one member kind with
 * a payload of its own (`value`), and call sites read better for it.
 */
class TestEnumMembers {
  static of(
    enumScopedName: string,
    values: Readonly<Record<string, number>>,
    sourceFile = "test.cnx",
  ): Map<string, IEnumMemberSymbol> {
    return TestMembers.asEnumMembers(enumScopedName, values, sourceFile);
  }
}

export default TestEnumMembers;
