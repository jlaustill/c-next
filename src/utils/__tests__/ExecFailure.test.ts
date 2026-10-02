import { execFileSync } from "node:child_process";

import ExecFailure from "../ExecFailure";

/** Run a real child that fails, and return what its `catch` receives. */
function caught(run: () => unknown): unknown {
  try {
    run();
  } catch (error: unknown) {
    return error;
  }
  throw new Error("expected the child process to fail");
}

describe("ExecFailure.of", () => {
  it("reads the streams and status of a real failed execFileSync", () => {
    const error = caught(() =>
      execFileSync(
        process.execPath,
        [
          "-e",
          "process.stdout.write('out'); process.stderr.write('err'); process.exit(3)",
        ],
        { encoding: "utf-8", stdio: "pipe" },
      ),
    );

    const failure = ExecFailure.of(error);

    expect(failure.stdout).toBe("out");
    expect(failure.stderr).toBe("err");
    expect(failure.status).toBe(3);
    expect(failure.message).toContain("Command failed");
  });

  it("decodes Buffer streams, which a call without `encoding` captures", () => {
    const error = caught(() =>
      execFileSync(
        process.execPath,
        ["-e", "process.stderr.write('raw'); process.exit(1)"],
        {
          stdio: "pipe",
        },
      ),
    );

    expect(ExecFailure.of(error).stderr).toBe("raw");
  });

  it("leaves absent streams undefined, so `??` and `||` callers fall through", () => {
    const failure = ExecFailure.of(new Error("spawn failed"));

    expect(failure.stdout).toBeUndefined();
    expect(failure.stderr).toBeUndefined();
    expect(failure.status).toBeUndefined();
    expect(failure.message).toBe("spawn failed");
  });

  it("reads a thrown non-Error as its message, without assuming a shape", () => {
    expect(ExecFailure.of("plain string")).toEqual({
      message: "plain string",
      stdout: undefined,
      stderr: undefined,
      status: undefined,
    });
  });

  it("ignores stream fields that are not text", () => {
    const failure = ExecFailure.of(
      Object.assign(new Error("odd"), {
        stdout: 42,
        stderr: null,
        status: "1",
      }),
    );

    expect(failure.stdout).toBeUndefined();
    expect(failure.stderr).toBeUndefined();
    expect(failure.status).toBeUndefined();
  });
});
