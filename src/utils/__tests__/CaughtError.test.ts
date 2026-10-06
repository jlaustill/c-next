import { describe, it, expect } from "vitest";
import CaughtError from "../CaughtError";

describe("CaughtError.messageOf", () => {
  it.each([
    ["an Error", new Error("disk full"), "disk full"],
    ["an Error subclass", new TypeError("not a function"), "not a function"],
    ["a string", "plain string thrown", "plain string thrown"],
    ["a number", 42, "42"],
    ["a plain object", { code: 5 }, "[object Object]"],
    ["undefined", undefined, "undefined"],
  ])("reads %s", (_label, thrown, message) => {
    expect(CaughtError.messageOf(thrown)).toBe(message);
  });
});
