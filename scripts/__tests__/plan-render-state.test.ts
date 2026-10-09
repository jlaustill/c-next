import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";

import PlanRenderState from "../plan-render-state/PlanRenderState";

/**
 * Each rule gets a project that breaks exactly one property, plus a neighbor
 * that must stay silent, so the measurement cannot pass by seeing nothing or
 * by flagging everything.
 */
const ROOT = "/repo";

const STATE = `
export default class TranspileState {
  scope = "";
  renames = new Map<string, string>();
  program: object | null = null;
  setScope(s: string): void { this.scope = s; }
  rename(a: string, b: string): void { this.renames.set(a, b); }
  scopeOf(): string { return this.scope; }
}
`;

function project(files: Record<string, string>): Project {
  const p = new Project({ useInMemoryFileSystem: true });
  p.createSourceFile(`${ROOT}/src/TRANSPILE/TranspileState.ts`, STATE);
  for (const [path, text] of Object.entries(files)) {
    p.createSourceFile(`${ROOT}/${path}`, text);
  }
  return p;
}

const imp = 'import TranspileState from "../TranspileState";';
const render = `${imp}
export default function r(s: TranspileState): void {
  s.setScope("A");
  s.rename("x", "f__x");
}
`;
const cli = `import TranspileState from "../TRANSPILE/TranspileState";
export default function c(s: TranspileState): void { s.program = {}; }
`;

function measure(plan: string) {
  return PlanRenderState.measure(
    project({
      "src/TRANSPILE/3-Render/R.ts": render,
      "src/cli/C.ts": cli,
      "src/TRANSPILE/2-Plan/P.ts": `${imp}\n${plan}`,
    }),
    ROOT,
  );
}

describe("PlanRenderState.measure", () => {
  it("reports a field 2-Plan reads that 3-Render writes through a method", () => {
    const m = measure(
      "export default (s: TranspileState) => s.renames.get('x');",
    );
    expect(m.flows.map((f) => f.field)).toEqual(["renames"]);
    expect(m.flows[0].writes[0].file).toBe("src/TRANSPILE/3-Render/R.ts");
  });

  it("follows a read through a member that reads the field", () => {
    const m = measure("export default (s: TranspileState) => s.scopeOf();");
    expect(m.flows.map((f) => f.field)).toEqual(["scope"]);
  });

  it("stays silent on a field only the CLI writes (negative control)", () => {
    const m = measure("export default (s: TranspileState) => s.program;");
    expect(m.flows).toEqual([]);
    expect(m.planWrites).toEqual([]);
  });

  it("reports a 2-Plan write, direct or through a writing member", () => {
    const m = measure(
      'export default (s: TranspileState) => { s.scope = "B"; s.setScope("C"); };',
    );
    expect(m.planWrites.map((u) => u.member)).toEqual(["scope", "setScope"]);
  });
});

describe("PlanRenderState.violations", () => {
  const clean = { planWrites: [], flows: [] };

  it("fails a clean repository when the control's writes are not seen", () => {
    expect(PlanRenderState.violations(clean, clean)).toHaveLength(
      PlanRenderState.PROBE_WRITES.length + 1,
    );
  });

  it("passes a clean repository whose control is seen", () => {
    const probeUse = (member: string, line: number) => ({
      member,
      place: "2-Plan",
      file: PlanRenderState.PROBE_PATH,
      line,
      write: true,
      wrote: [],
      read: ["usedClampOps"],
    });
    const uses = PlanRenderState.PROBE_WRITES.map((w) => {
      const [member, line] = w.split("@");
      return probeUse(member, Number(line));
    });
    const probe = {
      planWrites: uses,
      flows: [{ field: "usedClampOps", reads: uses, writes: [] }],
    };
    expect(PlanRenderState.violations(clean, probe)).toEqual([]);
  });
});
