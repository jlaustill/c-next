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
 * `a.b` is ambiguous in this grammar: it parses as a qualified TYPE, but the
 * first identifier may be a local, a parameter or a file-scope variable, in
 * which case it is a member access and no type name exists to render. Only
 * `SizeofResolver` can tell, because the answer is in `CodeGenState`.
 *
 * Rendering a type name is not free -- `generateType` registers includes and
 * typedefs on `CodeGenState` -- so rendering `a.b` as a type before knowing it
 * IS one would record an effect for a type the program never names. The thunk
 * keeps that call behind the decision. `plain-type` needs no thunk: it is the
 * arm reached when nothing else matched, so its render always happens.
 */
type TSizeofOperand =
  | {
      readonly kind: "qualified-type";
      /** The two identifiers of `a.b`, before anything decides what `a` is. */
      readonly firstName: string;
      readonly memberName: string;
      /** The C type name, evaluated only if `a.b` does name a type. */
      readonly renderTypeName: () => string;
    }
  | {
      readonly kind: "user-type";
      /** The whole type's source text -- which may be a variable's name. */
      readonly text: string;
    }
  | {
      readonly kind: "plain-type";
      readonly cTypeName: string;
    }
  | {
      readonly kind: "expression";
      /** The operand's name when it is one bare identifier, else null. */
      readonly simpleIdentifier: string | null;
      readonly hasSideEffects: boolean;
      readonly code: string;
    };

export default TSizeofOperand;
