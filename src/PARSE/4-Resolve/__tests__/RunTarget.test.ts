/**
 * ADR-049: a run's one target -- pragmas first, then the option, then the
 * fallback -- and the two ways a program can fail to have one.
 */
import { describe, it, expect } from "vitest";
import RunTarget from "../RunTarget";
import TargetCatalogFile from "../../../transpiler/data/TargetCatalogFile";
import type ITargetDirective from "../../../transpiler/types/ITargetDirective";

const catalog = TargetCatalogFile.targets();

/** A file that declares `#pragma target <name>` at `line`, or nothing */
function file(sourcePath: string, name?: string, line = 1) {
  const directives: ITargetDirective[] = name
    ? [{ key: "target", values: [name], line, column: 0 }]
    : [];
  return { sourcePath, directives };
}

function resolve(files: ReturnType<typeof file>[], option?: string) {
  return RunTarget.resolve({ option, catalog, files });
}

describe("RunTarget.resolve", () => {
  it("falls back to host when nothing names a target", () => {
    expect(resolve([file("main.cnx")])).toMatchObject({
      kind: "resolved",
      name: "host",
      source: "fallback",
    });
  });

  it("takes the option when no file declares a target", () => {
    expect(resolve([file("main.cnx")], "avr")).toMatchObject({
      kind: "resolved",
      name: "avr",
      source: "option",
      description: catalog.get("atmega328p"),
    });
  });

  it("takes a pragma over the option", () => {
    const target = resolve([file("main.cnx", "teensy41")], "cortex-m0");
    expect(target).toMatchObject({ name: "teensy41", source: "pragma" });
  });

  it("gives a helper's pragma to the whole program", () => {
    const target = resolve([file("helper.cnx", "teensy41"), file("main.cnx")]);
    expect(target).toMatchObject({
      kind: "resolved",
      name: "teensy41",
      description: catalog.get("cortex-m7"),
    });
  });

  it("treats an empty option as absent", () => {
    expect(resolve([file("main.cnx")], "")).toMatchObject({
      name: "host",
      source: "fallback",
    });
  });

  it("accepts files that name the same platform by different names", () => {
    const target = resolve([
      file("helper.cnx", "teensy41"),
      file("main.cnx", "cortex-m7"),
    ]);
    expect(target).toMatchObject({ kind: "resolved", name: "teensy41" });
  });

  it("rejects files that name different platforms, at the second (E0511)", () => {
    const target = resolve([
      file("helper.cnx", "teensy41", 3),
      file("main.cnx", "cortex-m0", 5),
    ]);
    expect(target).toEqual({
      kind: "rejected",
      errors: [
        expect.objectContaining({
          sourcePath: "main.cnx",
          line: 5,
          message: expect.stringMatching(
            /^error\[E0511\]: this file declares target 'cortex-m0', but helper\.cnx:3 declares 'teensy41'$/,
          ),
        }),
      ],
    });
  });

  it("rejects an unknown pragma name, at the pragma (E0510)", () => {
    const target = resolve([file("main.cnx", "bogus", 2)]);
    expect(target).toEqual({
      kind: "rejected",
      errors: [
        expect.objectContaining({
          sourcePath: "main.cnx",
          line: 2,
          message: "error[E0510]: 'bogus' is not a known target",
          helpText: expect.stringContaining("teensy41"),
        }),
      ],
    });
  });

  it("matches names exactly", () => {
    expect(resolve([file("main.cnx", "TEENSY41")]).kind).toBe("rejected");
  });

  it("rejects an unknown option even when a pragma decides", () => {
    const target = resolve([file("main.cnx", "teensy41")], "bogus");
    expect(target).toEqual({
      kind: "rejected",
      errors: [
        expect.objectContaining({
          message:
            "error[E0510]: the target option names 'bogus', which is not a known target",
        }),
      ],
    });
    if (target.kind === "rejected") {
      expect(target.errors[0].sourcePath).toBeUndefined();
    }
  });
});
