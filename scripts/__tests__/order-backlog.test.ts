import { beforeEach, describe, expect, it, vi } from "vitest";

import type IBacklogCard from "../types/IBacklogCard";

const board = vi.hoisted(() => ({
  findProject: vi.fn(),
  columnCards: vi.fn(),
  moveAfter: vi.fn(),
  TITLE: "C-Next",
}));
vi.mock("../utils/ProjectBoard", () => ({ default: board }));

const { default: OrderBacklog } = await import("../backlog/OrderBacklog");

function column(...rows: [number, string][]): IBacklogCard[] {
  return rows.map(([number, blockedBy]) => ({
    number,
    itemId: `item-${number}`,
    blockedBy,
    title: `card ${number}`,
  }));
}

beforeEach(() => {
  board.findProject.mockReset().mockReturnValue("P1");
  board.columnCards.mockReset().mockReturnValue([]);
  board.moveAfter.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("OrderBacklog.run", () => {
  it("fails when the board does not exist", () => {
    board.findProject.mockReturnValue(undefined);
    expect(OrderBacklog.run(false)).toBe(1);
    expect(board.moveAfter).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty column", []],
    ["a single card", column([1, ""])],
  ])("does nothing with %s", (_label, cards) => {
    board.columnCards.mockReturnValue(cards);
    expect(OrderBacklog.run(false)).toBe(0);
    expect(board.moveAfter).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "writes nothing when the column is already ordered (checkOnly=%s)",
    (checkOnly) => {
      board.columnCards.mockReturnValue(column([2, ""], [1, "#2"]));
      expect(OrderBacklog.run(checkOnly)).toBe(0);
      expect(board.moveAfter).not.toHaveBeenCalled();
    },
  );

  it("check mode reports drift and writes NOTHING", () => {
    board.columnCards.mockReturnValue(column([1, "#2"], [2, ""]));
    expect(OrderBacklog.run(true)).toBe(1);
    expect(board.moveAfter).not.toHaveBeenCalled();
  });

  it("apply mode repairs the drift", () => {
    board.columnCards.mockReturnValue(column([1, "#2"], [2, ""]));
    expect(OrderBacklog.run(false)).toBe(0);
    expect(board.moveAfter).toHaveBeenCalledTimes(1);
    expect(board.moveAfter).toHaveBeenCalledWith("P1", "item-1", "item-2");
  });

  it("propagates a cycle rather than reporting success", () => {
    board.columnCards.mockReturnValue(column([1, "#2"], [2, "#1"]));
    expect(() => OrderBacklog.run(false)).toThrow(/cycle/);
    expect(board.moveAfter).not.toHaveBeenCalled();
  });

  it("names the references it declined, so a misparse shows in the log", () => {
    const logged: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      logged.push(String(line));
    });
    board.columnCards.mockReturnValue(
      column([1, "#2; paused — superseded by PR #99"], [2, ""]),
    );
    OrderBacklog.run(true);
    expect(logged.join("\n")).toMatch(/#1 cites #99 in prose/);
  });

  it("stays quiet when every reference is a blocker", () => {
    const logged: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      logged.push(String(line));
    });
    board.columnCards.mockReturnValue(column([1, "#2"], [2, ""]));
    OrderBacklog.run(true);
    expect(logged.join("\n")).not.toMatch(/in prose/);
  });

  it("reads the column it was asked for", () => {
    OrderBacklog.run(true);
    expect(board.columnCards).toHaveBeenCalledWith("P1", "Backlog");
  });
});
