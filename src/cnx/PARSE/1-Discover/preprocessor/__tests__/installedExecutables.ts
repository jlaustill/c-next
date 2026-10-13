import IFileSystem from "../../../../types/IFileSystem";

/**
 * A filesystem holding exactly these executables and nothing else: what
 * ToolchainDetector's PATH search and existence checks see. It reads and writes
 * nothing, so every other method throws.
 */
function installedExecutables(...paths: string[]): IFileSystem {
  const files = new Set(paths);
  const unused = (): never => {
    throw new Error("ToolchainDetector reads and writes no files");
  };
  return {
    exists: (path: string) => files.has(path),
    isFile: (path: string) => files.has(path),
    isExecutable: (path: string) => files.has(path),
    isDirectory: () => false,
    readFile: unused,
    writeFile: unused,
    mkdir: unused,
    unlink: unused,
    rename: unused,
    withTempFile: unused,
    readdir: unused,
    stat: unused,
  };
}

export default installedExecutables;
