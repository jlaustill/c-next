/**
 * One enum's member values, in declaration order (#1669, ADR-017 "Member
 * Values"). The one place the auto-increment, the `i32` range and the
 * "members above it only" rule are applied, so 1.4 Resolve settling the
 * values and 2.1 Analyze reporting them cannot disagree.
 *
 * Pure: what a NAME is worth is the caller's environment's to answer, as for
 * every constant expression. `ownMember` is how that environment answers a
 * member of the enum being computed.
 */
import ConstantEvaluator from "./ConstantEvaluator";
import TypeCheckUtils from "./TypeCheckUtils";
import type IConstantEnvironment from "./types/IConstantEnvironment";
import type ISourcePosition from "./types/ISourcePosition";
import type TConstExpr from "../types/TConstExpr";
import type TConstResult from "../types/TConstResult";
import type TEnumMemberValue from "../types/TEnumMemberValue";

/** ADR-017: a member's value is an i32 */
const MEMBER_TYPE = "i32";

interface IEnumMemberInput {
  readonly name: string;
  readonly valueExpr: TConstExpr | null;
}

class EnumMemberValues {
  /**
   * Every member's value. `envAt(index, settled)` is the environment member
   * `index`'s value is written in, with the members above it already settled.
   */
  static compute(
    members: ReadonlyArray<IEnumMemberInput>,
    envAt: (
      index: number,
      settled: ReadonlyArray<TEnumMemberValue>,
    ) => IConstantEnvironment,
  ): TEnumMemberValue[] {
    const settled: TEnumMemberValue[] = [];
    members.forEach((member, index) => {
      settled.push(
        EnumMemberValues.ranged(
          member.valueExpr === null
            ? EnumMemberValues.continued(members, settled, index)
            : ConstantEvaluator.evaluate(
                member.valueExpr,
                envAt(index, settled),
              ),
        ),
      );
    });
    return settled;
  }

  /**
   * What `member`, a member of the enum being computed, is worth to member
   * `index`'s value: only a member declared above it has a value yet.
   */
  static ownMember(
    names: ReadonlyArray<string>,
    index: number,
    settled: ReadonlyArray<TEnumMemberValue>,
    member: string,
    spelling: string,
    at: ISourcePosition,
  ): TConstResult {
    const position = names.indexOf(member);
    const without = (
      reason: "unknown" | "selfMember" | "laterMember" | "unfolded",
    ) => ({ kind: "notConstant", reason, spelling, at }) as const;
    if (position < 0) return without("unknown");
    if (position === index) return without("selfMember");
    if (position > index) return without("laterMember");
    const above = settled[position];
    return above.kind === "value"
      ? { kind: "value", value: above.value, typeName: null }
      : without("unfolded");
  }

  /** ADR-017: a member written without a value is the one above it, plus one */
  private static continued(
    members: ReadonlyArray<IEnumMemberInput>,
    settled: ReadonlyArray<TEnumMemberValue>,
    index: number,
  ): TEnumMemberValue {
    if (index === 0) return { kind: "value", value: 0n, typeName: null };
    const above = settled[index - 1];
    return above.kind === "value"
      ? { kind: "value", value: above.value + 1n, typeName: null }
      : { kind: "follows", member: members[index - 1].name };
  }

  private static ranged(result: TEnumMemberValue): TEnumMemberValue {
    if (result.kind !== "value") return result;
    const [min, max] = TypeCheckUtils.integerRange(MEMBER_TYPE)!;
    return result.value < min || result.value > max
      ? { kind: "outOfRange", value: result.value }
      : result;
  }
}

export default EnumMemberValues;
