import IFileSystem from "../IFileSystem";

/**
 * `IFileSystem` doubles for unit tests. The members a test names answer; every
 * other member throws, naming itself, so a test that reaches a member it did not
 * stub fails instead of reading an invented answer.
 *
 * One builder, so a new `IFileSystem` member is one edit here (#1827 added
 * `isExecutable` and had to edit nine hand-written doubles). No cast on the
 * literal below: without one, a new required member makes `tsc` name this file.
 */
class TestFileSystem {
  static with(overrides: Partial<IFileSystem>): IFileSystem {
    return {
      readFile: TestFileSystem.notStubbed("readFile"),
      writeFile: TestFileSystem.notStubbed("writeFile"),
      exists: TestFileSystem.notStubbed("exists"),
      isDirectory: TestFileSystem.notStubbed("isDirectory"),
      isFile: TestFileSystem.notStubbed("isFile"),
      isExecutable: TestFileSystem.notStubbed("isExecutable"),
      mkdir: TestFileSystem.notStubbed("mkdir"),
      unlink: TestFileSystem.notStubbed("unlink"),
      rename: TestFileSystem.notStubbed("rename"),
      readdir: TestFileSystem.notStubbed("readdir"),
      stat: TestFileSystem.notStubbed("stat"),
      ...overrides,
    };
  }

  /**
   * A filesystem holding exactly these executable files and nothing else: what
   * `ToolchainDetector`'s PATH search and existence checks see.
   */
  static installedExecutables(...paths: string[]): IFileSystem {
    const files = new Set(paths);
    return TestFileSystem.with({
      exists: (path: string) => files.has(path),
      isFile: (path: string) => files.has(path),
      isExecutable: (path: string) => files.has(path),
      isDirectory: () => false,
    });
  }

  private static notStubbed(member: keyof IFileSystem): () => never {
    return () => {
      throw new Error(`IFileSystem.${member} is not stubbed by this test`);
    };
  }
}

export default TestFileSystem;
