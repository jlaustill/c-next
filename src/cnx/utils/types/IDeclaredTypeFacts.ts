/**
 * What a declared type name resolves to -- the enum/bitmap classification and
 * the width that follows from it.
 *
 * These five travel together because they are one decision (#1651): a site
 * that sets `isBitmap` without `bitmapTypeName` produces a value every
 * consumer rejects, since all of them test both.
 */
interface IDeclaredTypeFacts {
  readonly isEnum: boolean;
  readonly enumTypeName: string | undefined;
  readonly isBitmap: boolean;
  readonly bitmapTypeName: string | undefined;
  readonly bitWidth: number;
}

export default IDeclaredTypeFacts;
