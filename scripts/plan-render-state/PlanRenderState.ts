/**
 * Issue #1934: "2.2 Plan reads nothing 2.3 Render writes", asserted rather than
 * recorded. #1313 measured it once with a script kept in a comment; this is
 * that measurement as a gate.
 *
 * Every `TranspileState` member's references come from the TypeScript language
 * service (ts-morph `findReferencesAsNodes`), so a write through any variable
 * name is seen. A reference is a WRITE when it is: the target of an assignment
 * or ++/--; the receiver of a collection mutator (.set/.add/...); an alias
 * (`const x = state.m`) later mutated; or a call of a member that itself writes
 * `this` (a fixed point over the class's own methods). Reads close the same way.
 *
 * An empty answer is only evidence if the detector can see a write, so the
 * check also measures a probe module making three known writes (the control).
 */

import { Node, Project, SyntaxKind } from "ts-morph";

/** One reference to a `TranspileState` member, outside tests and the class. */
interface IUse {
  readonly member: string;
  readonly place: string;
  readonly file: string;
  readonly line: number;
  readonly write: boolean;
  /** Fields this reference writes, directly or through the member it calls */
  readonly wrote: readonly string[];
  /** Fields this reference reads, directly or through the member it calls */
  readonly read: readonly string[];
}

/** A field 2.2 reads that 2.3 writes, with the sites on both sides. */
interface IFlow {
  readonly field: string;
  readonly reads: readonly IUse[];
  readonly writes: readonly IUse[];
}

interface IMeasurement {
  readonly planWrites: readonly IUse[];
  readonly flows: readonly IFlow[];
}

const STATE_PATH = "src/TRANSPILE/TranspileState.ts";
const PLAN = "2-Plan";
const RENDER = "3-Render";

const MUTATORS = new Set([
  "set",
  "add",
  "delete",
  "clear",
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
]);
const ASSIGN = new Set([
  SyntaxKind.EqualsToken,
  SyntaxKind.PlusEqualsToken,
  SyntaxKind.MinusEqualsToken,
  SyntaxKind.AsteriskEqualsToken,
  SyntaxKind.SlashEqualsToken,
  SyntaxKind.BarEqualsToken,
  SyntaxKind.AmpersandEqualsToken,
  SyntaxKind.QuestionQuestionEqualsToken,
  SyntaxKind.BarBarEqualsToken,
  SyntaxKind.AmpersandAmpersandEqualsToken,
]);

class PlanRenderState {
  static readonly PROBE_PATH = "src/TRANSPILE/2-Plan/ProbeWrites.ts";

  /** The control: three writes the detector must report, one of each kind. */
  static readonly PROBE_SOURCE = [
    'import TranspileState from "../TranspileState";',
    "export default function probe(s: TranspileState): void {",
    "  s.indentLevel++;",
    "  const used = s.usedClampOps;",
    '  used.add("x");',
    '  s.markClampOpUsed("add", "u8");',
    "}",
    "",
  ].join("\n");

  /** The probe's writes, as `member@line`. */
  static readonly PROBE_WRITES = [
    "indentLevel@3",
    "usedClampOps@4",
    "markClampOpUsed@6",
  ];

  /** Measures the project's TranspileState traffic between 2.2 and 2.3. */
  static measure(project: Project, root: string): IMeasurement {
    const cls = project
      .getSourceFileOrThrow(`${root}/${STATE_PATH}`)
      .getClassOrThrow("TranspileState");

    const bodies = new Map<string, Node>();
    for (const m of cls.getMembers()) {
      const name = PlanRenderState.nameOf(m);
      if (name === undefined) continue;
      if (
        Node.isMethodDeclaration(m) ||
        Node.isGetAccessorDeclaration(m) ||
        Node.isSetAccessorDeclaration(m)
      ) {
        bodies.set(name, m);
      } else if (
        Node.isPropertyDeclaration(m) &&
        Node.isArrowFunction(m.getInitializer())
      ) {
        bodies.set(name, m.getInitializerOrThrow());
      }
    }
    const isCallable = (m: string): boolean =>
      bodies.has(m) && !cls.getGetAccessor(m);

    // Per member body: the fields it writes and reads, and the members it calls.
    const writes = new Map<string, Set<string>>();
    const reads = new Map<string, Set<string>>();
    for (const [name, body] of bodies) {
      const w = new Set<string>();
      const r = new Set<string>();
      for (const pa of body.getDescendantsOfKind(
        SyntaxKind.PropertyAccessExpression,
      )) {
        if (pa.getExpression().getKind() !== SyntaxKind.ThisKeyword) continue;
        const m = pa.getName();
        if (isCallable(m)) {
          r.add(`call:${m}`);
          continue;
        }
        if (PlanRenderState.isDirectWrite(pa)) w.add(m);
        r.add(m);
      }
      writes.set(name, w);
      reads.set(name, r);
    }
    const close = (name: string, step: Map<string, Set<string>>): string[] => {
      const out = new Set<string>();
      const seen = new Set<string>();
      const visit = (m: string): void => {
        if (seen.has(m)) return;
        seen.add(m);
        for (const x of step.get(m) ?? []) out.add(x);
        for (const x of reads.get(m) ?? []) {
          if (x.startsWith("call:")) visit(x.slice(5));
        }
      };
      visit(name);
      return [...out].filter((x) => !x.startsWith("call:"));
    };
    const writing = new Set(
      [...bodies.keys()].filter((m) => close(m, writes).length > 0),
    );

    const uses: IUse[] = [];
    for (const m of cls.getMembers()) {
      const name = PlanRenderState.nameOf(m);
      const nameNode = (m as { getNameNode?: () => Node }).getNameNode?.();
      if (name === undefined || !Node.isReferenceFindable(nameNode)) continue;
      for (const ref of nameNode.findReferencesAsNodes()) {
        const file = ref
          .getSourceFile()
          .getFilePath()
          .slice(root.length + 1);
        const place = PlanRenderState.placeOf(file);
        if (place === null) continue;
        const pa = ref.getParent();
        if (!Node.isPropertyAccessExpression(pa) || pa.getNameNode() !== ref) {
          continue;
        }
        const parent = pa.getParent();
        const call =
          Node.isCallExpression(parent) && parent.getExpression() === pa;
        const write =
          PlanRenderState.isDirectWrite(pa) || (call && writing.has(name));
        let wrote: string[] = write ? [name] : [];
        let read = [name];
        if (isCallable(name)) {
          wrote = call ? close(name, writes) : [];
          read = close(name, reads);
        } else if (cls.getGetAccessor(name)) {
          read = [...close(name, reads), name];
        }
        uses.push({
          member: name,
          place,
          file,
          line: ref.getStartLineNumber(),
          write,
          wrote,
          read,
        });
      }
    }

    const fields = new Set(
      uses.filter((u) => u.place === PLAN).flatMap((u) => u.read),
    );
    const flows: IFlow[] = [...fields]
      .sort()
      .map((field) => ({
        field,
        reads: uses.filter((u) => u.place === PLAN && u.read.includes(field)),
        writes: uses.filter(
          (u) => u.place === RENDER && u.wrote.includes(field),
        ),
      }))
      .filter((flow) => flow.writes.length > 0);

    return {
      planWrites: uses.filter((u) => u.place === PLAN && u.write),
      flows,
    };
  }

