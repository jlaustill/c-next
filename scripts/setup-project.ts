#!/usr/bin/env tsx
/**
 * C-Next project board provisioning (Issue #1247)
 *
 * Creates and seeds the GitHub Project that tracks c-next work, so a release is
 * managed as ordinary work rather than through a separate release process.
 *
 * Usage:
 *   npm run project:setup   - create/link/seed, then report what changed
 *   npm run project:check   - report drift without writing anything
 *
 * Every step is idempotent: re-running reports zero changes and never moves a
 * card that has already advanced past Backlog.
 *
 * Two parts of a Project cannot be provisioned here, because GitHub exposes no
 * API for them at all -- not GraphQL, not REST, not `gh project`:
 *   - the board view
 *   - the built-in workflows
 * Those are UI-only. This script asserts the state they depend on and points at
 * the runbook in docs/WORKFLOW.md rather than pretending to configure them.
 *
 * It also never rewrites the Status field's options. `updateProjectV2Field`
 * replaces the whole option list and regenerates option IDs, which orphans every
 * item's stored value and every built-in workflow bound to an option. Renaming
 * an option in the UI preserves its ID; this script only reads them.
 */

import { execFileSync } from "node:child_process";
import chalk from "chalk";

import Repo from "./utils/Repo";

const PROJECT_TITLE = "C-Next";
const PROJECT_DESCRIPTION =
  "Issue, PR and release tracking for C-Next. Workflow: docs/WORKFLOW.md";
const LINKED_REPOSITORIES = ["c-next", "vscode-c-next"] as const;

const STATUS_FIELD = "Status";
const BLOCKED_FIELD = "Blocked by";

const GROOMING = "Grooming";
const BACKLOG = "Backlog";
const PR_REVIEW = "PR Review";

/** Board order, left to right. Renames happen in the UI; this is the assertion. */
const STATUS_OPTIONS = [
  GROOMING,
  BACKLOG,
  "WIP",
  PR_REVIEW,
  "Changes Needed",
  "Ready to Merge",
  "Done",
] as const;

const RUNBOOK = `
Finish the UI-only setup first (docs/WORKFLOW.md "Board setup"):

  1. Open the project's Settings, and under the ${STATUS_FIELD} field:
       rename "Todo"        -> "${BACKLOG}"
       rename "In Progress" -> "WIP"
     ${GROOMING} is a new option, not a rename -- add it in step 2.
     Rename in place. Do not delete and recreate: renaming preserves the option
     ID, which is what the built-in workflows are bound to.
  2. Add the missing options so the full list, in board order, reads:
       ${STATUS_OPTIONS.join(" | ")}
  3. Create a board view grouped by ${STATUS_FIELD}.

Then re-run this script.
`;

interface IStatusOption {
  id: string;
  name: string;
}

interface IProjectFields {
  statusFieldId: string;
  statusOptions: IStatusOption[];
  blockedFieldId: string | undefined;
}

interface IExistingItem {
  itemId: string;
  status: string | undefined;
}

interface IContent {
  id: string;
  number: number;
  repository: string;
  kind: "issue" | "pr";
}

class SetupProject {
  private static changes: string[] = [];

  private static dryRun = false;

