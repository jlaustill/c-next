import { dirname } from "node:path";

import IFileSystem from "../../types/IFileSystem";
import type IRenderedOutput from "../../TRANSPILE/3-Render/types/IRenderedOutput";

/**
 * 3.1 Write: the only module that changes the filesystem (#1653, carrying
 * #1451 box 1).
 *
 * Every file written, directory created, file deleted and file moved goes
 * through here, and through the port the host injected. Reads go through the
 * port directly, since reading changes nothing. A path is decided before it
 * arrives: naming an output never creates its directory, and writing it does.
 * `write-confined-to-3-1.test.ts` holds that no other module calls the port's
 * mutating methods.
 */
class Write {
  /** 3.1's entry: every file 2.3 rendered, written where 1.1 named it (#1991) */
  static outputs(fs: IFileSystem, outputs: readonly IRenderedOutput[]): void {
    for (const output of outputs) {
      Write.file(fs, output.path, output.content);
    }
  }

  /** Write `content` to `path`, creating its directory first. */
  static file(fs: IFileSystem, path: string, content: string): void {
    Write.directory(fs, dirname(path));
    fs.writeFile(path, content);
  }

  /**
   * Create `path` and its parents. A recursive `mkdir` is a no-op on a
   * directory that exists, so 3.1 asks the filesystem nothing first (#1991).
   */
  static directory(fs: IFileSystem, path: string): void {
    fs.mkdir(path, { recursive: true });
  }

  /** Delete the file at `path`. */
  static remove(fs: IFileSystem, path: string): void {
    fs.unlink(path);
  }

  /** Move the file at `from` to `to`, creating `to`'s directory first. */
  static move(fs: IFileSystem, from: string, to: string): void {
    Write.directory(fs, dirname(to));
    fs.rename(from, to);
  }
}

export default Write;
