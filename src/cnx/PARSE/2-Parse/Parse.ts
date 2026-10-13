/**
 * 1.2 Parse over the run's C-Next files (#1991): each file 1.1 discovered, as
 * plain syntax. The tree is a local of `SourceSyntax.of` and never leaves 1.2.
 */
import type ISourceGraph from "../1-Discover/types/ISourceGraph";
import type TDiscoveryFacts from "../1-Discover/types/TDiscoveryFacts";
import type ITranspileError from "../../types/ITranspileError";
import SourceSyntax from "./SourceSyntax";
import TargetCatalogParser from "./TargetCatalogParser";
import type IParsedSource from "./types/IParsedSource";
import type IParsedSources from "./types/IParsedSources";

class Parse {
  /**
   * Each file that parsed cleanly, every other file's errors, the target
   * catalog 1.1 read, and the 1.1 facts that later passes read
   */
  static sources(
    graph: Pick<ISourceGraph, "cnextFiles" | "targetCatalog"> & TDiscoveryFacts,
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
      },
    };
  }
}

export default Parse;
