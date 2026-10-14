import Installation from "../Installation";
import NodeFileSystem from "../NodeFileSystem";
import noIncludes from "./noIncludes";
import type IPipelineFile from "../types/IPipelineFile";
import type ISourceGraph from "../types/ISourceGraph";

/**
 * The part of 1.1's graph 1.2 `Parse` reads, for in-memory files and the
 * installed catalog. Like 1.1, it records the includes of every file (here,
 * none), so a pass after it finds each file's facts.
 */
function testSourceGraph(
  files: readonly IPipelineFile[],
): Pick<
  ISourceGraph,
  | "cnextFiles"
  | "cppMode"
  | "anchor"
  | "includes"
  | "outputs"
  | "targetCatalog"
  | "headerMacroDumps"
  | "headerFiles"
  | "headerSources"
  | "cachedHeaders"
  | "recoveredDeclarations"
  | "run"
> {
  const catalog = Installation.catalog(NodeFileSystem.instance);
  return {
    cnextFiles: files,
    cppMode: false,
    anchor: {
      directory: "/p",
      projectRoot: undefined,
      defines: {},
      platformio: null,
    },
    includes: new Map(files.map((file) => [file.path, noIncludes()])),
    outputs: new Map(),
    headerMacroDumps: new Map(),
    headerFiles: [],
    headerSources: new Map(),
    cachedHeaders: new Map(),
    recoveredDeclarations: null,
    run: { debugMode: false, parseOnly: false, target: {} },
    targetCatalog: {
      path: catalog,
      text: NodeFileSystem.instance.readFile(catalog),
    },
  };
}

export default testSourceGraph;
