import { describe, expect, it } from "vitest";

import Write from "../Write";
import MockFileSystem from "../../../cli/__tests__/MockFileSystem";

describe("Write", () => {
  it("creates a file's directory, then writes the file", () => {
    const fs = new MockFileSystem();
    Write.file(fs, "/out/sub/a.c", "int a;");
    expect(fs.getMkdirLog()).toEqual([{ path: "/out/sub", recursive: true }]);
    expect(fs.getWrittenContent("/out/sub/a.c")).toBe("int a;");
  });

  it("creates no directory that already exists", () => {
    const fs = new MockFileSystem().addDirectory("/out");
    Write.file(fs, "/out/a.c", "int a;");
    Write.directory(fs, "/out");
    expect(fs.getMkdirLog()).toEqual([]);
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
