import { beforeEach, describe, expect, it, vi } from "vitest";

const execFileSync = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFileSync }));

const { default: ProjectBoard } = await import("../utils/ProjectBoard");

/** Queues one gh response per call, in order. */
function replies(...payloads: unknown[]): void {
  for (const payload of payloads) {
    execFileSync.mockReturnValueOnce(JSON.stringify(payload));
  }
}

function page(
  nodes: unknown[],
  hasNextPage = false,
  endCursor = "",
): Record<string, unknown> {
  return {
    data: { node: { items: { pageInfo: { hasNextPage, endCursor }, nodes } } },
  };
}

function item(
  id: string,
  number: number,
  status: string,
  blocked = "",
): Record<string, unknown> {
  return {
    id,
    content: { number, title: `card ${number}` },
    status: { name: status },
    blocked: { text: blocked },
  };
}

beforeEach(() => {
  execFileSync.mockReset();
});

describe("ProjectBoard.graphql", () => {
  it("turns a missing Projects scope into the command that fixes it", () => {
    execFileSync.mockImplementationOnce(() => {
      throw new Error(
        "GraphQL: your token has not been granted INSUFFICIENT_SCOPES",
      );
    });
    expect(() => ProjectBoard.graphql("query {}")).toThrow(
      /gh auth refresh -s project/,
    );
  });

  it("surfaces a gh failure that is not a scope problem", () => {
    execFileSync.mockImplementationOnce(() => {
      throw new Error("could not resolve to a node with that id");
    });
    expect(() => ProjectBoard.graphql("query {}")).toThrow(
      /GraphQL call failed[\s\S]*could not resolve/,
    );
  });

  it("raises a GraphQL error list rather than returning empty data", () => {
    replies({ errors: [{ message: "Field 'nope' doesn't exist" }] });
    expect(() => ProjectBoard.graphql("query {}")).toThrow(/nope/);
  });

  it("refuses a response carrying no data", () => {
    replies({});
    expect(() => ProjectBoard.graphql("query {}")).toThrow(/no data/);
  });

  it("passes each variable to gh as its own -f pair", () => {
    replies({ data: { ok: true } });
    ProjectBoard.graphql("query {}", { projectId: "P1", cursor: "C1" });
    const args = execFileSync.mock.calls[0]?.[1] as string[];
    expect(args).toContain("projectId=P1");
    expect(args).toContain("cursor=C1");
  });
});

describe("ProjectBoard.findProject", () => {
  it.each([
    ["the board exists", [{ id: "P1", title: "C-Next" }], "P1"],
    ["a different board exists", [{ id: "P9", title: "Other" }], undefined],
    ["no boards exist", [], undefined],
  ])("returns the id when %s", (_label, nodes, expected) => {
    replies({ data: { viewer: { projectsV2: { nodes } } } });
    expect(ProjectBoard.findProject()).toBe(expected);
  });
});

describe("ProjectBoard.columnCards", () => {
  it("returns only the requested column", () => {
    replies(page([item("i1", 1, "Backlog"), item("i2", 2, "WIP")]));
    expect(
      ProjectBoard.columnCards("P1", "Backlog").map((c) => c.number),
    ).toEqual([1]);
  });

  it("follows pagination instead of truncating at the first page", () => {
    // The failure this guards is silent: a bare first-page read makes every
    // card past it look absent rather than erroring (CLAUDE.md, #1416).
    replies(
      page([item("i1", 1, "Backlog")], true, "CURSOR2"),
      page([item("i2", 2, "Backlog")]),
    );
    expect(
      ProjectBoard.columnCards("P1", "Backlog").map((c) => c.number),
    ).toEqual([1, 2]);
    expect(execFileSync).toHaveBeenCalledTimes(2);
    expect(execFileSync.mock.calls[1]?.[1] as string[]).toContain(
      "cursor=CURSOR2",
    );
  });

  it("preserves board order across a page boundary", () => {
    replies(
      page([item("i3", 3, "Backlog"), item("i1", 1, "Backlog")], true, "C2"),
      page([item("i2", 2, "Backlog")]),
    );
    expect(
      ProjectBoard.columnCards("P1", "Backlog").map((c) => c.number),
    ).toEqual([3, 1, 2]);
  });

  it("skips a draft item, which has no issue number", () => {
    replies(
      page([
        { id: "i0", content: null, status: { name: "Backlog" }, blocked: null },
      ]),
    );
    expect(ProjectBoard.columnCards("P1", "Backlog")).toEqual([]);
  });

  it("reads an absent Blocked by as empty, not undefined", () => {
    replies(page([{ ...item("i1", 1, "Backlog"), blocked: null }]));
    expect(ProjectBoard.columnCards("P1", "Backlog")[0]?.blockedBy).toBe("");
  });

  it("carries the Blocked by text through verbatim", () => {
    replies(page([item("i1", 1, "Backlog", "#2; prose — see #3")]));
    expect(ProjectBoard.columnCards("P1", "Backlog")[0]?.blockedBy).toBe(
      "#2; prose — see #3",
    );
  });
});

describe("ProjectBoard.moveAfter", () => {
  it("sends the three ids the mutation needs", () => {
    replies({ data: { updateProjectV2ItemPosition: {} } });
    ProjectBoard.moveAfter("P1", "ITEM", "AFTER");
    const args = execFileSync.mock.calls[0]?.[1] as string[];
    expect(args).toContain("projectId=P1");
    expect(args).toContain("itemId=ITEM");
    expect(args).toContain("afterId=AFTER");
  });
});
