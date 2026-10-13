import Installation from "../Installation";
import NodeFileSystem from "../NodeFileSystem";
import type IPipelineFile from "../types/IPipelineFile";
import type ISourceGraph from "../types/ISourceGraph";

/** The part of 1.1's graph 1.2 `Parse` reads, for in-memory files and the installed catalog */
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
    includes: new Map(),
    outputs: new Map(),
    headerMacroDumps: new Map(),
    targetCatalog: {
      path: catalog,
      text: NodeFileSystem.instance.readFile(catalog),
    },
  };
}

export default testSourceGraph;
