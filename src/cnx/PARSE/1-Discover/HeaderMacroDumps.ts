/**
 * #1688: each C-Next file's header macros, as the preprocessor's `-dM` dump of
 * that file's own C includes -- so a file sees the macros C sees for it, system
 * headers and compiler builtins included, and no other file's.
 *
 * #1991: run here, in 1.1, because running the preprocessor is discovery's.
 * The host used to run it after 1.1 had returned.
 */
import { availableParallelism } from "node:os";

import ConcurrencyLimit from "../../utils/ConcurrencyLimit";
import ExternalDeclarationOracle from "./preprocessor/ExternalDeclarationOracle";
import type PreprocessCache from "./preprocessor/PreprocessCache";
import type Preprocessor from "./preprocessor/Preprocessor";
import type IFileIncludes from "./types/IFileIncludes";
import type IHeaderMacroDump from "./types/IHeaderMacroDump";
import type IPipelineFile from "./types/IPipelineFile";

class HeaderMacroDumps {
  /** Every C-Next file with a C include, to its dump */
  static async read(
    files: readonly IPipelineFile[],
    includes: ReadonlyMap<string, IFileIncludes>,
    preprocessor: Preprocessor,
    options: {
      readonly includeSearchPaths: readonly string[];
      readonly defines: Readonly<Record<string, string | boolean>>;
      readonly cache: PreprocessCache | null;
    },
  ): Promise<ReadonlyMap<string, IHeaderMacroDump>> {
    const withIncludes = files.flatMap((file) => {
      const own = includes.get(file.path);
      return own === undefined || own.cHeaderSpecs.length === 0
        ? []
        : [{ file, own }];
    });
    // Without a preprocessor a macro has no type, as before #1688
    if (!preprocessor.isAvailable()) {
      return new Map(
        withIncludes.map(({ file }) => [
          file.path,
          { dump: null, complete: false },
        ]),
      );
    }
    const limit = ConcurrencyLimit.create(availableParallelism());
    const dumps = await Promise.all(
      withIncludes.map(async ({ file, own }) => {
        const read = await limit(() =>
          ExternalDeclarationOracle.macroDump(own.cHeaderSpecs, preprocessor, {
            // The file's own directory first, as C searches a quoted include
            includePaths: [
              own.quotedIncludeDirectory,
              ...options.includeSearchPaths,
            ],
            defines: { ...options.defines },
            ...(options.cache === null ? {} : { cache: options.cache }),
          }),
        );
        const dump: IHeaderMacroDump = {
          dump: read?.dump ?? null,
          complete: read?.complete === true,
        };
        return [file.path, dump] as const;
      }),
    );
    return new Map(dumps);
  }
}

export default HeaderMacroDumps;
