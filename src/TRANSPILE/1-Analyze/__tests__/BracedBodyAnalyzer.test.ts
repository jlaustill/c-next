import { describe, expect, it } from "vitest";

import BracedBodyAnalyzer from "../BracedBodyAnalyzer";
import CNextSourceParser from "../../../PARSE/2-Parse/CNextSourceParser";

const errorsOf = (body: string) => {
  const { program } = CNextSourceParser.parse(
    `scope S {\n    u32 run(bool c) {\n    u32 x <- 0;\n${body}\n    return x;\n    }\n}`,
  );
  return new BracedBodyAnalyzer().analyze(program);
};

describe("BracedBodyAnalyzer (#1090: E0716)", () => {
  it.each([
    ["if", "    if (c = true) x <- 1;"],
    ["else", "    if (c = true) {\n        x <- 1;\n    } else x <- 2;"],
    ["while", "    while (x < 3) x +<- 1;"],
    ["for", "    for (u32 i <- 0; i < 3; i +<- 1) x +<- 1;"],
    ["if", "    if (c = true) const u32 N <- 2;"],
  ])("rejects an unbraced '%s' body", (keyword, body) => {
    const found = errorsOf(body);
    expect(found.map((error) => [error.code, error.message])).toEqual([
      ["E0716", `'${keyword}' body must be a braced block`],
    ]);
  });

  it("accepts braced bodies and an else-if chain", () => {
    const body = [
      "    if (c = true) {",
      "        x <- 1;",
      "    } else if (x = 0) {",
      "        x <- 2;",
      "    } else {",
      "        x <- 3;",
      "    }",
      "    while (x < 3) {",
      "        x +<- 1;",
      "    }",
      "    for (u32 i <- 0; i < 3; i +<- 1) {",
      "        x +<- 1;",
      "    }",
    ].join("\n");
    expect(errorsOf(body)).toEqual([]);
  });
});
