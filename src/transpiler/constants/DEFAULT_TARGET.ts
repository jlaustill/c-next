/**
 * ADR-049: Default target capabilities (safe fallback).
 *
 * One definition, imported by both `CodeGenState` and `CodeGenerator`. They
 * each carried a byte-identical copy until #1307 added two fields and had to
 * add them to both -- along with a second, structurally identical
 * `TargetCapabilities` interface in `CodeGenerator`. Widening a target
 * capability is a single edit now.
 */

import type ITargetCapabilities from "../output/codegen/types/ITargetCapabilities";

const DEFAULT_TARGET: ITargetCapabilities = {
  wordSize: 32,
  hasLdrexStrex: false,
  hasBasepri: false,
  significantExternalIdentifierChars: 31,
  significantInternalIdentifierChars: 63,
};

export default DEFAULT_TARGET;
