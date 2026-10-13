/**
 * 1.2 Parse over the run's C-Next files (#1991): each file 1.1 discovered, as
 * plain syntax. The tree is a local of `SourceSyntax.of` and never leaves 1.2.
 */
import type IPipelineFile from "../1-Discover/types/IPipelineFile";
import type ITranspileError from "../../types/ITranspileError";
import SourceSyntax from "./SourceSyntax";
import type IParsedSource from "./types/IParsedSource";

class Parse {
  /** Each file that parsed cleanly, and every other file's errors */
  static sources(files: readonly IPipelineFile[]): {
    readonly sources: readonly IParsedSource[];
    readonly errors: readonly ITranspileError[];
  } {
    const sources: IParsedSource[] = [];
    const errors: ITranspileError[] = [];
    for (const file of files) {
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
    return { sources, errors };
  }
}

export default Parse;