  /** Runs a GraphQL document through the authenticated gh CLI. */
  private static graphql(
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

  private static record(change: string): void {
    SetupProject.changes.push(change);
    console.log(chalk.green(`  + ${change}`));
  }

  private static skip(reason: string): void {
    console.log(chalk.dim(`  = ${reason}`));
  }

  /** Finds the project by title, creating it only when absent. */
  private static resolveProject(): { id: string; number: number; url: string } {
    const data = SetupProject.graphql(`
      query {
        viewer {
          id
          projectsV2(first: 100) {
            nodes { id title number url }
          }
        }
      }
    `) as unknown as {
      viewer: {
        id: string;
        projectsV2: {
          nodes: { id: string; title: string; number: number; url: string }[];
        };
      };
    };

    const existing = data.viewer.projectsV2.nodes.find(
      (node) => node.title === PROJECT_TITLE,
    );
    if (existing !== undefined) {
      SetupProject.skip(`project "${PROJECT_TITLE}" exists (${existing.url})`);
      return existing;
    }

    if (SetupProject.dryRun) {
      throw new Error(`Project "${PROJECT_TITLE}" does not exist yet.`);
    }

    const created = SetupProject.graphql(
      `
      mutation($ownerId: ID!, $title: String!) {
        createProjectV2(input: { ownerId: $ownerId, title: $title }) {
          projectV2 { id number url }
        }
      }
    `,
      { ownerId: data.viewer.id, title: PROJECT_TITLE },
    ) as unknown as {
      createProjectV2: {
        projectV2: { id: string; number: number; url: string };
      };
    };

    SetupProject.record(`created project "${PROJECT_TITLE}"`);
    return created.createProjectV2.projectV2;
  }

  /** Makes the project public and gives it a description. */
  private static configureProject(projectId: string): void {
    const current = SetupProject.graphql(
      `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 { public shortDescription }
        }
      }
    `,
      { projectId },
    ) as unknown as {
      node: { public: boolean; shortDescription: string | null };
    };

    const needsPublic = !current.node.public;
    const needsDescription =
      current.node.shortDescription !== PROJECT_DESCRIPTION;
    if (!needsPublic && !needsDescription) {
      SetupProject.skip("project is public and described");
      return;
    }
    if (SetupProject.dryRun) {
      SetupProject.record("would set project visibility/description");
      return;
    }

    SetupProject.graphql(
      `
      mutation($projectId: ID!, $description: String!) {
        updateProjectV2(
          input: {
            projectId: $projectId
            public: true
            shortDescription: $description
          }
        ) { projectV2 { id } }
      }
    `,
      { projectId, description: PROJECT_DESCRIPTION },
    );
    SetupProject.record("set project to public with a description");
  }

  /** Links the project to every repository whose work it tracks. */
  private static linkRepositories(projectId: string): void {
    for (const name of LINKED_REPOSITORIES) {
      const repository = SetupProject.graphql(
        `
        query($owner: String!, $name: String!) {
          repository(owner: $owner, name: $name) {
            id
            projectsV2(first: 100) { nodes { id } }
          }
        }
      `,
        { owner: Repo.OWNER, name },
      ) as unknown as {
        repository: { id: string; projectsV2: { nodes: { id: string }[] } };
      };

      const alreadyLinked = repository.repository.projectsV2.nodes.some(
        (node) => node.id === projectId,
      );
      if (alreadyLinked) {
        SetupProject.skip(`${Repo.OWNER}/${name} already linked`);
        continue;
      }
      if (SetupProject.dryRun) {
        SetupProject.record(`would link ${Repo.OWNER}/${name}`);
        continue;
      }

      SetupProject.graphql(
        `
        mutation($projectId: ID!, $repositoryId: ID!) {
          linkProjectV2ToRepository(
            input: { projectId: $projectId, repositoryId: $repositoryId }
          ) { repository { id } }
        }
      `,
        { projectId, repositoryId: repository.repository.id },
      );
      SetupProject.record(`linked ${Repo.OWNER}/${name}`);
    }
  }

  /** Reads the field set, asserting the Status options the board depends on. */
  private static resolveFields(projectId: string): IProjectFields {
    const data = SetupProject.graphql(
      `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 50) {
              nodes {
                ... on ProjectV2FieldCommon { id name dataType }
                ... on ProjectV2SingleSelectField {
                  id name options { id name }
                }
              }
            }
          }
        }
      }
    `,
      { projectId },
    ) as unknown as {
      node: {
        fields: {
          nodes: {
            id: string;
            name: string;
            dataType?: string;
            options?: IStatusOption[];
          }[];
        };
      };
    };

    const fields = data.node.fields.nodes;
    const status = fields.find((field) => field.name === STATUS_FIELD);
    if (status?.options === undefined) {
      throw new Error(
        `The project has no ${STATUS_FIELD} single-select field.`,
      );
    }

    return {
      statusFieldId: status.id,
      statusOptions: status.options,
      blockedFieldId: fields.find((field) => field.name === BLOCKED_FIELD)?.id,
    };
  }

  /**
   * The three added options are UI-only work, deliberately. Rewriting the option
   * list through the API regenerates every option ID, orphaning stored values and
   * workflow bindings -- so this asserts and instructs rather than creating.
   */
  private static assertStatusOptions(options: IStatusOption[]): void {
    const present = options.map((option) => option.name);
    const missing = STATUS_OPTIONS.filter((name) => !present.includes(name));
    if (missing.length > 0) {
      throw new Error(
        `${STATUS_FIELD} is missing: ${missing.join(", ")}\n` +
          `  (it currently has: ${present.join(", ")})\n${RUNBOOK}`,
      );
    }
    SetupProject.skip(
      `${STATUS_FIELD} has all ${STATUS_OPTIONS.length} options`,
    );
  }

  /** Adds the free-text field recording what an item has waited on. */
  private static ensureBlockedField(
    projectId: string,
    existingId: string | undefined,
  ): void {
    if (existingId !== undefined) {
      SetupProject.skip(`"${BLOCKED_FIELD}" field exists`);
      return;
    }
    if (SetupProject.dryRun) {
      SetupProject.record(`would create "${BLOCKED_FIELD}" text field`);
      return;
    }
    SetupProject.graphql(
      `
      mutation($projectId: ID!, $name: String!) {
        createProjectV2Field(
          input: { projectId: $projectId, dataType: TEXT, name: $name }
        ) { projectV2Field { ... on ProjectV2Field { id } } }
      }
    `,
      { projectId, name: BLOCKED_FIELD },
    );
    SetupProject.record(`created "${BLOCKED_FIELD}" text field`);
  }

  /** Every open issue and PR across the linked repositories. */
  private static collectContent(): IContent[] {
    const collected: IContent[] = [];
    for (const name of LINKED_REPOSITORIES) {
      for (const kind of ["issue", "pr"] as const) {
        let cursor = "";
        for (;;) {
          const page = SetupProject.graphql(
            `
            query($owner: String!, $name: String!, $cursor: String) {
              repository(owner: $owner, name: $name) {
                ${kind === "issue" ? "issues" : "pullRequests"}(
                  states: OPEN, first: 100, after: $cursor
                ) {
                  pageInfo { hasNextPage endCursor }
                  nodes { id number }
                }
              }
            }
          `,
            cursor === ""
              ? { owner: Repo.OWNER, name }
              : { owner: Repo.OWNER, name, cursor },
          ) as unknown as {
            repository: Record<
              string,
              {
                pageInfo: { hasNextPage: boolean; endCursor: string };
                nodes: { id: string; number: number }[];
              }
            >;
          };

          const connection =
            page.repository[kind === "issue" ? "issues" : "pullRequests"];
          for (const node of connection.nodes) {
            collected.push({
              id: node.id,
              number: node.number,
              repository: name,
              kind,
            });
          }
          if (!connection.pageInfo.hasNextPage) {
            break;
          }
          cursor = connection.pageInfo.endCursor;
        }
      }
    }
    return collected;
  }

  /** Content id -> the item already on the board, with its current Status. */
  private static collectExistingItems(
    projectId: string,
  ): Map<string, IExistingItem> {
    const existing = new Map<string, IExistingItem>();
    let cursor = "";
    for (;;) {
      const page = SetupProject.graphql(
        `
        query($projectId: ID!, $cursor: String) {
          node(id: $projectId) {
            ... on ProjectV2 {
              items(first: 100, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                nodes {
                  id
                  content {
                    ... on Issue { id }
                    ... on PullRequest { id }
                  }
                  fieldValueByName(name: "${STATUS_FIELD}") {
                    ... on ProjectV2ItemFieldSingleSelectValue { name }
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
              content: { id?: string } | null;
              fieldValueByName: { name?: string } | null;
            }[];
          };
        };
      };

      for (const node of page.node.items.nodes) {
        if (node.content?.id === undefined) {
          continue;
        }
        existing.set(node.content.id, {
          itemId: node.id,
          status: node.fieldValueByName?.name,
        });
      }
      if (!page.node.items.pageInfo.hasNextPage) {
        break;
      }
      cursor = page.node.items.pageInfo.endCursor;
    }
    return existing;
  }

  /** Seeds open work, never disturbing a card that has already advanced. */
  private static seedItems(projectId: string, fields: IProjectFields): void {
    const content = SetupProject.collectContent();
    const existing = SetupProject.collectExistingItems(projectId);
    const optionId = (name: string): string => {
      const option = fields.statusOptions.find((entry) => entry.name === name);
      if (option === undefined) {
        throw new Error(`${STATUS_FIELD} option "${name}" vanished mid-run`);
      }
      return option.id;
    };

    let added = 0;
    let positioned = 0;
    let untouched = 0;

    for (const entry of content) {
      // Seeded issues land in Grooming, the same column `project-sync.yml` gives a
      // newly opened one. Seeding into Backlog would assert these were triaged.
      const target = entry.kind === "issue" ? GROOMING : PR_REVIEW;
      const label = `${entry.repository}#${entry.number}`;
      let item = existing.get(entry.id);

      if (item === undefined) {
        if (SetupProject.dryRun) {
          added += 1;
          continue;
        }
        const result = SetupProject.graphql(
          `
          mutation($projectId: ID!, $contentId: ID!) {
            addProjectV2ItemById(
              input: { projectId: $projectId, contentId: $contentId }
            ) { item { id } }
          }
        `,
          { projectId, contentId: entry.id },
        ) as unknown as { addProjectV2ItemById: { item: { id: string } } };
        item = {
          itemId: result.addProjectV2ItemById.item.id,
          status: undefined,
        };
        added += 1;
      }

      // Only an unset Status is ours to fill. A card someone has already moved
      // stays where it is -- that is what makes a re-run safe.
      if (item.status !== undefined) {
        untouched += 1;
        continue;
      }
      if (SetupProject.dryRun) {
        positioned += 1;
        continue;
      }

      SetupProject.graphql(
        `
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
          updateProjectV2ItemFieldValue(
            input: {
              projectId: $projectId
              itemId: $itemId
              fieldId: $fieldId
              value: { singleSelectOptionId: $optionId }
            }
          ) { projectV2Item { id } }
        }
      `,
        {
          projectId,
          itemId: item.itemId,
          fieldId: fields.statusFieldId,
          optionId: optionId(target),
        },
      );
      positioned += 1;
      if (positioned % 25 === 0) {
        console.log(chalk.dim(`  ... ${positioned} positioned (${label})`));
      }
    }

    if (added > 0) {
      SetupProject.record(`added ${added} open items`);
    }
    if (positioned > 0) {
      SetupProject.record(`set Status on ${positioned} items`);
    }
    if (added === 0 && positioned === 0) {
      SetupProject.skip(`all ${content.length} open items already positioned`);
    }
    if (untouched > 0) {
      SetupProject.skip(`${untouched} items left where they were`);
    }
  }

  static run(mode: string): void {
    SetupProject.dryRun = mode === "check";
    console.log(
      chalk.bold(
        SetupProject.dryRun
          ? "Checking the C-Next project board\n"
          : "Provisioning the C-Next project board\n",
      ),
    );

    const project = SetupProject.resolveProject();
    SetupProject.configureProject(project.id);
    SetupProject.linkRepositories(project.id);
    const fields = SetupProject.resolveFields(project.id);
    SetupProject.ensureBlockedField(project.id, fields.blockedFieldId);
    SetupProject.assertStatusOptions(fields.statusOptions);
    SetupProject.seedItems(project.id, fields);

    console.log(`\n${chalk.bold("Project:")} ${project.url}`);
    if (SetupProject.changes.length === 0) {
      console.log(
        chalk.green("Everything already matches the documented configuration."),
      );
      return;
    }
    if (SetupProject.dryRun) {
      console.log(
        chalk.yellow(
          `${SetupProject.changes.length} change(s) needed. Run: npm run project:setup`,
        ),
      );
      process.exit(1);
    }
    console.log(
      chalk.green(`${SetupProject.changes.length} change(s) applied.`),
    );
    console.log(
      chalk.yellow(
        "\nThe board view and the built-in workflows have no API and are not\n" +
          "configured here. Finish them per docs/WORKFLOW.md.",
      ),
    );
  }
}

const mode = process.argv[2] ?? "setup";
if (mode !== "setup" && mode !== "check") {
  console.error(chalk.red(`Unknown mode "${mode}". Use "setup" or "check".`));
  process.exit(1);
}

try {
  SetupProject.run(mode);
} catch (error) {
  console.error(
    chalk.red(`\n${error instanceof Error ? error.message : String(error)}`),
  );
  process.exit(1);
}

export default SetupProject;
