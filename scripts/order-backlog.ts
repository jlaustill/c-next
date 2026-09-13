#!/usr/bin/env tsx
/**
 * Entry point for the Backlog ordering pass.
 *
 * Usage:
 *   npm run backlog:order         - derive the order and apply it
 *   npm run backlog:order:check   - report drift, exit 1, write nothing
 *
 * The order is DERIVED from `Blocked by` every run and never recorded, the same
 * shape as `release:milestones`. Nothing stores "X goes above Y".
 *
 * Why this is a scheduled job and not an event handler: GitHub has NO Actions
 * trigger for Projects v2 at all -- `projects_v2_item` is an organization
 * webhook, and `project_card`/`project_column` were classic-Projects only. So
 * nothing can fire when `Blocked by` is edited, and a cron is the only thing
 * that closes that gap. The workflow also runs after `Project sync`, which is
 * what catches a card entering or leaving the column.
 *
 * Everything testable lives in `backlog/OrderBacklog.ts`; this file is the
 * side effect.
 */

import OrderBacklog from "./backlog/OrderBacklog";

process.exitCode = OrderBacklog.run(process.argv[2] === "check");
