/**
 * SPIKE #1431 — THROWAWAY. Deleted before this branch merges.
 *
 * Builds the normalized `IFactStore` from what the transpiler already has, so the
 * derived views are computed over the SAME facts the live containers were built
 * from. Nothing here parses or re-derives: if a fact is not already carried by a
 * symbol, a pipeline file, or the symbol table, it does not enter the store.
 *
 * Two things the schema surfaces that the containers hide, both findings rather
 * than inconveniences:
 *
 * 1. `visibility` is declared on `IFunctionSymbol` and on NO other variant.
 *    `IScopeSymbol` carries `memberVisibility` for its members instead, and the
 *    remaining five kinds carry nothing. So this builder falls back to
 *    `isExported`, which the architecture doc says is not a fact at all -- it is
 *    visibility minus ADR-030's `main` exemption minus "a scope is a container".
 *    Normalizing turns that gap into a column you can count rather than a question
 *    nobody thought to ask. It is #1300.
 *
 * 2. Members have no `TSymbol` variant. `TSymbolKindCNext` admits `enum_member`,
 *    `bitmap_field` and `register_member`; the union has no interface for any of
 *    them, so they live inside their owner as three differently-shaped maps. The
 *    `member` table is where they become rows.
 */
import type IFactStore from "./types/IFactStore";
import type ISymbolRow from "./types/ISymbolRow";
import type IScopeRow from "./types/IScopeRow";
import type IFileRow from "./types/IFileRow";
import type IIncludeEdgeRow from "./types/IIncludeEdgeRow";
import type IMemberRow from "./types/IMemberRow";
import type IPipelineFile from "../../../types/IPipelineFile";
import type TSymbol from "../../../types/symbols/TSymbol";
import type TCSymbol from "../../../types/symbols/c/TCSymbol";
import type TCppSymbol from "../../../types/symbols/cpp/TCppSymbol";
import type IScopeSymbol from "../../../types/symbols/IScopeSymbol";
import ScopeUtils from "../../../../utils/ScopeUtils";

class FactStoreBuilder {
  /**
   * The scope's id in the `scope` table: its transpiled path, empty for global.
   * Uses `ScopeUtils.getScopePath` -- the ONE encoder -- rather than re-deriving,
   * which is the re-derivation #1285 spent seven PRs retiring.
   */
  private static scopeId(scope: IScopeSymbol): string {
    return ScopeUtils.getScopePath(scope).join("__");
  }

  private static collectScopes(symbols: readonly TSymbol[]): IScopeRow[] {
    const rows = new Map<string, IScopeRow>();
    const visit = (scope: IScopeSymbol): void => {
      const id = FactStoreBuilder.scopeId(scope);
      if (rows.has(id)) {
        return;
      }
      const parent: IScopeSymbol | undefined = scope.parent;
      const parentId =
        parent && !ScopeUtils.isGlobalScope(scope)
          ? FactStoreBuilder.scopeId(parent)
          : null;
      rows.set(id, {
        id,
        name: scope.name,
        parentId,
        sourceFile: scope.sourceFile,
      });
      if (parent && parent !== scope) {
        visit(parent);
      }
    };
    for (const symbol of symbols) {
      visit(symbol.scope);
    }
    return [...rows.values()];
  }

  private static membersOf(symbol: TSymbol): IMemberRow[] {
    const owner = symbol.fullyQualifiedCName;
    const rows: IMemberRow[] = [];
    let ordinal = 0;

    if (symbol.kind === "enum") {
      for (const [name, value] of symbol.members) {
        rows.push({
          ownerCName: owner,
          name,
          ordinal: ordinal++,
          kind: "enum_member",
          declaredType: owner,
          arrayDimensions: [],
          value,
          width: null,
        });
      }
      return rows;
    }
    if (symbol.kind === "struct") {
      for (const [name, field] of symbol.fields) {
        rows.push({
          ownerCName: owner,
          name,
          ordinal: ordinal++,
          kind: "struct_field",
          declaredType: JSON.stringify(field.type),
          arrayDimensions: field.dimensions ?? [],
          value: null,
          width: null,
        });
      }
      return rows;
    }
    if (symbol.kind === "bitmap") {
      for (const [name, field] of symbol.fields) {
        rows.push({
          ownerCName: owner,
          name,
          ordinal: ordinal++,
          kind: "bitmap_field",
          declaredType: symbol.backingType,
          arrayDimensions: [],
          value: field.offset,
          width: field.width,
        });
      }
      return rows;
    }
    if (symbol.kind === "register") {
      for (const [name, member] of symbol.members) {
        rows.push({
          ownerCName: owner,
          name,
          ordinal: ordinal++,
          kind: "register_member",
          declaredType: member.cType,
          arrayDimensions: [],
          value: null,
          width: null,
        });
      }
    }
    return rows;
  }

