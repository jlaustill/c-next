import { describe, expect, it } from "vitest";
import CNextSourceParser from "../../PARSE/2-Parse/CNextSourceParser";
import ProgramLowering from "../../PARSE/2-Parse/ProgramLowering";
import MainSignature from "../MainSignature";

function signatureOf(
  source: string,
): Parameters<typeof MainSignature.takesArgs> {
  const fn = CNextSourceParser.parse(source)
    .tree.declaration()[0]
    .functionDeclaration()!;
  return [
    fn.IDENTIFIER().getText(),
    ProgramLowering.parameters(fn.parameterList()),
  ];
}

describe("MainSignature.takesArgs", () => {
  it.each([
    "void main(string args[]) {}",
    "void main(u8 args[][]) {}",
    "void main(i8 args[][]) {}",
  ])("%s takes the command-line args", (source) => {
    expect(MainSignature.takesArgs(...signatureOf(source))).toBe(true);
  });

  it.each([
    "void main() {}",
    "void foo(string args[]) {}",
    "void main(u32 count) {}",
    "void main(string args[], u32 count) {}",
    "void main(u8 args[]) {}",
    "void main(u16 args[][]) {}",
  ])("%s does not", (source) => {
    expect(MainSignature.takesArgs(...signatureOf(source))).toBe(false);
  });
});
