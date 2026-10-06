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
  blockers: number[] = [],
): Record<string, unknown> {
  return {
    id,
    content: {
      number,
      title: `card ${number}`,
      blockedBy: {
        totalCount: blockers.length,
        nodes: blockers.map((blocker) => ({ number: blocker })),
      },
    },
    status: { name: status },
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
    replies(page([{ id: "i0", content: null, status: { name: "Backlog" } }]));
    expect(ProjectBoard.columnCards("P1", "Backlog")).toEqual([]);
  });

  it("carries the built-in Blocked by relationship as issue numbers", () => {
    replies(page([item("i1", 1, "Backlog", [2, 3])]));
    expect(ProjectBoard.columnCards("P1", "Backlog")[0]?.blockedBy).toEqual([
      2, 3,
    ]);
  });

  it("asks GitHub for each issue's built-in relationship", () => {
    replies(page([]));
    ProjectBoard.columnCards("P1", "Backlog");
    const args = execFileSync.mock.calls[0]?.[1] as string[];
    expect(args.join("\n")).toMatch(/blockedBy\(first: 50\)/);
  });

  it("reads a pull request, which has no relationship, as unblocked", () => {
    replies(
      page([
        {
          id: "i1",
          content: { number: 1, title: "pr" },
          status: { name: "Backlog" },
        },
      ]),
    );
    expect(ProjectBoard.columnCards("P1", "Backlog")[0]?.blockedBy).toEqual([]);
  });

  it("refuses a relationship longer than the page that read it", () => {
    // A blocker dropped here reads as "not blocked" -- the silent truncation
    // CLAUDE.md forbids (#1416).
    const truncated = item("i1", 1, "Backlog", [2]);
    (
      truncated.content as { blockedBy: { totalCount: number } }
    ).blockedBy.totalCount = 51;
    replies(page([truncated]));
    expect(() => ProjectBoard.columnCards("P1", "Backlog")).toThrow(
      /#1 has 51 blockers/,
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
