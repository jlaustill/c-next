import { describe, expect, it } from "vitest";
import createMockSymbols from "../../../__tests__/codeGenSymbolsHelpers";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import NameExistence from "../NameExistence";
import SymbolTable from "../SymbolTable";

/**
 * A SymbolTable stub answering only `getOverloadsByCName`, which is the single
 * method NameExistence uses. Typed through the real class so a signature change
 * fails here rather than being absorbed by a cast.
 */
function tableWith(
  entries: ReadonlyArray<{ name: string; language: ESourceLanguage }>,
): SymbolTable {
  return {
    getOverloadsByCName: (name: string) =>
      entries
        .filter((e) => e.name === name)
        .map((e) => ({ sourceLanguage: e.language })),
  } as unknown as SymbolTable;
}

const NO_CALLBACKS: ReadonlySet<string> = new Set();
const EMPTY_TABLE = tableWith([]);

describe("NameExistence.isKnownType", () => {
  it.each([
    ["knownEnums", "EColor"],
    ["knownStructs", "Point"],
    ["knownBitmaps", "Flags"],
    ["knownRegisters", "GPIO"],
    ["knownScopes", "Motor"],
    ["opaqueTypes", "widget_t"],
  ] as const)("accepts a name present in %s", (field, name) => {
    const symbols = createMockSymbols({ [field]: new Set([name]) });
    expect(
      NameExistence.isKnownType(name, symbols, EMPTY_TABLE, NO_CALLBACKS),
    ).toBe(true);
  });

  it("accepts a function name, because ADR-029 makes it a callback type", () => {
    const symbols = createMockSymbols({
      functionReturnTypes: new Map([["onReceive", "void"]]),
    });
    expect(
      NameExistence.isKnownType(
        "onReceive",
        symbols,
        EMPTY_TABLE,
        NO_CALLBACKS,
      ),
    ).toBe(true);
  });

  it("accepts a name in the callback registry", () => {
    expect(
      NameExistence.isKnownType(
        "tickSource",
        createMockSymbols(),
        EMPTY_TABLE,
        new Set(["tickSource"]),
      ),
    ).toBe(true);
  });

  it("rejects a name that is nowhere", () => {
    expect(
      NameExistence.isKnownType(
        "Mode",
        createMockSymbols(),
        EMPTY_TABLE,
        NO_CALLBACKS,
      ),
    ).toBe(false);
  });

  describe("the C-Next / foreign split (#1312)", () => {
    it("accepts a C symbol from the run-wide table", () => {
      const table = tableWith([{ name: "FILE", language: ESourceLanguage.C }]);
      expect(
        NameExistence.isKnownType(
          "FILE",
          createMockSymbols(),
          table,
          NO_CALLBACKS,
        ),
      ).toBe(true);
    });

    it("accepts a C++ symbol from the run-wide table", () => {
      const table = tableWith([
        { name: "Adafruit_MAX31856", language: ESourceLanguage.Cpp },
      ]);
      expect(
        NameExistence.isKnownType(
          "Adafruit_MAX31856",
          createMockSymbols(),
          table,
          NO_CALLBACKS,
        ),
      ).toBe(true);
    });

    it("does NOT accept a C-Next symbol from the run-wide table", () => {
      // The whole point of #1312: a sibling that was never included is still in
      // the run-wide table. Consulting it for a C-Next name would answer "yes"
      // in the file that cannot see it, and the diagnostic would never fire.
      const table = tableWith([
        { name: "Mode", language: ESourceLanguage.CNext },
      ]);
      expect(
        NameExistence.isKnownType(
          "Mode",
          createMockSymbols(),
          table,
          NO_CALLBACKS,
        ),
      ).toBe(false);
    });
  });
});

describe("NameExistence.isKnownEnumMember", () => {
  it("finds a member of any known enum (ADR-017 bare member)", () => {
    const symbols = createMockSymbols({
      enumMembers: new Map([
        ["EStatus", new Map([["STATUS_IDLE", 0]])],
        ["EColor", new Map([["RED", 1]])],
      ]),
    });
    expect(NameExistence.isKnownEnumMember("RED", symbols)).toBe(true);
    expect(NameExistence.isKnownEnumMember("STATUS_IDLE", symbols)).toBe(true);
  });

  it("rejects a name that is no enum's member", () => {
    const symbols = createMockSymbols({
      enumMembers: new Map([["EColor", new Map([["RED", 1]])]]),
    });
    expect(NameExistence.isKnownEnumMember("BLUE", symbols)).toBe(false);
  });

  it("rejects when there are no enums at all", () => {
    expect(NameExistence.isKnownEnumMember("RED", createMockSymbols())).toBe(
      false,
    );
  });
});
