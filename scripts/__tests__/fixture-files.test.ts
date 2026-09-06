/**
 * #1449: the rule deciding which files `headers:standalone:check` compiles.
 *
 * Tested apart from the check because a wrong answer here is SILENT -- the gate
 * stays green while compiling the wrong set. The first version accepted
 * `X.hpp` on the strength of `X.test.cnx` and so compiled nine hand-written
 * interop fixtures as though the transpiler had emitted them.
 */

import FixtureFiles from "../headers/FixtureFiles";

/** A filesystem that contains exactly these paths. */
const only =
  (...paths: string[]) =>
  (path: string): boolean =>
    paths.includes(path);

describe("FixtureFiles.sourceOf", () => {
  it.each([
    ["a fixture's own C header", "foo.test.h", "foo.test.cnx"],
    ["a fixture's own C++ header", "foo.test.hpp", "foo.test.cnx"],
    ["a helper's C header", "bar.h", "bar.cnx"],
    ["a helper's C++ header", "bar.hpp", "bar.cnx"],
  ])("accepts %s", (_label, header, source) => {
    expect(FixtureFiles.sourceOf(header, only(source))).toBe(source);
  });

  // The regression. `X.hpp` beside `X.test.cnx` is INPUT the transpiler reads,
  // not output it wrote -- that fixture's output is `X.test.hpp`.
  it("refuses a hand-written header sitting beside a fixture", () => {
    expect(
      FixtureFiles.sourceOf(
        "comprehensive-cpp.hpp",
        only("comprehensive-cpp.test.cnx"),
      ),
    ).toBeNull();
  });

  it("refuses a fixture-shaped header whose fixture source is absent", () => {
    expect(FixtureFiles.sourceOf("foo.test.h", only("foo.cnx"))).toBeNull();
  });

  it.each([
    ["a fixture's snapshot", "foo.expected.c", "foo.test.cnx"],
    ["a helper's snapshot", "bar.expected.h", "bar.cnx"],
    ["a fixture's C++ snapshot", "foo.expected.hpp", "foo.test.cnx"],
  ])("accepts %s", (_label, snapshot, source) => {
    expect(FixtureFiles.sourceOf(snapshot, only(source))).toBe(source);
  });

  it.each([
    ["a vendored header with no C-Next source", "FreeRTOS.h"],
    ["something that is not a header at all", "notes.md"],
  ])("refuses %s", (_label, header) => {
    expect(FixtureFiles.sourceOf(header, () => false)).toBeNull();
  });
});

describe("FixtureFiles.isModeOrphan (#1149)", () => {
  it.each([
    [".h beside a cpp-only fixture", "x.test.h", "// test-cpp-only\n", true],
    [".hpp beside a c-only fixture", "x.test.hpp", "// test-c-only\n", true],
    [".h beside a c-only fixture", "x.test.h", "// test-c-only\n", false],
    [
      ".hpp beside a cpp-only fixture",
      "x.test.hpp",
      "// test-cpp-only\n",
      false,
    ],
    [".h beside an unmarked fixture", "x.test.h", "u32 a;\n", false],
    [".hpp beside an unmarked fixture", "x.test.hpp", "u32 a;\n", false],
  ])("%s -> %s", (_label, header, source, expected) => {
    expect(FixtureFiles.isModeOrphan(header, source)).toBe(expected);
  });
});
