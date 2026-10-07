#!/usr/bin/env tsx
/**
 * Entry point for the Backlog ordering pass.
 *
 * Usage:
 *   npm run backlog:order         - derive the order and apply it
 *   npm run backlog:order:check   - report drift, exit 1, write nothing
 *
 * The order is DERIVED from each issue's built-in "Blocked by" relationship
 * every run and never recorded, the same shape as `release:milestones`.
 * Nothing stores "X goes above Y".
 *
 * Why this is a scheduled job and not an event handler: GitHub has NO Actions
 * trigger for Projects v2 at all -- `projects_v2_item` is an organization
 * webhook, and `project_card`/`project_column` were classic-Projects only. So
 * nothing fires when a card is moved into or out of the column by hand, and the
 * cron is what closes that gap; it also picks up a blocker linked or unlinked
 * on an issue. The workflow also runs after `Project sync`, which catches the
 * moves that workflow makes.
 *
 * Everything testable lives in `backlog/OrderBacklog.ts`; this file is the
 * side effect.
 */

import OrderBacklog from "./backlog/OrderBacklog";

process.exitCode = OrderBacklog.run(process.argv[2] === "check");
