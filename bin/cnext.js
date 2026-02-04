#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const entryPoint = join(__dirname, "..", "src", "index.ts");

// Spawn tsx with the entry point and all CLI arguments
const child = spawn("npx", ["tsx", entryPoint, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: process.cwd(),
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
