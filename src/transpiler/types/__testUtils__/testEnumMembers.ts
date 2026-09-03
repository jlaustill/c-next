import type IEnumMemberSymbol from "../symbols/IEnumMemberSymbol";
import ScopeUtils from "../../../utils/ScopeUtils";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import TestSourceSpan from "./testSourceSpan";

/**
 * Builds the member map an `IEnumSymbol` carries, from a plain name-to-value
 * object.
 *
 * Members became symbols in #1318, so the one-line `new Map([["RED", 0]])` a
 * mock used to write is now nine fields per member. Spelling those at each site
 * would make a test about header emission read as a test about symbol identity,
 * and hand-written literals are how mocks drift from the interface they stand
 * in for -- the reason `testTypeAccessors` exists.
 *
 * Identity comes from `ScopeUtils.identityOf`, the same encoder the collector
 * uses, so a mock cannot assert an identifier the real collector would never
 * produce.
 */
class TestEnumMembers {
  static of(
    enumScopedName: string,
    values: Readonly<Record<string, number>>,
    sourceFile = "test.cnx",
  ): Map<string, IEnumMemberSymbol> {
    const members = new Map<string, IEnumMemberSymbol>();
    let line = 1;
    for (const [name, value] of Object.entries(values)) {
      line += 1;
      members.set(name, {
        kind: "enum_member",
        name,
        scopePath: enumScopedName,
        ...ScopeUtils.identityOf({ name, scopePath: enumScopedName }),
        sourceFile,
        // Distinct per member, so a test asserting that a member reports its
        // OWN position cannot pass by accident on a shared value.
        span: TestSourceSpan.at(line),
        sourceLanguage: ESourceLanguage.CNext,
        visibility: "public",
        value,
      });
    }
    return members;
  }
}

export default TestEnumMembers;
