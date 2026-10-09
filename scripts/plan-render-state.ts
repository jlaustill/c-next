#!/usr/bin/env tsx
/**
 * Issue #1934: fail when 2.2 Plan writes TranspileState, or reads a field 2.3
 * Render writes. The measurement and its control are `PlanRenderState`'s; this
 * only prints and sets the exit code.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import { Project } from "ts-morph";

import PlanRenderState from "./plan-render-state/PlanRenderState";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const project = new Project({
  tsConfigFilePath: join(rootDir, "tsconfig.json"),
});
const real = PlanRenderState.measure(project, rootDir);
const probeFile = project.createSourceFile(
  join(rootDir, PlanRenderState.PROBE_PATH),
  PlanRenderState.PROBE_SOURCE,
);
const probe = PlanRenderState.measure(project, rootDir);
probeFile.delete();

const violations = PlanRenderState.violations(real, probe);
for (const violation of violations) {
  console.log(`${chalk.red("error")}  ${violation}`);
}
console.log(
  `2-Plan: ${real.planWrites.length} write(s) of TranspileState, ` +
    `${real.flows.length} field(s) read that 3-Render writes. ` +
    `Control: ${probe.planWrites.length} probe write(s) detected.`,
);
if (violations.length > 0) {
  console.log(
    chalk.red(
      "\n2.2 Plan must read nothing 2.3 Render writes (#1934, #1313 box 3).",
    ),
  );
  process.exit(1);
}
console.log(chalk.green("2.2 Plan reads nothing 2.3 Render writes."));
