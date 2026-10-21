import { describe, it, expect } from "vitest";
import CnxSourcePath from "../CnxSourcePath";

describe("CnxSourcePath (#1833, #2167)", () => {
  it.each(["led.cnx", "src/led.cnx", "a.b.cnx"])("%s is source", (path) => {
    expect(CnxSourcePath.isSource(path)).toBe(true);
    expect(CnxSourcePath.isRejected(path)).toBe(false);
    expect(CnxSourcePath.rejection(path, "rename it.")).toBeNull();
  });

  it.each(["Colors.CNX", "Colors.Cnx", "src/led.cNX"])(
    "%s is miscased: E0518, not source",
    (path) => {
      expect(CnxSourcePath.isSource(path)).toBe(false);
      expect(CnxSourcePath.isRejected(path)).toBe(true);
      expect(CnxSourcePath.rejection(path, "rename it.")).toEqual({
        code: "E0518",
        message: `cnx source extension must be lowercase: ${path}`,
        helpText:
          "Only `.cnx`, spelled in lowercase, names cnx source (ADR-010); rename it.",
      });
    },
  );

  it.each(["led.cnext", "src/led.CNEXT", "led.cNext"])(
    "%s is the retired extension: E0519, not source",
    (path) => {
      expect(CnxSourcePath.isSource(path)).toBe(false);
      expect(CnxSourcePath.isRejected(path)).toBe(true);
      expect(CnxSourcePath.rejection(path, "rename it.")).toEqual({
        code: "E0519",
        message: `\`.cnext\` no longer names cnx source; rename it to \`.cnx\`: ${path}`,
        helpText:
          "Only `.cnx`, spelled in lowercase, names cnx source (ADR-010); rename it.",
      });
    },
  );

  it.each(["led.h", "led.c", "led.cnx.h", "led.cnext.h", "cnx", "led"])(
    "%s is neither",
    (path) => {
      expect(CnxSourcePath.isSource(path)).toBe(false);
      expect(CnxSourcePath.isRejected(path)).toBe(false);
      expect(CnxSourcePath.rejection(path, "rename it.")).toBeNull();
    },
  );

  it("names the stem and swaps the extension", () => {
    expect(CnxSourcePath.stem("src/led.cnx")).toBe("src/led");
    expect(CnxSourcePath.withExtension("src/led.cnx", ".hpp")).toBe(
      "src/led.hpp",
    );
  });

  it("leaves a path with no cnx extension whole", () => {
    expect(CnxSourcePath.stem("<string>")).toBe("<string>");
    expect(CnxSourcePath.withExtension("<string>", ".h")).toBe("<string>");
    expect(CnxSourcePath.withExtension("notes.txt", ".h")).toBe("notes.txt");
  });

  it.each(["Colors.CNX", "Colors.cnext"])(
    "gives no stem to %s, which is rejected first",
    (path) => {
      expect(() => CnxSourcePath.stem(path)).toThrow(/E0518 or E0519/);
    },
  );
});
