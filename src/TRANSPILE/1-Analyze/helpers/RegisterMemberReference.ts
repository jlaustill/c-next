/**
 * Which register member a chain names (ADR-004).
 *
 * #1322. Two rules ask this and they are not the same rule: ADR-004's access
 * modifiers (E0870-E0872) and ADR-034's bitmap access (E0882/E0883), because a
 * register member may be TYPED by a bitmap and a bitmap rule then has to reach
 * it through the register.
 *
 * The resolution is the thing that must not be written twice. It tries the
 * spellings codegen accepted, in a specific order: `R.M` for a global
 * register; a scoped register's bare name inside its own scope; `S.R.M`
 * across a scope. `this.` binds to the enclosing scope and `global.` to the
 * file scope, so each root reads the chain from its own offset. A second copy
 * would be free to disagree about any of those, and a rule enforced on a
 * different register than the one written is worse than no rule.
 */

import { ParserRuleContext } from "antlr4ng";

import * as Parser from "../../../transpiler/logic/parser/grammar/CNextParser";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import QualifiedCName from "../../../utils/QualifiedCName";
import ScopeUtils from "../../../utils/ScopeUtils";
import IRegisterMember from "../types/IRegisterMember";
import ScopeFrameResolver from "../ScopeFrameResolver";

/** The chain's root keyword, or none. */
type TRegisterRoot = "this" | "global" | null;

class RegisterMemberReference {
  /**
   * The chain's leading member names: the head, then every `.name` op up to
   * the first subscript or call.
   */
  static leadingNames(
    head: string | undefined,
    names: (string | null)[],
  ): string[] {
    const chain = head === undefined ? [] : [head];
    for (const name of names) {
      if (name === null) break;
      chain.push(name);
    }
    return chain;
  }

  /** The root keyword a postfix expression starts from. */
  static rootOf(primary: Parser.PrimaryExpressionContext): TRegisterRoot {
    if (primary.THIS()) return "this";
    if (primary.GLOBAL()) return "global";
    return null;
  }

  /** The same for an assignment target, whose keywords sit on the target. */
  static rootOfTarget(target: Parser.AssignmentTargetContext): TRegisterRoot {
    if (target.THIS()) return "this";
    if (target.GLOBAL()) return "global";
    return null;
  }

  /**
   * The register spellings a chain's leading names may denote, and how many
   * names each consumed. In the order codegen accepted them.
   *
   * Separated from the member lookup below because they are two questions --
   * "which register could this be?" and "does that register declare this
   * member?" -- and reading them as one was what made this the densest
   * function in the pass.
   */
  /** The one register `this.R` can name: R in the enclosing scope. */
  private static thisCandidate(
    chain: string[],
    here: string,
  ): { reg: string; at: number }[] {
    if (here === "") return [];
    const inScope = ScopeUtils.getTranspiledCName({
      scopePath: here,
      name: chain[0],
    });
    return RegisterMemberReference.isRegister(inScope)
      ? [{ reg: inScope, at: 1 }]
      : [];
  }

  /**
   * The registers a bare or `global.`-rooted chain may name, in the order
   * codegen accepted them: the file-scope register, then the enclosing scope's
   * own, then another scope's through `S.R.M`.
   */
  private static searchCandidates(
    root: TRegisterRoot,
    chain: string[],
    here: string,
    isShadowed: boolean,
  ): { reg: string; at: number }[] {
    const scoped = (scope: string, name: string): string =>
      ScopeUtils.getTranspiledCName({ scopePath: scope, name });
    const candidates: { reg: string; at: number }[] = [];

    // `global.` bypasses shadowing by construction; a bare name does not.
    if (!isShadowed && RegisterMemberReference.isRegister(chain[0])) {
      candidates.push({ reg: chain[0], at: 1 });
    }
    if (root === null && here !== "") {
      const inScope = scoped(here, chain[0]);
      if (RegisterMemberReference.isRegister(inScope)) {
        candidates.push({ reg: inScope, at: 1 });
      }
    }
    if (chain.length >= 3) {
      const crossScope = scoped(chain[0], chain[1]);
      if (RegisterMemberReference.isRegister(crossScope)) {
        candidates.push({ reg: crossScope, at: 2 });
      }
    }
    return candidates;
  }

  /** Whether the program declares a register under this C name. */
  private static isRegister(cName: string): boolean {
    return CodeGenState.symbols?.knownRegisters.has(cName) ?? false;
  }

  /**
   * The register spellings a chain's leading names may denote, and how many
   * names each consumed.
   *
   * `this.R` STATES where to look and admits exactly one answer; everything
   * else SEARCHES. Splitting on that -- rather than on line count -- is why
   * these are two functions.
   */
  private static registerCandidates(
    root: TRegisterRoot,
    chain: string[],
    here: string,
    isShadowed: boolean,
  ): { reg: string; at: number }[] {
    return root === "this"
      ? RegisterMemberReference.thisCandidate(chain, here)
      : RegisterMemberReference.searchCandidates(root, chain, here, isShadowed);
  }

  /** The register member a chain names, or null when it names none. */
  static resolve(
    root: TRegisterRoot,
    chain: string[],
    node: ParserRuleContext,
    scopes: ScopeFrameResolver,
  ): IRegisterMember | null {
    const symbols = CodeGenState.symbols;
    if (!symbols || chain.length < 2) return null;

    const frame = scopes.frameFor(node);
    const isShadowed =
      root === null &&
      scopes.declarationOfNameLexical(chain[0], frame) !== null;

    const prefix = root === null ? "" : `${root}.`;
    for (const { reg, at } of RegisterMemberReference.registerCandidates(
      root,
      chain,
      frame.scopePath,
      isShadowed,
    )) {
      const member = chain[at];
      if (member === undefined) continue;
      const key = QualifiedCName.fromParts([reg, member]);
      const access = symbols.registerMemberAccess.get(key);
      if (access === undefined) continue;
      return {
        key,
        access,
        member,
        spelling: prefix + chain.slice(0, at + 1).join("."),
        consumed: at + 1,
      };
    }
    return null;
  }
}

export default RegisterMemberReference;
