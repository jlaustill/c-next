import Installation from "../../../1-Discover/Installation";
import NodeFileSystem from "../../../1-Discover/NodeFileSystem";
import type IFileSystem from "../../../../types/IFileSystem";
import Preprocessor from "../Preprocessor";
import type PreprocessCache from "../PreprocessCache";
import ToolchainDetector from "../ToolchainDetector";
import type IToolchain from "../types/IToolchain";

/** The host's gcc run, as the transpiler builds one for a `host` target (#1713) */
function testPreprocessor(
  fs: IFileSystem = NodeFileSystem.instance,
  toolchain: IToolchain | null = ToolchainDetector.fromPath("gcc", fs),
  cache: PreprocessCache | null = null,
): Preprocessor {
  return new Preprocessor(fs, toolchain, {
    headerFreeDirectory: Installation.headerFreeDirectory(fs),
    cache,
  });
}

export default testPreprocessor;
