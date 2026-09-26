/**
 * ADR-049: the one reader of a file's pragma lines.
 */
import { describe, it, expect } from "vitest";
import CNextSourceParser from "../CNextSourceParser";

function directivesOf(source: string) {
  return CNextSourceParser.parse(source).targetDirectives;
}

describe("TargetDirectives", () => {
  it("reads a target pragma's key, value and position", () => {
    expect(
      directivesOf("\n#pragma target teensy41\ni32 main() { return 0; }"),
    ).toEqual([{ key: "target", values: ["teensy41"], line: 2, column: 0 }]);
  });

  it("keeps the name exactly as written", () => {
    expect(directivesOf("#pragma target TEENSY41\n")[0].values).toEqual([
      "TEENSY41",
    ]);
  });

  it("tolerates blanks after '#' and between words", () => {
    expect(
      directivesOf(["#  pragma   target", "avr\n"].join("\t"))[0],
    ).toMatchObject({
      key: "target",
      values: ["avr"],
    });
  });

  it("reads every pragma, in order", () => {
    expect(
      directivesOf("#pragma target avr\n#pragma target teensy41\n").map(
        (d) => d.values[0],
      ),
    ).toEqual(["avr", "teensy41"]);
  });

  it("finds nothing in a file with no pragma", () => {
    expect(
      directivesOf('#include "other.cnx"\ni32 main() { return 0; }'),
    ).toEqual([]);
  });
});
