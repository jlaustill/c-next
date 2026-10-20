import type IFileIncludes from "../types/IFileIncludes";

/** What 1.1 records of a file that includes nothing */
function noIncludes(): IFileIncludes {
  return {
    includeRewrites: new Map(),
    resolutions: new Map(),
    cnextAlternatives: new Map(),
    kinds: new Map(),
    quotedIncludeDirectory: "/p",
    generatedHeaderDirectory: "/p",
    headerIncludeDirectives: new Map(),
    writerRelativeIncludes: new Map(),
    userIncludes: [],
    cHeaderIncludes: [],
    cHeaderSpecs: [],
  };
}

export default noIncludes;
