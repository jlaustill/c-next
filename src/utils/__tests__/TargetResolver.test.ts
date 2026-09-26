/**
 * ADR-049: a target name to its catalog description. Deciding a run's target
 * is RunTarget's (1.4); this is only the lookup.
 */
import { describe, it, expect } from "vitest";
import TargetResolver from "../TargetResolver";

describe("TargetResolver", () => {
  describe("byName", () => {
    it.each([
      { name: "teensy41", word_size: 32, ldrex_strex: true },
      { name: "avr", word_size: 8, ldrex_strex: false },
      { name: "cortex-m0", word_size: 32, ldrex_strex: false },
      { name: "cortex-m0+", word_size: 32, ldrex_strex: false },
    ])("resolves $name", ({ name, word_size, ldrex_strex }) => {
      const target = TargetResolver.byName(name);
      expect(target?.word_size).toBe(word_size);
      expect(target?.ldrex_strex).toBe(ldrex_strex);
    });

    it.each([
      { name: undefined, why: "no name given" },
      { name: "", why: "an empty name" },
      { name: "definitely-not-a-target", why: "an unknown name" },
      {
        name: "TEENSY41",
        why: "a name in the wrong case: names match exactly",
      },
    ])("returns undefined for $why", ({ name }) => {
      expect(TargetResolver.byName(name)).toBeUndefined();
    });

    it.each([
      ["teensy41", "cortex-m7"],
      ["teensy40", "cortex-m7"],
      ["stm32f4", "cortex-m4"],
      ["avr", "atmega328p"],
      ["arduino-uno", "atmega328p"],
    ])("resolves the alias %s to %s's description", (alias, target) => {
      expect(TargetResolver.byName(alias)).toBe(TargetResolver.byName(target));
    });
  });

  describe("names", () => {
    it("lists every catalog name, aliases included", () => {
      expect(TargetResolver.names()).toEqual(
        expect.arrayContaining([
          "cortex-m7",
          "teensy41",
          "teensy40",
          "stm32f4",
          "atmega328p",
          "avr",
          "arduino-uno",
          "esp32",
          "host",
        ]),
      );
    });
  });
});
