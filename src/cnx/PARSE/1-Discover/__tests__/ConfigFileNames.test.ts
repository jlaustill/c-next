import { describe, it, expect } from "vitest";
import { join } from "node:path";
import ConfigFileNames from "../ConfigFileNames";
import CONFIG_FILE_NAMES from "../../../types/CONFIG_FILE_NAMES";
import TestFileSystem from "../../../types/__testUtils__/TestFileSystem";
import IFileSystem from "../../../types/IFileSystem";

/** A filesystem holding exactly these files. */
function filesystemWith(...paths: string[]): IFileSystem {
  const files = new Set(paths);
  return TestFileSystem.with({ isFile: (path: string) => files.has(path) });
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
