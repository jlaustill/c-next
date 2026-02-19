#!/usr/bin/env node

import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distEntry = join(__dirname, "..", "dist", "index.js");

// Use pre-built bundle when available (fast), fall back to tsx for development
let child;
if (existsSync(distEntry)) {
  child = spawn(process.execPath, [distEntry, ...process.argv.slice(2)], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
} else {
  const tsxPath = join(__dirname, "..", "node_modules", ".bin", "tsx");
  const entryPoint = join(__dirname, "..", "src", "index.ts");
  child = spawn(tsxPath, [entryPoint, ...process.argv.slice(2)], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
}

child.on("error", (err) => {
  console.error("Failed to start cnext:", err.message);
  process.exit(1);
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
