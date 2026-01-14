"use strict";
/**
 * Initialization analysis error types
 * Used for Rust-style "use before initialization" detection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatInitializationError = formatInitializationError;
/**
 * Format an initialization error into a Rust-style error message
 */
function formatInitializationError(error) {
  const certainty = error.mayBeUninitialized ? "possibly " : "";
  return `error[${error.code}]: use of ${certainty}uninitialized variable '${error.variable}'
  --> line ${error.line}:${error.column}
   |
${error.declaration.line} |     ${error.declaration.name}
   |         - variable declared here
...
${error.line} |     ${error.variable}
   |     ^ use of ${certainty}uninitialized '${error.variable}'
   |
   = help: consider initializing '${error.variable}'`;
}
