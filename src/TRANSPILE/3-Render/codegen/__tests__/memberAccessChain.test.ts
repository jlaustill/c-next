/**
 * Tests for memberAccessChain helper module.
 *
 * #1445: `determineSeparator` and `buildMemberAccessChain` were deleted as
 * dead code -- 0 production callers between them, 31 test callers here. These
 * tests went with them; that is not a coverage regression because they covered
 * nothing reachable, but the count is stated on the PR rather than left to be
 * discovered in the Sonar diff.
 */

import memberAccessChain from "../memberAccessChain";

const { getStructParamSeparator, wrapStructParamValue } = memberAccessChain;

/**
 * Both helpers read ONE decision -- is this struct parameter a pointer here, or
 * a C++ reference -- so each is one table over the same two inputs. The C++
 * callback-promoted row is the one Issue #895 decided for the separator while
 * the wrap still asked the mode alone: `f->pokes` beside `Full copy = f;`.
 */
describe("getStructParamSeparator", () => {
  it.each<[string, boolean, boolean, string]>([
    ["C", false, false, "->"],
    ["C++", true, false, "."],
    ["C, callback-promoted", false, true, "->"],
    ["C++, callback-promoted", true, true, "->"],
  ])(
    "separates a struct parameter in %s",
    (_label, cppMode, forcePointerSemantics, expected) => {
      expect(getStructParamSeparator({ cppMode, forcePointerSemantics })).toBe(
        expected,
      );
    },
  );
});

describe("wrapStructParamValue", () => {
  it.each<[string, boolean, boolean, string]>([
    ["C", false, false, "(*config)"],
    ["C++", true, false, "config"],
    ["C, callback-promoted", false, true, "(*config)"],
    ["C++, callback-promoted", true, true, "(*config)"],
  ])(
    "wraps a whole-value struct parameter in %s",
    (_label, cppMode, forcePointerSemantics, expected) => {
      expect(
        wrapStructParamValue("config", { cppMode, forcePointerSemantics }),
      ).toBe(expected);
    },
  );

  it("should handle parameter names with underscores", () => {
    expect(
      wrapStructParamValue("my_config", {
        cppMode: false,
        forcePointerSemantics: false,
      }),
    ).toBe("(*my_config)");
    expect(
      wrapStructParamValue("my_config", {
        cppMode: true,
        forcePointerSemantics: false,
      }),
    ).toBe("my_config");
  });
});
