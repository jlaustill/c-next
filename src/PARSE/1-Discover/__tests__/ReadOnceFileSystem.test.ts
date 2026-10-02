import { describe, it, expect } from "vitest";

import ReadOnceFileSystem from "../ReadOnceFileSystem";
import MockFileSystem from "../../../transpiler/__tests__/MockFileSystem";

/** A host that counts the reads that reach it. */
class CountingFileSystem extends MockFileSystem {
  readonly reads = new Map<string, number>();

  override readFile(path: string): string {
    this.reads.set(path, (this.reads.get(path) ?? 0) + 1);
    return super.readFile(path);
  }
}

describe("ReadOnceFileSystem (#1444, owner ruling 3)", () => {
  it("reads a file's text from the host once, however often it is asked", () => {
    const host = new CountingFileSystem().addFile("/p/platformio.ini", "[a]");
    const view = new ReadOnceFileSystem(host);

    expect(view.readFile("/p/platformio.ini")).toBe("[a]");
    expect(view.readFile("/p/platformio.ini")).toBe("[a]");

    expect(host.reads.get("/p/platformio.ini")).toBe(1);
  });

  it("serves the text it first read when the file changes underneath it", () => {
    const host = new CountingFileSystem().addFile("/p/platformio.ini", "[a]");
    const view = new ReadOnceFileSystem(host);

    view.readFile("/p/platformio.ini");
    host.addFile("/p/platformio.ini", "[b]");

    // One run sees one version: this is the property, not a staleness bug
    expect(view.readFile("/p/platformio.ini")).toBe("[a]");
  });

  // 3.1 Write owns every change to the filesystem (#1653), and 1.1 changes
  // nothing, so the view refuses rather than forwards.
  it.each([
    ["writeFile", (view: ReadOnceFileSystem) => view.writeFile("/p/out.c")],
    ["mkdir", (view: ReadOnceFileSystem) => view.mkdir("/p/out")],
    ["unlink", (view: ReadOnceFileSystem) => view.unlink("/p/out.c")],
    ["rename", (view: ReadOnceFileSystem) => view.rename("/p/a.c")],
  ] as const)("refuses %s", (_method, change) => {
    const host = new CountingFileSystem().addFile("/p/out.c", "old");

    expect(() => change(new ReadOnceFileSystem(host))).toThrow(
      "1.1 Discover changes nothing on disk",
    );
    expect(host.getWriteLog()).toEqual([]);
  });

  it("refuses the preprocessor's scratch file", () => {
    const view = new ReadOnceFileSystem(new CountingFileSystem());

    expect(() => view.withTempFile("t.h")).toThrow(
      "1.1 Discover changes nothing on disk",
    );
  });

  it("does not remember a read that failed", () => {
    const host = new CountingFileSystem();
    const view = new ReadOnceFileSystem(host);

    expect(() => view.readFile("/p/later.cnx")).toThrow();
    host.addFile("/p/later.cnx", "void main() { }");

    expect(view.readFile("/p/later.cnx")).toBe("void main() { }");
  });
});
