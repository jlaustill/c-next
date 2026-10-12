import { describe, expect, it } from "vitest";
import PrivateConstValue from "../PrivateConstValue";
import type IProgram from "../../../../types/IProgram";
import type TConstExpr from "../../../../types/TConstExpr";
import type TSettledConst from "../../../../types/TSettledConst";

const AT = { line: 1, column: 0 };

function programWith(
  symbol: Record<string, unknown>,
  settled: TSettledConst | null,
): IProgram {
  const full = {
    kind: "variable",
    scopePath: "S",
    visibility: "private",
    isConst: true,
    isArray: false,
    ...symbol,
  };
  return {
    symbolByCName: (cName: string) => (cName === "S__K" ? full : undefined),
    settledConstOf: (cName: string) => (cName === "S__K" ? settled : null),
  } as unknown as IProgram;
}

const literal = (
  digits: string,
  typeName: string | null = null,
): TConstExpr => ({
  kind: "literal",
  digits,
  typeName,
});

const binary: TConstExpr = {
  kind: "binary",
  op: "*",
  left: { kind: "name", root: null, path: ["N"], at: AT },
  right: literal("2"),
};

const value = (digits: string): TSettledConst => ({
  kind: "value",
  digits,
  typeName: "u32",
});

describe("PrivateConstValue.inlined", () => {
  it("writes an expression initializer as its settled digits, never its text", () => {
    const program = programWith(
      { initialValue: "N*2", initialValueExpr: binary },
      value("20"),
    );
    expect(PrivateConstValue.inlined(program, "S__K")).toBe("20");
  });

  it("keeps an unsuffixed literal's spelling, which is the same value", () => {
    const program = programWith(
      { initialValue: "0xAB", initialValueExpr: literal("171") },
      value("171"),
    );
    expect(PrivateConstValue.inlined(program, "S__K")).toBe("0xAB");
  });

  it("writes a suffixed literal as its digits, since C has no u8 suffix", () => {
    const program = programWith(
      { initialValue: "9u8", initialValueExpr: literal("9", "u8") },
      value("9"),
    );
    expect(PrivateConstValue.inlined(program, "S__K")).toBe("9");
  });

  it("inlines a float only as a plain literal", () => {
    const floatLiteral: TConstExpr = {
      kind: "other",
      what: "float",
      spelling: "2.5",
      at: AT,
    };
    const settled: TSettledConst = {
      kind: "float",
      digits: "2.5",
      typeName: "f32",
    };
    expect(
      PrivateConstValue.inlined(
        programWith(
          { initialValue: "2.5", initialValueExpr: floatLiteral },
          settled,
        ),
        "S__K",
      ),
    ).toBe("2.5");
    expect(
      PrivateConstValue.inlined(
        programWith(
          { initialValue: "1.25*2.0", initialValueExpr: binary },
          settled,
        ),
        "S__K",
      ),
    ).toBeNull();
  });

  it("emits a const with no settled value (a bool, a string, an enum)", () => {
    const program = programWith(
      { initialValue: "true", initialValueExpr: literal("1", "bool") },
      null,
    );
    expect(PrivateConstValue.inlined(program, "S__K")).toBeNull();
  });

  it("inlines only a private, scalar scope const", () => {
    const base = { initialValue: "4", initialValueExpr: literal("4") };
    for (const differs of [
      { visibility: "public" },
      { isArray: true },
      { isConst: false },
      { scopePath: "" },
    ]) {
      const program = programWith({ ...base, ...differs }, value("4"));
      expect(PrivateConstValue.inlined(program, "S__K")).toBeNull();
    }
    expect(
      PrivateConstValue.inlined(programWith(base, value("4")), "S__K"),
    ).toBe("4");
  });

  it("inlines nothing without a program", () => {
    expect(PrivateConstValue.inlined(null, "S__K")).toBeNull();
  });
});
