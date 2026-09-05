/**
 * Re-take the measurement `HeaderParser.parseC` cites.
 *
 * That doc comment justifies removing the C parser's error listeners with three
 * counts over `tests/`. Counts drift with every fixture added -- they moved from
 * 1698/1444/1522 to 1700/1444/1524 inside a single session -- so a reader who
 * cannot re-run them can only trust or ignore them (#1306 review). This is the
 * command it cites.
 *
 * It builds its own lexer and parser deliberately, and that is NOT a duplicate of
 * `HeaderParser`. The two want opposite things from the same pipeline: production
 * SUPPRESSES these errors, and the whole job here is to COUNT what the
 * suppression hides. Routing this through `HeaderParser` would measure zero.
 *
 *     npm run measure:header-parse-errors
 */

import { readFileSync } from "fs";
import { execFileSync } from "child_process";

import { CharStream, CommonTokenStream } from "antlr4ng";

import { CLexer } from "../src/transpiler/logic/parser/c/grammar/CLexer";
import { CParser } from "../src/transpiler/logic/parser/c/grammar/CParser";

/** Every `.h` under `tests/`, the corpus the cited counts are taken over. */
function headerFiles(): string[] {
  return execFileSync("find", ["tests", "-name", "*.h"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter((line) => line.length > 0);
}

/**
 * Whether the header carries `extern "C"` under an `#ifdef __cplusplus` guard --
 * the construct the C grammar cannot accept and a C build never reaches.
 */
function hasCppGuard(source: string): boolean {
  return source.includes("#ifdef __cplusplus") && source.includes('extern "C"');
}

/**
 * Syntax errors the C grammar reports for `source`, LEXER INCLUDED.
 *
 * Both listeners are counted because production removes both: a measurement that
 * silenced only the parser would under-report, and would also print the lexer's
 * findings to stderr in the middle of its own output -- which is exactly how the
 * `parseCHeader` divergence stayed invisible.
 */
function syntaxErrorCount(source: string): number {
  let count = 0;
  const listener = {
    syntaxError(): void {
      count += 1;
    },
    reportAmbiguity(): void {},
    reportAttemptingFullContext(): void {},
    reportContextSensitivity(): void {},
  };

  const lexer = new CLexer(CharStream.fromString(source));
  lexer.removeErrorListeners();
  lexer.addErrorListener(listener);

  const parser = new CParser(new CommonTokenStream(lexer));
  parser.removeErrorListeners();
  parser.addErrorListener(listener);

  try {
    parser.compilationUnit();
  } catch {
    count += 1;
  }
  return count;
}

function main(): void {
  const files = headerFiles();
  let guarded = 0;
  let erroring = 0;

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    if (hasCppGuard(source)) guarded += 1;
    if (syntaxErrorCount(source) > 0) erroring += 1;
  }

  const pct = ((erroring / files.length) * 100).toFixed(1);
  console.log(`C headers under tests/:            ${files.length}`);
  console.log(`carrying an #ifdef __cplusplus
  guard around extern "C":         ${guarded}`);
  console.log(`producing >= 1 syntax error:       ${erroring} (${pct}%)`);
}

main();