  /**
   * What fails the check. `real` is the repository; `probe` is the repository
   * with PROBE_SOURCE added, whose writes the detector must see -- an empty
   * answer from a detector that sees nothing would otherwise read as clean.
   */
  static violations(real: IMeasurement, probe: IMeasurement): string[] {
    const out: string[] = [];
    for (const u of real.planWrites) {
      out.push(`2-Plan writes TranspileState: ${u.file}:${u.line} ${u.member}`);
    }
    for (const flow of real.flows) {
      const sites = [
        ...flow.reads.map((u) => `read ${u.file}:${u.line} (${u.member})`),
        ...flow.writes.map((u) => `write ${u.file}:${u.line} (${u.member})`),
      ];
      out.push(
        `2-Plan reads ${flow.field}, which 3-Render writes: ${sites.join("; ")}`,
      );
    }
    const seen = new Set(
      probe.planWrites
        .filter((u) => u.file === PlanRenderState.PROBE_PATH)
        .map((u) => `${u.member}@${u.line}`),
    );
    for (const expected of PlanRenderState.PROBE_WRITES) {
      if (!seen.has(expected)) {
        out.push(`control: the probe's write ${expected} was not detected`);
      }
    }
    const probeFlow = probe.flows.some((flow) =>
      flow.reads.some((u) => u.file === PlanRenderState.PROBE_PATH),
    );
    if (!probeFlow) {
      out.push(
        "control: the probe reads usedClampOps, which 3-Render writes, and no flow was detected",
      );
    }
    return out;
  }

  /** `2-Plan`, `3-Render`, `CodeGenWalker`, `cli`...; null for tests and the class. */
  static placeOf(file: string): string | null {
    if (/__tests__\/|\.test\.ts$/.test(file) || file === STATE_PATH) {
      return null;
    }
    const pass = /^src\/TRANSPILE\/(\d-[^/]+)\//.exec(file);
    if (pass) return pass[1];
    if (file === "src/TRANSPILE/CodeGenWalker.ts") return "CodeGenWalker";
    return /^src\/([^/]+)\//.exec(file)?.[1] ?? file;
  }

  private static nameOf(m: Node): string | undefined {
    return (m as { getName?: () => string }).getName?.();
  }

  private static isMutatorReceiver(n: Node): boolean {
    const p = n.getParent();
    if (!Node.isPropertyAccessExpression(p) || p.getExpression() !== n) {
      return false;
    }
    const call = p.getParent();
    return (
      MUTATORS.has(p.getName()) &&
      Node.isCallExpression(call) &&
      call.getExpression() === p
    );
  }

  /** Is this access (`x.m`) a direct write of m's value or contents? */
  private static isDirectWrite(n: Node): boolean {
    const p = n.getParent();
    if (
      Node.isBinaryExpression(p) &&
      p.getLeft() === n &&
      ASSIGN.has(p.getOperatorToken().getKind())
    ) {
      return true;
    }
    if (
      (Node.isPrefixUnaryExpression(p) || Node.isPostfixUnaryExpression(p)) &&
      (p.getOperatorToken() === SyntaxKind.PlusPlusToken ||
        p.getOperatorToken() === SyntaxKind.MinusMinusToken)
    ) {
      return true;
    }
    if (PlanRenderState.isMutatorReceiver(n)) return true;
    if (Node.isElementAccessExpression(p) && p.getExpression() === n) {
      return PlanRenderState.isDirectWrite(p);
    }
    if (Node.isVariableDeclaration(p) && p.getInitializer() === n) {
      const name = p.getNameNode();
      return (
        Node.isIdentifier(name) &&
        name
          .findReferencesAsNodes()
          .some((r) => r !== name && PlanRenderState.isMutatorReceiver(r))
      );
    }
    return false;
  }
}

export default PlanRenderState;
