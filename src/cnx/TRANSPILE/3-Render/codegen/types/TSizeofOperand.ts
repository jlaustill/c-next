import type TSizeofName from "./TSizeofName";
import type TParameterInfo from "../../../../types/TParameterInfo";

/**
 * What `sizeof` is applied to, reduced to what ADR-023's resolver asks of it.
 *
 * #1445: the four arms are the four shapes `SizeofResolver` used to read off
 * the parse tree. The discrimination is the caller's because it is a question
 * about SYNTAX -- which grammar alternative matched -- and every later
 * question the resolver asks is about names and render-time state.
 *
 * ## Why `qualified-type` carries a thunk and `plain-type` does not
 *
 * `a.b` is ambiguous in this grammar: it parses as a qualified TYPE, but it
 * may be a member access. The walker renders it as an expression when the
 * chain types (#1972); what reaches this arm is a type or #1973's
 * `Struct.field`, and only `SizeofResolver` tells those apart.
 *
 * Rendering a type name is not free -- `generateType` registers includes and
 * typedefs on `CodeGenState` -- so rendering `a.b` as a type before knowing it
 * IS one would record an effect for a type the program never names. The thunk
 * keeps that call behind the decision. `plain-type` needs no thunk: its render
 * always happens, and it is also where a bare name that binds to no value
 * goes (#1974).
 */
type TSizeofOperand =
  | {
      readonly kind: "qualified-type";
      /** The first two identifiers of `a.b` */
      readonly firstName: string;
      readonly memberName: string;
      /** The C type name, evaluated only if `a.b` does name a type. */
      readonly renderTypeName: () => string;
    }
  | {
      readonly kind: "user-type";
      /** A name that binds to a value where the `sizeof` is */
      readonly text: string;
      /** What `text` binds to there */
      readonly textBinding: Exclude<TSizeofName, { readonly kind: "none" }>;
    }
  | {
      readonly kind: "plain-type";
      readonly cTypeName: string;
    }
  | {
      readonly kind: "expression";
      /** The operand's name when it is one bare identifier, else null. */
      readonly simpleIdentifier: string | null;
      /** #1969: the parameter `simpleIdentifier` binds to where it is */
      readonly parameter: TParameterInfo | undefined;
      readonly hasSideEffects: boolean;
      readonly code: string;
    };

export default TSizeofOperand;
