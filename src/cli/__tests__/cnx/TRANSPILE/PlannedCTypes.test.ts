/**
 * #1991: 2.2 plans the C types a file's text uses, from which it decides
 * `<stdint.h>` and `<stdbool.h>`, before 2.3 writes any of them.
 */
import { describe, it, expect } from "vitest";
import ProgramGeneration from "./ProgramGeneration";

function plannedCTypes(lines: readonly string[]): string[] {
  return [...ProgramGeneration.planSource(lines.join("\n")).cTypes].sort();
}

describe("2.2 plans the C types a file uses", () => {
  it("counts a `true` written where no `bool` is declared", () => {
    expect(
      plannedCTypes(["u8 x;", "void f() {", "  x[0] <- true;", "}"]),
    ).toEqual(["bool", "uint8_t", "void"]);
  });

  it("counts a bitmap's backing type", () => {
    expect(
      plannedCTypes([
        "bitmap8 Flags {",
        "  A,",
        "  B,",
        "  C[6]",
        "}",
        "void f() {}",
      ]),
    ).toEqual(["uint8_t", "void"]);
  });

  it("does not count `bool` for a file that writes none", () => {
    expect(plannedCTypes(["u8 x;", "void f() {", "  x <- 1;", "}"])).toEqual([
      "uint8_t",
      "void",
    ]);
  });

  it("casts a `~` of an unsigned operand back to its C type, not a signed one", () => {
    const plan = ProgramGeneration.planSource(
      ["u16 v;", "i16 w;", "void f() {", "  v <- ~v;", "  w <- ~w;", "}"].join(
        "\n",
      ),
    );
    expect([...plan.complementCasts.values()]).toEqual(["uint16_t"]);
  });
});
