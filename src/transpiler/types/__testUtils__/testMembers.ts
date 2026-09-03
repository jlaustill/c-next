import type IBitmapFieldSymbol from "../symbols/IBitmapFieldSymbol";
import type IRegisterMemberSymbol from "../symbols/IRegisterMemberSymbol";
import type IStructFieldSymbol from "../symbols/IStructFieldSymbol";
import type TSymbolKindCNext from "../symbol-kinds/TSymbolKindCNext";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import ScopeUtils from "../../../utils/ScopeUtils";
import TestSourceSpan from "./testSourceSpan";

/**
 * Lifts the plain member records mocks used to write into member SYMBOLS.
 *
 * Struct fields, bitmap fields and register members became symbols in #1318,
 * so each one a mock builds now needs nine more fields. These helpers WRAP the
 * existing literal rather than replacing it, so a test that was about header
 * emission stays about header emission instead of turning into a test about
 * symbol identity.
 *
 * Identity comes from `ScopeUtils.identityOf` -- the same encoder
 * `MemberSymbolBase` uses in production -- so a mock cannot assert a key the
 * real collector would never produce. Spans are distinct per member, so a test
 * claiming a member reports its OWN position cannot pass by coincidence.
 */
class TestMembers {
  private static base(
    kind: TSymbolKindCNext,
    name: string,
    ownerScopedName: string,
    line: number,
  ) {
    return {
      kind,
      name,
      scopePath: ownerScopedName,
      ...ScopeUtils.identityOf({ name, scopePath: ownerScopedName }),
      sourceFile: "test.cnx",
      span: TestSourceSpan.at(line),
      sourceLanguage: ESourceLanguage.CNext,
      visibility: "public" as const,
    };
  }

  static asStructFields(
    ownerScopedName: string,
    fields: ReadonlyMap<
      string,
      Omit<IStructFieldSymbol, keyof ReturnType<typeof TestMembers.base>>
    >,
  ): Map<string, IStructFieldSymbol> {
    const out = new Map<string, IStructFieldSymbol>();
    let line = 1;
    for (const [name, rest] of fields) {
      line += 1;
      out.set(name, {
        ...TestMembers.base("struct_field", name, ownerScopedName, line),
        ...rest,
        kind: "struct_field",
      });
    }
    return out;
  }

  static asBitmapFields(
    ownerScopedName: string,
    fields: ReadonlyMap<string, { offset: number; width: number }>,
  ): Map<string, IBitmapFieldSymbol> {
    const out = new Map<string, IBitmapFieldSymbol>();
    let line = 1;
    for (const [name, rest] of fields) {
      line += 1;
      out.set(name, {
        ...TestMembers.base("bitmap_field", name, ownerScopedName, line),
        ...rest,
        kind: "bitmap_field",
      });
    }
    return out;
  }

  static asRegisterMembers(
    ownerScopedName: string,
    members: ReadonlyMap<
      string,
      Omit<IRegisterMemberSymbol, keyof ReturnType<typeof TestMembers.base>>
    >,
  ): Map<string, IRegisterMemberSymbol> {
    const out = new Map<string, IRegisterMemberSymbol>();
    let line = 1;
    for (const [name, rest] of members) {
      line += 1;
      out.set(name, {
        ...TestMembers.base("register_member", name, ownerScopedName, line),
        ...rest,
        kind: "register_member",
      });
    }
    return out;
  }
}

export default TestMembers;
