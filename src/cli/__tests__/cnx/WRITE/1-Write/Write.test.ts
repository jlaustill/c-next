import { describe, expect, it } from "vitest";

import Write from "../../../../../cnx/WRITE/1-Write/Write";
import MockFileSystem from "../../../MockFileSystem";

describe("Write", () => {
  it("creates a file's directory, then writes the file", () => {
    const fs = new MockFileSystem();
    Write.file(fs, "/out/sub/a.c", "int a;");
    expect(fs.getMkdirLog()).toEqual([{ path: "/out/sub", recursive: true }]);
    expect(fs.getWrittenContent("/out/sub/a.c")).toBe("int a;");
  });

  it("creates a directory that already exists without failing", () => {
    const fs = new MockFileSystem().addDirectory("/out");
    Write.directory(fs, "/out");
    expect(fs.isDirectory("/out")).toBe(true);
  });

  // #1991: 3.1 only writes. Every read method of the port throws here, so a
  // check before a write, such as `exists` before `mkdir`, fails the test.
  it("reads nothing from the filesystem", () => {
    const READS = new Set([
      "readFile",
      "exists",
      "isDirectory",
      "isFile",
      "readdir",
      "stat",
      "realpath",
    ]);
    const mock = new MockFileSystem().addFile("/out/old.c", "int a;");
    const fs = new Proxy(mock, {
      get(target, name, receiver) {
        if (typeof name === "string" && READS.has(name)) {
          throw new Error(`3.1 read the filesystem: ${name}`);
        }
        return Reflect.get(target, name, receiver);
      },
    });

    Write.file(fs, "/out/sub/a.c", "int a;");
    Write.directory(fs, "/out/sub");
    Write.move(fs, "/out/old.c", "/elsewhere/main.c");
    Write.remove(fs, "/out/sub/a.c");

    expect(mock.getMkdirLog().map((entry) => entry.path)).toEqual([
      "/out/sub",
      "/out/sub",
      "/elsewhere",
    ]);
  });

  it("removes a file", () => {
    const fs = new MockFileSystem().addFile("/out/a.c", "int a;");
    Write.remove(fs, "/out/a.c");
    expect(fs.exists("/out/a.c")).toBe(false);
  });

  it("moves a file, creating the destination's directory", () => {
    const fs = new MockFileSystem().addFile("/out/a.c", "int a;");
    Write.move(fs, "/out/a.c", "/elsewhere/main.c");
    expect(fs.exists("/out/a.c")).toBe(false);
    expect(fs.readFile("/elsewhere/main.c")).toBe("int a;");
    expect(fs.getMkdirLog()).toEqual([{ path: "/elsewhere", recursive: true }]);
  });
});