  /**
   * `visibility` as DECLARED, or the `isExported` fallback where the variant does not
   * carry it. The fallback is #1300 and is deliberately marked rather than hidden: a
   * run can count how many rows fell back, which is the defect's size.
   */
  private static visibilityOf(symbol: TSymbol): string {
    if (symbol.kind === "function") {
      return symbol.visibility;
    }
    return symbol.isExported ? "public(derived)" : "private(derived)";
  }

  /**
   * Foreign symbols carry SIX fields where a C-Next symbol carries nine, and the
   * three missing ones are `fullyQualifiedCName`, `cnxScopedName` and `scope` --
   * the primary key and the scope foreign key.
   *
   * That is not an oversight to paper over, it is the reason `NameExistence` has to
   * route at all: a C-Next name is checked against the per-file sets and a foreign
   * name against the run-wide table, because the two halves of the "one fact set" do
   * not share an identity model. C has no scoping, so a foreign symbol's name IS its
   * C name and ADR-063 injectivity holds trivially -- which is what makes the two
   * shapes reconcilable into one table at all.
   */
  private static foreignRow(symbol: TCSymbol | TCppSymbol): ISymbolRow {
    return {
      fullyQualifiedCName: symbol.name,
      name: symbol.name,
      cnxScopedName: symbol.name,
      kind: symbol.kind,
      scopeId: "",
      sourceFile: symbol.sourceFile,
      sourceLine: symbol.sourceLine,
      sourceLanguage: String(symbol.sourceLanguage),
      visibility: symbol.isExported ? "public(derived)" : "private(derived)",
    };
  }

  static build(
    symbols: readonly TSymbol[],
    files: readonly IPipelineFile[],
    foreign: ReadonlyArray<TCSymbol | TCppSymbol> = [],
  ): IFactStore {
    const symbolRows: ISymbolRow[] = symbols.map((symbol) => ({
      fullyQualifiedCName: symbol.fullyQualifiedCName,
      name: symbol.name,
      cnxScopedName: symbol.cnxScopedName,
      kind: symbol.kind,
      scopeId: FactStoreBuilder.scopeId(symbol.scope),
      sourceFile: symbol.sourceFile,
      sourceLine: symbol.sourceLine,
      sourceLanguage: String(symbol.sourceLanguage),
      visibility: FactStoreBuilder.visibilityOf(symbol),
    }));

    const fileRows: IFileRow[] = files.map((file, index) => ({
      path: file.path,
      language: file.discoveredFile.extension,
      topoIndex: index,
      reachesForeignHeader: file.reachesForeignHeader ?? true,
    }));

    const includeEdges: IIncludeEdgeRow[] = [];
    for (const file of files) {
      for (const include of file.cnextIncludes ?? []) {
        includeEdges.push({
          dependent: file.path,
          dependency: include.path,
          kind: "cnx",
        });
      }
    }

    const members = symbols.flatMap((symbol) =>
      FactStoreBuilder.membersOf(symbol),
    );

    for (const symbol of foreign) {
      symbolRows.push(FactStoreBuilder.foreignRow(symbol));
    }

    return {
      symbols: symbolRows,
      scopes: FactStoreBuilder.collectScopes(symbols),
      files: fileRows,
      includeEdges,
      members,
    };
  }
}

export default FactStoreBuilder;
