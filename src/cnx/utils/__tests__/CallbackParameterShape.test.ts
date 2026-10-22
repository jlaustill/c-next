import { describe, it, expect } from "vitest";
import CallbackParameterShape from "../CallbackParameterShape";

describe("CallbackParameterShape typedef names", () => {
  it("decodes the function a typedef name names, as the encoder spells it", () => {
    const typedef = CallbackParameterShape.typedefName("Timer_tick");
    expect(CallbackParameterShape.functionOfTypedef(typedef)).toBe(
      "Timer_tick",
    );
  });

  it("decodes nothing from a name the encoder never spells", () => {
    expect(CallbackParameterShape.functionOfTypedef("uint8_t")).toBeNull();
  });
});
