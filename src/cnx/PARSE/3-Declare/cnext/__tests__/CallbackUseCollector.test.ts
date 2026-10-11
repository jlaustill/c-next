/**
 * What 1.3 records as a possible callback use (#1825). Which uses are callbacks
 * is 1.4's, tested in `CallbackCompatibility.test`; this pins what the
 * artifact holds, which `TCallbackUse` documents as a place a file names what
 * may be a function.
 */
import { describe, expect, it } from "vitest";
import parse from "./testHelpers";
import CallbackUseCollector from "../collectors/CallbackUseCollector";

/** Each recorded use's function name, in source order. */
function namesIn(code: string): string[] {
  return CallbackUseCollector.collect(
    parse(code),
    (scopeName) => scopeName,
  ).map((use) => use.functionName);
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
});
