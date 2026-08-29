/**
 * Unit tests for DeclarationSite
 * Issue #1334: single source of truth for rendering and ordering `file:line`
 */
import { describe, it, expect } from "vitest";
import { join } from "node:path";
import DeclarationSite from "../DeclarationSite";

describe("DeclarationSite", () => {
  describe("format", () => {
    it("joins the full path and the line", () => {
      expect(DeclarationSite.format("/abs/path/span.cnx", 12)).toBe(
        "/abs/path/span.cnx:12",
      );
    });

    it("keeps the directory, so same-named files stay distinct keys", () => {
      expect(DeclarationSite.format("a/lib.cnx", 3)).not.toBe(
        DeclarationSite.format("b/lib.cnx", 3),
      );
    });
  });

  describe("displayPath", () => {
    it("renders a project path relative to the invocation directory", () => {
      expect(
        DeclarationSite.displayPath(join(process.cwd(), "tests/span.cnx")),
      ).toBe("tests/span.cnx");
    });

    // #1334: a basename rendered `can/config.cnx` and `uart/config.cnx`
    // identically, reproducing the `one.cnx:5 / one.cnx:5` output the issue was
    // filed about. #1133 makes that directory layout explicitly supported.
    it("keeps same-named files in different directories distinguishable", () => {
      const can = DeclarationSite.display(
        join(process.cwd(), "can/config.cnx"),
        3,
      );
      const uart = DeclarationSite.display(
        join(process.cwd(), "uart/config.cnx"),
        3,
      );

      expect(can).toBe("can/config.cnx:3");
      expect(can).not.toBe(uart);
    });

    it("falls back to the input when the path IS the invocation directory", () => {
      expect(DeclarationSite.displayPath(process.cwd())).toBe(process.cwd());
    });
  });

  describe("displaySite", () => {
    it("renders a stored site relative to the invocation directory", () => {
      expect(
        DeclarationSite.displaySite(
          DeclarationSite.format(join(process.cwd(), "tests/span.cnx"), 12),
        ),
      ).toBe("tests/span.cnx:12");
    });

    it("leaves a site that is already relative unchanged", () => {
      expect(DeclarationSite.displaySite("span.cnx:12")).toBe("span.cnx:12");
    });
  });

  describe("compare", () => {
    // The reason this comparator exists. A default `.sort()` compares these keys
    // as text, which puts `:10` ahead of `:3` -- and every fixture agreed with
    // numeric order only because each scope happened to sit on a two-digit line.
    it("orders lines numerically, not lexicographically", () => {
      const sorted = ["span.cnx:10", "span.cnx:3", "span.cnx:9"]
        .slice()
        .sort(DeclarationSite.compare);

      expect(sorted).toEqual(["span.cnx:3", "span.cnx:9", "span.cnx:10"]);
    });

    it("is the ordering a default sort gets wrong", () => {
      const input = ["span.cnx:10", "span.cnx:3"];

      expect(input.slice().sort()).toEqual(["span.cnx:10", "span.cnx:3"]);
      expect(input.slice().sort(DeclarationSite.compare)).toEqual([
        "span.cnx:3",
        "span.cnx:10",
      ]);
    });

    it("orders by file before line", () => {
      const sorted = ["b.cnx:1", "a.cnx:99"].sort(DeclarationSite.compare);

      expect(sorted).toEqual(["a.cnx:99", "b.cnx:1"]);
    });

    it("reports equal sites as equal", () => {
      expect(DeclarationSite.compare("a.cnx:4", "a.cnx:4")).toBe(0);
    });

    it("splits at the last colon, so a drive letter stays with the path", () => {
      const sorted = ["C:/proj/span.cnx:10", "C:/proj/span.cnx:3"].sort(
        DeclarationSite.compare,
      );

      expect(sorted).toEqual(["C:/proj/span.cnx:3", "C:/proj/span.cnx:10"]);
    });
  });

  describe("malformed sites are total", () => {
    // A diagnostic is the one place an exception would replace the real error.
    it.each([
      ["no separator", "span.cnx", "span.cnx:0"],
      ["non-numeric line", "span.cnx:abc", "span.cnx:abc:0"],
      ["empty line", "span.cnx:", "span.cnx::0"],
      ["negative line", "span.cnx:-4", "span.cnx:-4:0"],
    ])("renders a site with %s without throwing", (_label, site, expected) => {
      expect(DeclarationSite.displaySite(site)).toBe(expected);
    });

    it("sorts a malformed site rather than throwing", () => {
      expect(() =>
        ["span.cnx", "span.cnx:3"].sort(DeclarationSite.compare),
      ).not.toThrow();
    });
  });
});
