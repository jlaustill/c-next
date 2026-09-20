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

describe("getStructParamSeparator", () => {
  it("should return -> in C mode", () => {
    expect(getStructParamSeparator({ cppMode: false })).toBe("->");
  });

  it("should return . in C++ mode", () => {
    expect(getStructParamSeparator({ cppMode: true })).toBe(".");
  });
});

describe("wrapStructParamValue", () => {
  it("should dereference in C mode", () => {
    expect(wrapStructParamValue("config", { cppMode: false })).toBe(
      "(*config)",
    );
  });

  it("should return unchanged in C++ mode", () => {
    expect(wrapStructParamValue("config", { cppMode: true })).toBe("config");
  });

  it("should handle parameter names with underscores", () => {
    expect(wrapStructParamValue("my_config", { cppMode: false })).toBe(
      "(*my_config)",
    );
    expect(wrapStructParamValue("my_config", { cppMode: true })).toBe(
      "my_config",
    );
  });
});
