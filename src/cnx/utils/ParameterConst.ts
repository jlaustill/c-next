/**
 * Whether a parameter's generated declaration carries `const` (ADR-071
 * Decision 7): a read-only one does, except a function pointer -- a callback
 * written as its `_fp` typedef, or an `ISR` -- whose copy takes none
 * (cppcheck 2.13's MISRA addon misreports a `const ISR` parameter as Rule
 * 8.2). The prototype and the `_fp` typedef read this one answer, so they
 * cannot disagree: when each derived its own, the typedef gained a `const`
 * the prototype lacked (#1529) or lost one it had (#1552).
 */
class ParameterConst {
  static isWritten(
    isReadOnly: boolean,
    typeName: string,
    isCallbackType: boolean,
  ): boolean {
    return isReadOnly && !isCallbackType && typeName !== "ISR";
  }
}

export default ParameterConst;
