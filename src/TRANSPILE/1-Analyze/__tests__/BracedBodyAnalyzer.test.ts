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

  // #1090 review: each arm of the nested walk, on its own, so removing any
  // one of them fails exactly its case.
  it.each([
    [
      "an else-if arm",
      "if",
      "    if (c = true) {\n        x <- 1;\n    } else if (x = 0) x <- 2;",
    ],
    [
      "a switch case",
      "if",
      "    switch (x) {\n        case 1 {\n            if (c = true) x <- 1;\n        }\n        default {\n            x <- 0;\n        }\n    }",
    ],
    [
      "a switch default",
      "while",
      "    switch (x) {\n        case 1 {\n            x <- 0;\n        }\n        default {\n            while (x < 3) x +<- 1;\n        }\n    }",
    ],
    [
      "a critical block",
      "if",
      "    critical {\n        if (c = true) x <- 1;\n    }",
    ],
    [
      "a forever body",
      "if",
      "    forever {\n        if (c = true) x <- 1;\n    }",
    ],
    [
      "a do-while body",
      "if",
      "    do {\n        if (c = true) x <- 1;\n    } while (x < 3);",
    ],
    [
      "a braced if body",
      "while",
      "    if (c = true) {\n        while (x < 3) x +<- 1;\n    }",
    ],
    [
      "a braced else body",
      "for",
      "    if (c = true) {\n        x <- 1;\n    } else {\n        for (u32 i <- 0; i < 3; i +<- 1) x +<- 1;\n    }",
    ],
    [
      "a braced while body",
      "if",
      "    while (x < 3) {\n        if (c = true) x <- 1;\n        x +<- 1;\n    }",
    ],
    [
      "a braced for body",
      "if",
      "    for (u32 i <- 0; i < 3; i +<- 1) {\n        if (c = true) x <- 1;\n    }",
    ],
  ])("finds an unbraced body inside %s", (_arm, keyword, body) => {
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
