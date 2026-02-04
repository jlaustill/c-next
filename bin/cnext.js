#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsxPath = join(__dirname, "..", "node_modules", ".bin", "tsx");
const entryPoint = join(__dirname, "..", "src", "index.ts");

// Spawn tsx directly (faster than npx resolution)
const child = spawn(tsxPath, [entryPoint, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: process.cwd(),
});

child.on("error", (err) => {
  console.error("Failed to start cnext:", err.message);
  process.exit(1);
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
