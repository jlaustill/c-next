import { describe, it, expect } from "vitest";
import ConfigFileNames from "../ConfigFileNames";
import CONFIG_FILE_NAMES from "../../../types/CONFIG_FILE_NAMES";
import TestFileSystem from "../../../types/__testUtils__/TestFileSystem";
import IFileSystem from "../../../types/IFileSystem";

/** A filesystem holding exactly these files and contents. */
function filesystemHolding(files: Record<string, string>): IFileSystem {
  return TestFileSystem.with({
    isFile: (path: string) => path in files,
    readFile: (path: string) => {
      if (!(path in files)) {
        throw new Error(`ENOENT: ${path}`);
      }
      return files[path];
    },
  });
}

describe("ConfigFileNames (#2165)", () => {
  it("names the three config files in search order", () => {
    expect(CONFIG_FILE_NAMES).toEqual([
      "cnx.config.json",
      ".cnx.json",
      ".cnxrc",
    ]);
  });

  describe("readIn", () => {
    it("is the first config file that is not empty", () => {
      const fs = filesystemHolding({
        "/p/cnx.config.json": "  \n",
        "/p/.cnx.json": '{"a":1}',
        "/p/.cnxrc": '{"b":2}',
      });

      expect(ConfigFileNames.readIn("/p", fs)).toEqual({
        config: { path: "/p/.cnx.json", content: '{"a":1}' },
        unreadable: [],
      });
    });

    it("passes a file it cannot read, naming it", () => {
      const fs = TestFileSystem.with({
        isFile: (path: string) =>
          path === "/p/cnx.config.json" || path === "/p/.cnxrc",
        readFile: (path: string) => {
          if (path === "/p/cnx.config.json") {
            throw new Error("EACCES: permission denied");
          }
          return "{}";
        },
      });

      expect(ConfigFileNames.readIn("/p", fs)).toEqual({
        config: { path: "/p/.cnxrc", content: "{}" },
        unreadable: [
          {
            path: "/p/cnx.config.json",
            reason:
              "Failed to read config /p/cnx.config.json: EACCES: permission denied",
          },
        ],
      });
    });

    it("is no config where no config file has content", () => {
      const fs = filesystemHolding({
        "/p/.cnxrc": "",
      });

      expect(ConfigFileNames.readIn("/p", fs)).toEqual({
        config: null,
        unreadable: [],
      });
    });
  });
});
