/**
 * What 1.3 records as a possible callback use (#1825). Which uses are callbacks
 * is 1.4's, tested in `CallbackCompatibility.test`; this pins what the
 * artifact holds, which `TCallbackUse` documents as a place a file names what
 * may be a function.
 */
import { describe, expect, it } from "vitest";
import parse from "./testHelpers";
import CallbackUseCollector from "../collectors/CallbackUseCollector";
import ProgramLowering from "../../../2-Parse/ProgramLowering";

function usesIn(code: string) {
  return CallbackUseCollector.collect(
    ProgramLowering.program(parse(code), null),
    (scopeName) => scopeName,
  );
}

/** Each recorded value use's function name, in source order. */
function namesIn(code: string): string[] {
  return usesIn(code)
    .filter((use) => use.kind !== "type")
    .map((use) => use.functionName);
}

describe("CallbackUseCollector", () => {
  it("records an initializer that names what may be a function", () => {
    expect(
      namesIn(`
        void main() {
          PointCallback cb <- my_handler;
        }
      `),
    ).toEqual(["my_handler"]);
  });

  it("records an assignment and every declared type that may name a function (ADR-071)", () => {
    const uses = usesIn(`
        struct Timer {
          onTick handler;
        }
        void arm(onTick cb) {
          mut Timer t;
          t.handler <- my_tick;
        }
        scope S {
          void go() {
            tickSource s;
          }
        }
      `);
    expect(uses.map((use) => `${use.kind}:${use.functionName}`)).toEqual([
      "type:onTick",
      "type:onTick",
      "type:Timer",
      "assignment:my_tick",
      "type:tickSource",
      "type:S__tickSource",
    ]);
  });

  it("does not record a numeric literal, which cannot name a function", () => {
    // `\w` matches a digit, so a pattern starting with it read `5` as a name.
    // 1.4 never matched it to a function, but the artifact held it (#1869).
    expect(
      namesIn(`
        void main() {
          u8 x <- 5;
          u8 y <- 0x10;
          widget_set(5);
        }
      `),
    ).toEqual([]);
  });

  it("records each argument naming what may be a function, keyed as it is called", () => {
    expect(
      namesIn(`
        scope Bus {
          public void tick() { }
          public void wire() {
            global.widget_set_flush_cb(0, this.tick);
            global.widget_set_flush_cb(1, Bus.tick);
          }
        }
      `),
    ).toEqual(["Bus__tick", "Bus__tick"]);
  });

  it("records a use inside every statement that holds statements (#2003)", () => {
    expect(
      namesIn(`
        void main() {
          if (true) { widget_set(onIf); }
          while (false) { widget_set(onWhile); }
          for (u8 i <- 0; i < 1; i +<- 1) { widget_set(onFor); }
          do { widget_set(onDo); } while (false);
          critical { widget_set(onCritical); }
          { widget_set(onBlock); }
          forever { widget_set(onForever); }
        }
      `),
    ).toEqual([
      "onIf",
      "onWhile",
      "onFor",
      "onDo",
      "onCritical",
      "onBlock",
      "onForever",
    ]);
  });
});
