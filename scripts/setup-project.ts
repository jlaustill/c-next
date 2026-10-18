#!/usr/bin/env tsx
/**
 * cnx project board provisioning (Issues #1247, #2189)
 *
 * Creates and seeds the GitHub Project that tracks cnx work, so a release is
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

import chalk from "chalk";

import type IProjectRef from "./types/IProjectRef";
import ProjectBoard from "./utils/ProjectBoard";
import Repo from "./utils/Repo";

const PROJECT_DESCRIPTION =
  "Issue, PR and release tracking for cnx. Workflow: docs/WORKFLOW.md";
/** This repository and the VS Code extension, both under `Repo.OWNER`. */
const LINKED_REPOSITORIES = [Repo.NAME, "vscode-cnx"] as const;

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

  1. Open the project's Settings, and under the ${ProjectBoard.STATUS_FIELD} field:
       rename "Todo"        -> "${BACKLOG}"
       rename "In Progress" -> "WIP"
     ${GROOMING} is a new option, not a rename -- add it in step 2.
     Rename in place. Do not delete and recreate: renaming preserves the option
     ID, which is what the built-in workflows are bound to.
  2. Add the missing options so the full list, in board order, reads:
       ${STATUS_OPTIONS.join(" | ")}
  3. Create a board view grouped by ${ProjectBoard.STATUS_FIELD}.

Then re-run this script.
`;

interface IStatusOption {
  id: string;
  name: string;
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

  private static record(change: string): void {
    SetupProject.changes.push(change);
    console.log(chalk.green(`  + ${change}`));
  }

  private static skip(reason: string): void {
    console.log(chalk.dim(`  = ${reason}`));
  }

  /**
   * Finds the board, creating it only when absent. The lookup is
   * `ProjectBoard.findProject`, the one every consumer uses -- this file kept a
   * private copy of it until #2189, which is how the two could disagree about
   * whose boards to search.
   *
   * GitHub assigns a new board the owner's next number, and the board is named
   * by `ProjectBoard.NUMBER` everywhere else. A board created under any other
   * number would be invisible to the workflow and the skills, so that is an
   * error naming the one constant to change, not a silent success.
   */
  private static resolveProject(): IProjectRef {
    const existing = ProjectBoard.findProject();
    if (existing !== undefined) {
      SetupProject.skip(
        `project ${ProjectBoard.OWNER}/${ProjectBoard.NUMBER} exists (${existing.url})`,
      );
      return existing;
    }

    if (SetupProject.dryRun) {
      throw new Error(
        `Project ${ProjectBoard.OWNER}/${ProjectBoard.NUMBER} does not exist yet.`,
      );
    }

    const created = ProjectBoard.graphql(
      `
      mutation($ownerId: ID!, $title: String!) {
        createProjectV2(input: { ownerId: $ownerId, title: $title }) {
          projectV2 { id number url }
        }
      }
    `,
      { ownerId: ProjectBoard.ownerId(), title: ProjectBoard.TITLE },
    ) as unknown as {
      createProjectV2: { projectV2: IProjectRef };
    };

    const board = created.createProjectV2.projectV2;
    SetupProject.record(
      `created project "${ProjectBoard.TITLE}" (${board.url})`,
    );
    if (board.number !== ProjectBoard.NUMBER) {
      throw new Error(
        `GitHub numbered the new board ${board.number}, but ProjectBoard.NUMBER is ` +
          `${ProjectBoard.NUMBER}. Set ProjectBoard.NUMBER to ${board.number} ` +
          "(scripts/utils/ProjectBoard.ts), then re-run.",
      );
    }
    return board;
  }

  /** Makes the project public, titled and described. */
  private static configureProject(projectId: string): void {
    const current = ProjectBoard.graphql(
      `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 { public title shortDescription }
        }
      }
    `,
      { projectId },
    ) as unknown as {
      node: { public: boolean; title: string; shortDescription: string | null };
    };

    const needsPublic = !current.node.public;
    const needsTitle = current.node.title !== ProjectBoard.TITLE;
    const needsDescription =
      current.node.shortDescription !== PROJECT_DESCRIPTION;
    if (!needsPublic && !needsTitle && !needsDescription) {
      SetupProject.skip("project is public, titled and described");
      return;
    }
    if (SetupProject.dryRun) {
      SetupProject.record("would set project visibility/title/description");
      return;
    }

    ProjectBoard.graphql(
      `
      mutation($projectId: ID!, $title: String!, $description: String!) {
        updateProjectV2(
          input: {
            projectId: $projectId
            public: true
            title: $title
            shortDescription: $description
          }
        ) { projectV2 { id } }
      }
    `,
      {
        projectId,
        title: ProjectBoard.TITLE,
        description: PROJECT_DESCRIPTION,
      },
    );
    SetupProject.record(
      "set project to public, with its title and description",
    );
  }

  /** Links the project to every repository whose work it tracks. */
  private static linkRepositories(projectId: string): void {
    for (const name of LINKED_REPOSITORIES) {
      const repository = ProjectBoard.graphql(
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

      ProjectBoard.graphql(
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
        `${ProjectBoard.STATUS_FIELD} is missing: ${missing.join(", ")}\n` +
          `  (it currently has: ${present.join(", ")})\n${RUNBOOK}`,
      );
    }
    SetupProject.skip(
      `${ProjectBoard.STATUS_FIELD} has all ${STATUS_OPTIONS.length} options`,
    );
  }

  /** Every open issue and PR across the linked repositories. */
  private static collectContent(): IContent[] {
    const collected: IContent[] = [];
    for (const name of LINKED_REPOSITORIES) {
      for (const kind of ["issue", "pr"] as const) {
        let cursor = "";
        for (;;) {
          const page = ProjectBoard.graphql(
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

  /** Seeds open work, never disturbing a card that has already advanced. */
  private static seedItems(
    projectId: string,
    field: { fieldId: string; options: IStatusOption[] },
  ): void {
    const content = SetupProject.collectContent();
    // Content id -> the card already on the board, with its current Status.
    const existing = new Map<string, IExistingItem>(
      ProjectBoard.items(projectId).map((entry) => [
        entry.contentId,
        { itemId: entry.itemId, status: entry.status },
      ]),
    );
    const optionId = (name: string): string => {
      const option = field.options.find((entry) => entry.name === name);
      if (option === undefined) {
        throw new Error(
          `${ProjectBoard.STATUS_FIELD} option "${name}" vanished mid-run`,
        );
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
        item = {
          itemId: ProjectBoard.addItem(projectId, entry.id),
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

      ProjectBoard.setStatus(
        projectId,
        item.itemId,
        field.fieldId,
        optionId(target),
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
          ? "Checking the cnx project board\n"
          : "Provisioning the cnx project board\n",
      ),
    );

    const project = SetupProject.resolveProject();
    SetupProject.configureProject(project.id);
    SetupProject.linkRepositories(project.id);
    const field = ProjectBoard.statusField(project.id);
    SetupProject.assertStatusOptions(field.options);
    SetupProject.seedItems(project.id, field);

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
