/**
 * The one branch `parseCHeader` gained when it stopped rebuilding the C parse
 * pipeline and started calling `HeaderParser.parseC` (#1306 review).
 *
 * Its own file because the mock is of `HeaderParser`, and `vi.mock` is hoisted to
 * cover every test in a file -- the sibling `parseCHeader.mocked.test.ts` needs a
 * real parse to reach `CResolver`.
 *
 * `HeaderParser.parseC` answers a failed parse with `{ tree: null }` by contract,
 * so the exception text is no longer available here and the message is a fixed
 * sentence. That is a deliberate trade: before, this function caught the throw
 * itself and reported the exception's own text. Sharing one parse means sharing
 * its contract, and the alternative was two pipelines that had already drifted.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../../transpiler/logic/parser/HeaderParser", () => ({
  default: {
    parseC: (): { tree: null } => ({ tree: null }),
  },
}));

import parseCHeader from "../parseCHeader";

describe("parseCHeader when the parse cannot proceed", () => {
  it("reports a failure rather than resolving symbols from a null tree", () => {
    const result = parseCHeader("int x;", "broken.h");

    expect(result.success).toBe(false);
    expect(result.symbols).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      line: 1,
      column: 0,
      message: "C header could not be parsed",
      severity: "error",
    });
  });
});
