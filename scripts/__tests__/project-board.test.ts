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

const BOARD = { id: "P1", number: 1, url: "https://board/1" };

describe("ProjectBoard identity", () => {
  it("belongs to the organization that owns the repositories", () => {
    // One fact, not two: the board moves when the repositories do (#2189).
    expect(ProjectBoard.OWNER).toBe("smeltworks");
  });

  it("is named by its number, which a rename in the UI cannot change", () => {
    expect(ProjectBoard.NUMBER).toBe(1);
  });
});

describe("ProjectBoard.findProject", () => {
  it("returns the board when the organization has it", () => {
    replies({ data: { organization: { projectV2: BOARD } } });
    expect(ProjectBoard.findProject()).toEqual(BOARD);
  });

  it("returns undefined when the organization has no such board", () => {
    replies({ data: { organization: { projectV2: null } } });
    expect(ProjectBoard.findProject()).toBeUndefined();
  });

  it("asks the owning organization for its board by number, not whoever holds the token", () => {
    // `viewer` is the token's own account. Locally that was the board's owner;
    // under a GitHub App token it is the app's bot, which owns no projects, so
    // a viewer lookup reads every board as absent.
    replies({ data: { organization: { projectV2: BOARD } } });
    ProjectBoard.findProject();
    const args = execFileSync.mock.calls[0]?.[1] as string[];
    expect(args).toContain("owner=smeltworks");
    expect(args.join("\n")).toMatch(/organization\(login: \$owner\)/);
    expect(args.join("\n")).toMatch(/projectV2\(number: 1\)/);
    expect(args.join("\n")).not.toMatch(/viewer/);
  });
});

describe("ProjectBoard.ownerId", () => {
  it("returns the owning organization's node id", () => {
    replies({ data: { organization: { id: "O_1" } } });
    expect(ProjectBoard.ownerId()).toBe("O_1");
    expect(execFileSync.mock.calls[0]?.[1] as string[]).toContain(
      "owner=smeltworks",
    );
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

function card(
  itemId: string,
  contentId: string,
  repository: string,
  number: number,
  status: string | null,
): Record<string, unknown> {
  return {
    id: itemId,
    content: {
      id: contentId,
      number,
      repository: { nameWithOwner: repository },
    },
    status: status === null ? null : { name: status },
  };
}

describe("ProjectBoard.items", () => {
  it("reads every card with its content identity and Status", () => {
    replies(page([card("i1", "I_1", "smeltworks/cnx", 7, "Backlog")]));
    expect(ProjectBoard.items("P1")).toEqual([
      {
        itemId: "i1",
        contentId: "I_1",
        status: "Backlog",
        repository: "smeltworks/cnx",
        number: 7,
      },
    ]);
  });

  it("reads an unset Status as undefined, not as a column name", () => {
    replies(page([card("i1", "I_1", "smeltworks/cnx", 7, null)]));
    expect(ProjectBoard.items("P1")[0]?.status).toBeUndefined();
  });

  it("skips a draft item, which has no issue or pull request", () => {
    replies(page([{ id: "i0", content: null, status: { name: "Backlog" } }]));
    expect(ProjectBoard.items("P1")).toEqual([]);
  });

  it("follows pagination and keeps board order across the boundary", () => {
    replies(
      page([card("i2", "I_2", "smeltworks/cnx", 2, "Done")], true, "C2"),
      page([card("i1", "I_1", "smeltworks/cnx", 1, "Done")]),
    );
    expect(ProjectBoard.items("P1").map((entry) => entry.itemId)).toEqual([
      "i2",
      "i1",
    ]);
    expect(execFileSync.mock.calls[1]?.[1] as string[]).toContain("cursor=C2");
  });
});

describe("ProjectBoard.statusField", () => {
  it("returns the Status field's id and its options", () => {
    replies({
      data: {
        node: {
          fields: {
            nodes: [
              { id: "F0", name: "Title" },
              {
                id: "F1",
                name: "Status",
                options: [{ id: "o1", name: "WIP" }],
              },
            ],
          },
        },
      },
    });
    expect(ProjectBoard.statusField("P1")).toEqual({
      fieldId: "F1",
      options: [{ id: "o1", name: "WIP" }],
    });
  });

  it("refuses a board without a Status single-select field", () => {
    replies({
      data: { node: { fields: { nodes: [{ id: "F0", name: "Title" }] } } },
    });
    expect(() => ProjectBoard.statusField("P1")).toThrow(/no Status/);
  });
});

describe("ProjectBoard writes", () => {
  it("adds an item and returns the new item's id", () => {
    replies({ data: { addProjectV2ItemById: { item: { id: "NEW" } } } });
    expect(ProjectBoard.addItem("P1", "I_1")).toBe("NEW");
    const args = execFileSync.mock.calls[0]?.[1] as string[];
    expect(args).toContain("projectId=P1");
    expect(args).toContain("contentId=I_1");
  });

  it("sets a Status by option id", () => {
    replies({ data: { updateProjectV2ItemFieldValue: {} } });
    ProjectBoard.setStatus("P1", "ITEM", "FIELD", "OPTION");
    const args = execFileSync.mock.calls[0]?.[1] as string[];
    expect(args).toContain("itemId=ITEM");
    expect(args).toContain("fieldId=FIELD");
    expect(args).toContain("optionId=OPTION");
  });
});

describe("ProjectBoard.projectAt", () => {
  it.each([
    ["user", /user\(login: \$owner\)/],
    ["organization", /organization\(login: \$owner\)/],
  ] as const)("reads a %s's board by number", (ownerType, root) => {
    replies({ data: { [ownerType]: { projectV2: BOARD } } });
    expect(ProjectBoard.projectAt(ownerType, "someone", 3)).toEqual({
      id: BOARD.id,
      number: BOARD.number,
      url: BOARD.url,
    });
    const args = execFileSync.mock.calls[0]?.[1] as string[];
    expect(args).toContain("owner=someone");
    expect(args.join("\n")).toMatch(root);
    expect(args.join("\n")).toMatch(/projectV2\(number: 3\)/);
  });

  it("refuses a number that is not a positive integer", () => {
    // It is written into the query text, so it must be a plain integer.
    expect(() => ProjectBoard.projectAt("user", "someone", 1.5)).toThrow(
      /positive integer/,
    );
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("reports a board that does not exist", () => {
    replies({ data: { user: { projectV2: null } } });
    expect(() => ProjectBoard.projectAt("user", "someone", 9)).toThrow(
      /no project 9/,
    );
  });
});
