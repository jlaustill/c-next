import { describe, it, expect } from "vitest";
import CNextSourcePath from "../CNextSourcePath";

describe("CNextSourcePath (#1833)", () => {
  it.each(["led.cnx", "src/led.cnext", "a.b.cnx"])("%s is source", (path) => {
    expect(CNextSourcePath.isSource(path)).toBe(true);
    expect(CNextSourcePath.isMiscased(path)).toBe(false);
  });

  it.each(["Colors.CNX", "Colors.Cnx", "src/led.CNEXT", "led.cNext"])(
    "%s is miscased, not source",
    (path) => {
      expect(CNextSourcePath.isSource(path)).toBe(false);
      expect(CNextSourcePath.isMiscased(path)).toBe(true);
    },
  );

  it.each(["led.h", "led.c", "led.cnx.h", "cnx", "led"])(
    "%s is neither",
    (path) => {
      expect(CNextSourcePath.isSource(path)).toBe(false);
      expect(CNextSourcePath.isMiscased(path)).toBe(false);
    },
  );

  it("names the stem and swaps the extension", () => {
    expect(CNextSourcePath.stem("src/led.cnx")).toBe("src/led");
    expect(CNextSourcePath.withExtension("src/led.cnext", ".hpp")).toBe(
      "src/led.hpp",
    );
  });

  it("leaves a path with no C-Next extension whole", () => {
    expect(CNextSourcePath.stem("<string>")).toBe("<string>");
    expect(CNextSourcePath.withExtension("notes.txt", ".h")).toBe(
      "notes.txt.h",
    );
  });

  it("gives no stem to a miscased path, which is E0518 first", () => {
    expect(() => CNextSourcePath.stem("Colors.CNX")).toThrow(/E0518/);
  });
});
