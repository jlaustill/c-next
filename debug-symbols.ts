import CParser from "./src/transpiler/logic/parser/c/CParser";
import CResolver from "./src/transpiler/logic/symbols/c/index";
import fs from "fs";

const headerSource = fs.readFileSync(
  "bugs/issue-948-forward-decl-scope-var/fake_lib.h",
  "utf-8",
);
const tree = CParser.parse(headerSource);
const result = CResolver.resolve(tree, "fake_lib.h");

console.log("Symbols collected from fake_lib.h:");
for (const sym of result.symbols) {
  console.log(`  ${sym.kind}: ${sym.name}`, JSON.stringify(sym, null, 2));
}
