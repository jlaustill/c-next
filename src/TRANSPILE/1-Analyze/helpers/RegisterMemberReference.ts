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

  /** The register member a chain names, or null when it names none. */
  static resolve(
    root: TRegisterRoot,
    chain: string[],
    node: ParserRuleContext,
    scopes: ScopeFrameResolver,
  ): IRegisterMember | null {
    const symbols = CodeGenState.symbols;
    if (!symbols || chain.length < 2) return null;
    const here = scopes.frameFor(node).scopePath;
    const prefix = root === null ? "" : `${root}.`;
    const known = (cName: string): boolean => symbols.knownRegisters.has(cName);
    const scoped = (scope: string, name: string): string =>
      ScopeUtils.getTranspiledCName({ scopePath: scope, name });

    const candidates: { reg: string; at: number }[] = [];
    if (root === "this") {
      if (here !== "" && known(scoped(here, chain[0])))
        candidates.push({ reg: scoped(here, chain[0]), at: 1 });
    } else {
      // `global.` bypasses shadowing by construction; a bare name does not.
      const shadowed =
        root === null &&
        scopes.declarationOfNameLexical(chain[0], scopes.frameFor(node)) !==
          null;
      if (known(chain[0]) && !shadowed)
        candidates.push({ reg: chain[0], at: 1 });
      if (root === null && here !== "" && known(scoped(here, chain[0])))
        candidates.push({ reg: scoped(here, chain[0]), at: 1 });
      if (chain.length >= 3 && known(scoped(chain[0], chain[1])))
        candidates.push({ reg: scoped(chain[0], chain[1]), at: 2 });
    }
    for (const { reg, at } of candidates) {
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
