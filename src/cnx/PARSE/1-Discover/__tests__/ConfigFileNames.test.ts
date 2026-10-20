import { describe, it, expect } from "vitest";
import { join } from "node:path";
import ConfigFileNames from "../ConfigFileNames";
import CONFIG_FILE_NAMES from "../../../types/CONFIG_FILE_NAMES";
import TestFileSystem from "../../../types/__testUtils__/TestFileSystem";
import IFileSystem from "../../../types/IFileSystem";

/** A filesystem holding exactly these files, each holding `{}`. */
function filesystemWith(...paths: string[]): IFileSystem {
  return filesystemHolding(
    Object.fromEntries(paths.map((path) => [path, "{}"])),
  );
}

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
    expect(ConfigFileNames.listed).toBe(
      "cnx.config.json, .cnx.json and .cnxrc",
    );
  });

  describe("renamedIn", () => {
    it.each([
      ["cnext.config.json", "cnx.config.json"],
      [".cnext.json", ".cnx.json"],
      [".cnextrc", ".cnxrc"],
    ])("finds %s and names %s as its successor", (oldName, successor) => {
      const fs = filesystemWith(join("/p", oldName));

      expect(ConfigFileNames.renamedIn("/p", fs)).toEqual([
        { path: join("/p", oldName), successor, besideConfig: null },
      ]);
    });

    it("names the config that sits beside an old name", () => {
      const fs = filesystemWith("/p/cnext.config.json", "/p/.cnxrc");

      expect(ConfigFileNames.renamedIn("/p", fs)).toEqual([
        {
          path: "/p/cnext.config.json",
          successor: "cnx.config.json",
          besideConfig: "/p/.cnxrc",
        },
      ]);
    });

    // #2221 review: this named the first new-name file that exists, where the
    // run reads the first non-empty one, so the help sent a user's
    // settings into a file whose filling then shadowed the config in use.
    it("names the config a run reads, not an empty one ahead of it", () => {
      const fs = filesystemHolding({
        "/p/cnext.config.json": '{"target":"host"}',
        "/p/cnx.config.json": "",
        "/p/.cnxrc": '{"target":"teensy41"}',
      });

      expect(ConfigFileNames.renamedIn("/p", fs)[0].besideConfig).toBe(
        "/p/.cnxrc",
      );
    });

    it("names the first new-name file when every one is empty", () => {
      const fs = filesystemHolding({
        "/p/cnext.config.json": "{}",
        "/p/cnx.config.json": " ",
        "/p/.cnxrc": "",
      });

      expect(ConfigFileNames.renamedIn("/p", fs)[0].besideConfig).toBe(
        "/p/cnx.config.json",
      );
    });

    it("finds every old name in the directory", () => {
      const fs = filesystemWith("/p/cnext.config.json", "/p/.cnextrc");

      expect(
        ConfigFileNames.renamedIn("/p", fs).map((found) => found.path),
      ).toEqual(["/p/cnext.config.json", "/p/.cnextrc"]);
    });

    it("finds nothing where only the new names are", () => {
      const fs = filesystemWith(
        "/p/cnx.config.json",
        "/p/.cnx.json",
        "/p/.cnxrc",
      );

      expect(ConfigFileNames.renamedIn("/p", fs)).toEqual([]);
    });

    it("looks in the directory it is given, not its parent", () => {
      const fs = filesystemWith("/cnext.config.json");

      expect(ConfigFileNames.renamedIn("/p", fs)).toEqual([]);
    });
  });

  describe("readIn", () => {
    it("is the first new-name file that is not empty", () => {
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

    it("is no config where no new-name file has content", () => {
      const fs = filesystemHolding({
        "/p/.cnxrc": "",
        "/p/cnext.config.json": "{}",
      });

      expect(ConfigFileNames.readIn("/p", fs)).toEqual({
        config: null,
        unreadable: [],
      });
    });
  });

  describe("errorFor", () => {
    it("is E0918 at the old file, naming the name to rename it to", () => {
      const error = ConfigFileNames.errorFor({
        path: "/p/.cnextrc",
        successor: ".cnxrc",
        besideConfig: null,
      });

      expect(error).toEqual({
        sourcePath: "/p/.cnextrc",
        line: 1,
        column: 0,
        severity: "error",
        message:
          "error[E0918]: a config file has its old name: .cnextrc is now .cnxrc",
        helpText:
          "cnx reads cnx.config.json, .cnx.json and .cnxrc. Rename this file to .cnxrc; a library's config is renamed in the library.",
      });
    });

    it("names the config read instead when one sits beside the old file", () => {
      const error = ConfigFileNames.errorFor({
        path: "/p/cnext.config.json",
        successor: "cnx.config.json",
        besideConfig: "/p/.cnxrc",
      });

      expect(error.message).toBe(
        "error[E0918]: a config file has its old name: cnext.config.json, beside .cnxrc",
      );
      expect(error.helpText).toBe(
        "cnx reads cnx.config.json, .cnx.json and .cnxrc, never this file. Move any setting .cnxrc lacks into it, then delete this file.",
      );
    });
  });
});
