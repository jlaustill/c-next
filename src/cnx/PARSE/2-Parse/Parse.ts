/**
 * 1.2 Parse over the run's C-Next files (#1991): each file 1.1 discovered, as
 * plain syntax. The tree is a local of `SourceSyntax.of` and never leaves 1.2.
 */
import type ISourceGraph from "../1-Discover/types/ISourceGraph";
import type TDiscoveryFacts from "../1-Discover/types/TDiscoveryFacts";
import type ITranspileError from "../../types/ITranspileError";
import type IRecoveredDeclarations from "../1-Discover/types/IRecoveredDeclarations";
import invariant from "../../utils/invariant";
import HeaderParser from "./HeaderParser";
import SourceSyntax from "./SourceSyntax";
import type IParsedRecovery from "./types/IParsedRecovery";
import type TParsedHeaderEntry from "./types/TParsedHeaderEntry";
import TargetCatalogParser from "./TargetCatalogParser";
import type IParsedSource from "./types/IParsedSource";
import type IParsedSources from "./types/IParsedSources";

class Parse {
  /**
   * Each file that parsed cleanly, every other file's errors, the target
   * catalog 1.1 read, and the 1.1 facts that later passes read
   */
  static sources(
    graph: Pick<
      ISourceGraph,
      | "cnextFiles"
      | "targetCatalog"
      | "headerFiles"
      | "headerSources"
      | "cachedHeaders"
      | "recoveredDeclarations"
    > &
      TDiscoveryFacts,
  ): IParsedSources {
    const sources: IParsedSource[] = [];
    const errors: ITranspileError[] = [];
    for (const file of graph.cnextFiles) {
      const syntax = SourceSyntax.of(file.source);
      // #1445: 1.2 carries its own errors; this stamps the path the text
      // came from, the one fact 1.2 cannot know because it parses a string.
      const fileErrors = [...syntax.parseErrors, ...syntax.formErrors];
      if (fileErrors.length > 0) {
        errors.push(
          ...fileErrors.map((e) => ({ ...e, sourcePath: file.path })),
        );
      } else {
        sources.push({ file, syntax });
      }
    }
    return {
      headers: Parse._headers(graph),
      recovered: Parse._recovered(graph.recoveredDeclarations),
      sources,
      errors,
      targetCatalog: {
        path: graph.targetCatalog.path,
        source: TargetCatalogParser.parse(graph.targetCatalog.text),
      },
      discovery: {
        cppMode: graph.cppMode,
        anchor: graph.anchor,
        includes: graph.includes,
        outputs: graph.outputs,
        headerMacroDumps: graph.headerMacroDumps,
        run: graph.run,
      },
    };
  }

  /** #1991: each header 1.1 settled, in its order: its cache record, or its syntax */
  private static _headers(
    graph: Pick<
      ISourceGraph,
      "headerFiles" | "headerSources" | "cachedHeaders"
    >,
  ): TParsedHeaderEntry[] {
    return graph.headerFiles.map((file): TParsedHeaderEntry => {
      const cached = graph.cachedHeaders.get(file.path);
      if (cached !== undefined) return { file, ...cached };
      const source = graph.headerSources.get(file.path);
      invariant(
        source !== undefined,
        `1.1 settles the source of every header it resolves (missing ${file.path})`,
      );
      try {
        return {
          file,
          kind: "parsed",
          language: source.language,
          parsed: HeaderParser.parse(source),
        };
      } catch (error) {
        // #1319: 1.3 decides, in header order, whether it is a diagnostic
        return { file, kind: "failed", error };
      }
    });
  }

  /** Issue #985's slices, each parsed as its own language and as C */
  private static _recovered(
    recovered: IRecoveredDeclarations | null,
  ): IParsedRecovery | null {
    if (recovered === null) return null;
    return {
      slices: [...recovered.slices].map(([path, slice]) => ({
        path,
        parsed: HeaderParser.parse(slice),
        asC: HeaderParser.parseC(slice.text).syntax,
      })),
      macroNames: recovered.macroNames,
    };
  }
}

export default Parse;
