import { execFileSync } from "node:child_process";

import type IBacklogCard from "../types/IBacklogCard";

/**
 * Read and write access to the C-Next project board.
 *
 * `scripts/setup-project.ts` held all of this privately, so a second consumer
 * would have had to restate the gh invocation, the scope-error handling and the
 * field names -- the two-place edit CLAUDE.md calls the worst anti-pattern here.
 * One declaration, both callers.
 *
 * Everything goes through the authenticated `gh` CLI rather than a token read
 * from the environment: locally that is the developer's own login, and in
 * Actions it is `GH_TOKEN`, with no branch between them.
 */
class ProjectBoard {
  static readonly TITLE = "C-Next";

  static readonly STATUS_FIELD = "Status";

  static readonly BLOCKED_FIELD = "Blocked by";

  /** Runs a GraphQL document through the authenticated gh CLI. */
  static graphql(
    query: string,
    variables: Record<string, string> = {},
  ): Record<string, never> {
    const args = ["api", "graphql", "-f", `query=${query}`];
    for (const [name, value] of Object.entries(variables)) {
      args.push("-f", `${name}=${value}`);
    }
    let raw: string;
    try {
      raw = execFileSync("gh", args, {
        encoding: "utf-8",
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      if (details.includes("INSUFFICIENT_SCOPES")) {
        throw new Error(
          "The gh token cannot read Projects.\n\n  Run: gh auth refresh -s project\n",
          { cause: error },
        );
      }
      throw new Error(`GraphQL call failed:\n${details}`, { cause: error });
    }
    const parsed = JSON.parse(raw) as {
      data?: Record<string, never>;
      errors?: { message: string }[];
    };
    if (parsed.errors !== undefined && parsed.errors.length > 0) {
      throw new Error(
        `GraphQL errors:\n${parsed.errors.map((e) => `  ${e.message}`).join("\n")}`,
      );
    }
    if (parsed.data === undefined) {
      throw new Error("GraphQL response carried no data");
    }
    return parsed.data;
  }

  /** The board's node id, or undefined when it does not exist yet. */
  static findProject(): string | undefined {
    const data = ProjectBoard.graphql(`
      query {
        viewer { projectsV2(first: 100) { nodes { id title } } }
      }
    `) as unknown as {
      viewer: { projectsV2: { nodes: { id: string; title: string }[] } };
    };
    return data.viewer.projectsV2.nodes.find(
      (node) => node.title === ProjectBoard.TITLE,
    )?.id;
  }

  /**
   * Every card in one Status column, in the order the board displays them.
   *
   * Paginated deliberately: the board is past 200 items, and a bare
   * `items(first: 100)` truncates in silence, so a card past page one reads as
   * absent rather than erroring (CLAUDE.md, #1416). `fieldValues` is 30 against
   * 14 existing fields -- `--paginate` cannot advance a nested connection, so
   * an inner cap needs headroom instead.
   */
  static columnCards(projectId: string, status: string): IBacklogCard[] {
    const cards: IBacklogCard[] = [];
    let cursor = "";
    for (;;) {
      const page = ProjectBoard.graphql(
        `
        query($projectId: ID!, $cursor: String) {
          node(id: $projectId) {
            ... on ProjectV2 {
              items(first: 100, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                nodes {
                  id
                  content {
                    ... on Issue { number title }
                    ... on PullRequest { number title }
                  }
                  status: fieldValueByName(name: "${ProjectBoard.STATUS_FIELD}") {
                    ... on ProjectV2ItemFieldSingleSelectValue { name }
                  }
                  blocked: fieldValueByName(name: "${ProjectBoard.BLOCKED_FIELD}") {
                    ... on ProjectV2ItemFieldTextValue { text }
                  }
                }
              }
            }
          }
        }
      `,
        cursor === "" ? { projectId } : { projectId, cursor },
      ) as unknown as {
        node: {
          items: {
            pageInfo: { hasNextPage: boolean; endCursor: string };
            nodes: {
              id: string;
              content: { number?: number; title?: string } | null;
              status: { name?: string } | null;
              blocked: { text?: string } | null;
            }[];
          };
        };
      };

      for (const node of page.node.items.nodes) {
        if (node.content?.number === undefined) {
          continue;
        }
        if (node.status?.name !== status) {
          continue;
        }
        cards.push({
          number: node.content.number,
          itemId: node.id,
          blockedBy: node.blocked?.text ?? "",
          title: node.content.title ?? "",
        });
      }

      if (!page.node.items.pageInfo.hasNextPage) {
        return cards;
      }
      cursor = page.node.items.pageInfo.endCursor;
    }
  }

  /** Places `itemId` directly below `afterId` in the board's own order. */
  static moveAfter(projectId: string, itemId: string, afterId: string): void {
    ProjectBoard.graphql(
      `
      mutation($projectId: ID!, $itemId: ID!, $afterId: ID!) {
        updateProjectV2ItemPosition(
          input: { projectId: $projectId, itemId: $itemId, afterId: $afterId }
        ) { clientMutationId }
      }
    `,
      { projectId, itemId, afterId },
    );
  }
}

export default ProjectBoard;
