import { describe, expect, it } from "vitest";

import ProgramChecks from "../ProgramChecks";
import type IProgram from "../../../types/IProgram";
import type ITargetDescription from "../../../types/ITargetDescription";
import type ITranspileError from "../../../types/ITranspileError";
import type TRunTarget from "../../../types/TRunTarget";

const programWith = (target: TRunTarget): IProgram =>
  ({ target: () => target }) as unknown as IProgram;

const unknownTarget: ITranspileError = {
  line: 1,
  column: 0,
  message: "error[E0516]: unknown target 'bogus'",
  severity: "error",
};

describe("ProgramChecks.runTarget — whether the run goes on (#1922 review)", () => {
  it("goes on with a resolved target", () => {
    const checked = ProgramChecks.runTarget(
      programWith({
        kind: "resolved",
        name: "host",
        source: "option",
        description: {} as ITargetDescription,
      }),
      false,
      "main.cnx",
    );
    expect(checked).toEqual({
      proceed: true,
      target: { name: "host", source: "option" },
      errors: [],
    });
  });

  it("goes on with no target in a parse-only run, when none was named", () => {
    expect(
      ProgramChecks.runTarget(
        programWith({
          kind: "rejected",
          errors: [unknownTarget],
          absent: true,
        }),
        true,
        "main.cnx",
      ),
    ).toEqual({ proceed: true, target: null, errors: [] });
  });

  it("stops on a rejected target, placing an error with no position on the entry file", () => {
    expect(
      ProgramChecks.runTarget(
        programWith({
          kind: "rejected",
          errors: [unknownTarget],
          absent: false,
        }),
        true,
        "main.cnx",
      ),
    ).toEqual({
      proceed: false,
      target: null,
      errors: [{ ...unknownTarget, sourcePath: "main.cnx" }],
    });
  });

  // The case the host could not tell from an excused one by counting errors.
  it("stops on a rejected target that carries no error", () => {
    expect(
      ProgramChecks.runTarget(
        programWith({ kind: "rejected", errors: [], absent: false }),
        false,
        "main.cnx",
      ),
    ).toEqual({ proceed: false, target: null, errors: [] });
  });
});
