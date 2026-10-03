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
 *
 * WHICH root a chain is written with is not a register question, so it is
 * asked of `ChainRoot`. This file held two copies of it and `BitAccessAnalyzer`
 * held two more.
 */

import { ParserRuleContext } from "antlr4ng";

import * as Parser from "../../../PARSE/2-Parse/grammar/CNextParser";
import ChainRoot from "../../../utils/ChainRoot";
import QualifiedCName from "../../../utils/QualifiedCName";
import ScopeUtils from "../../../utils/ScopeUtils";
import IRegisterMember from "../types/IRegisterMember";
import TChainRoot from "../../../types/TChainRoot";
import OperandTyper from "../../../utils/OperandTyper";
import ParserUtils from "../../../utils/ParserUtils";
import type IAnalysisContext from "../types/IAnalysisContext";
import type ICodeGenSymbols from "../../../types/ICodeGenSymbols";

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
    symbols: ICodeGenSymbols,
    chain: string[],
    here: string,
  ): { reg: string; at: number }[] {
    if (here === "") return [];
    const inScope = ScopeUtils.getTranspiledCName({
      scopePath: here,
      name: chain[0],
    });
    return RegisterMemberReference.isRegister(symbols, inScope)
      ? [{ reg: inScope, at: 1 }]
      : [];
  }

  /**
   * The registers a bare or `global.`-rooted chain may name, in the order
   * codegen accepted them: the file-scope register, then the enclosing scope's
   * own, then another scope's through `S.R.M`.
   */
  private static searchCandidates(
    symbols: ICodeGenSymbols,
    root: TChainRoot,
    chain: string[],
    here: string,
    isShadowed: boolean,
  ): { reg: string; at: number }[] {
    const scoped = (scope: string, name: string): string =>
      ScopeUtils.getTranspiledCName({ scopePath: scope, name });
    const candidates: { reg: string; at: number }[] = [];

    // `global.` bypasses shadowing by construction; a bare name does not.
    if (!isShadowed && RegisterMemberReference.isRegister(symbols, chain[0])) {
      candidates.push({ reg: chain[0], at: 1 });
    }
    if (root === null && here !== "") {
      const inScope = scoped(here, chain[0]);
      if (RegisterMemberReference.isRegister(symbols, inScope)) {
        candidates.push({ reg: inScope, at: 1 });
      }
    }
    if (chain.length >= 3) {
      const crossScope = scoped(chain[0], chain[1]);
      if (RegisterMemberReference.isRegister(symbols, crossScope)) {
        candidates.push({ reg: crossScope, at: 2 });
      }
    }
    return candidates;
  }

  /** Whether the program declares a register under this C name. */
  private static isRegister(symbols: ICodeGenSymbols, cName: string): boolean {
    return symbols.knownRegisters.has(cName);
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
    symbols: ICodeGenSymbols,
    root: TChainRoot,
    chain: string[],
    here: string,
    isShadowed: boolean,
  ): { reg: string; at: number }[] {
    return root === "this"
      ? RegisterMemberReference.thisCandidate(symbols, chain, here)
      : RegisterMemberReference.searchCandidates(
          symbols,
          root,
          chain,
          here,
          isShadowed,
        );
  }

  /**
   * The register member an assignment target names, or null: its leading
   * names up to the first subscript, read from the target's own root
   */
  static ofTarget(
    target: Parser.AssignmentTargetContext,
    context: IAnalysisContext,
  ): IRegisterMember | null {
    const names = target
      .postfixTargetOp()
      .map((op) => (op.DOT() === null ? null : op.IDENTIFIER()!.getText()));
    return RegisterMemberReference.resolve(
      ChainRoot.ofTarget(target),
      RegisterMemberReference.leadingNames(
        target.IDENTIFIER().getText(),
        names,
      ),
      target,
      context,
    );
  }

  /** The register member a chain names, or null when it names none. */
  static resolve(
    root: TChainRoot,
    chain: string[],
    node: ParserRuleContext,
    context: IAnalysisContext,
  ): IRegisterMember | null {
    const symbols = context.symbols;
    if (chain.length < 2) return null;

    // A bare root that names a declared value here -- a local, a member, a
    // global, this file's or an included one's -- shadows a register of that
    // spelling; Program's one binder decides what the name means (#1668)
    const scopePath = OperandTyper.scopePathAt(node, context);
    const binding =
      root === null
        ? context.program.bindValue(
            context.sourceFile,
            null,
            chain[0],
            ParserUtils.getPosition(node),
          )
        : null;
    const isShadowed =
      binding?.kind === "local" || binding?.kind === "variable";

    const prefix = root === null ? "" : `${root}.`;
    for (const { reg, at } of RegisterMemberReference.registerCandidates(
      symbols,
      root,
      chain,
      scopePath,
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
