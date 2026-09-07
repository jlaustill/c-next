import { describe, expect, it } from "vitest";

import invariant from "../invariant";

describe("invariant", () => {
  it("passes a truthy condition through silently", () => {
    expect(() => invariant(1, "one is truthy")).not.toThrow();
  });

  it("throws, naming the invariant rather than describing the symptom", () => {
    expect(() => invariant(false, "a struct field always has a type")).toThrow(
      "Internal: a struct field always has a type",
    );
  });

  it("marks the failure as internal, so it is not read as a user diagnostic", () => {
    // The corpus distinguishes the two by prefix, and it was inconsistent:
    // four sites in `CodeGenerator` said `Internal:` while two of their
    // siblings said `Error:`, which reads as something the user did wrong.
    // A user-facing diagnostic carries a code and a position; an invariant
    // carries neither, and must not be mistaken for one.
    try {
      invariant(false, "x");
      throw new Error("unreachable");
    } catch (error) {
      expect((error as Error).message.startsWith("Internal: ")).toBe(true);
    }
  });

  it("narrows the type for the code after it", () => {
    // This is the property that makes it the right conversion for a guard
    // whose condition cannot be true but whose narrowing is load-bearing.
    // Four `StringHandlers` sites were classified `dead -- delete` in #1321's
    // audit; deleting them produces `TS18048: possibly 'undefined'`, because
    // the guard is doing type work as well as runtime work. They are
    // invariants, not dead code, and this is what lets them say so.
    const value: string | undefined = "present" as string | undefined;
    invariant(value, "value is present");
    // Compiles only because `invariant` narrowed `value` to `string`.
    expect(value).toHaveLength(7);
  });

  it("rejects an empty statement, which would name no invariant at all", () => {
    // "Internal: " with nothing after it is the assertion equivalent of a
    // guard that cannot fail: it fires, and tells the reader nothing.
    expect(() => invariant(false, "")).toThrow(
      "invariant requires a statement",
    );
  });
});
