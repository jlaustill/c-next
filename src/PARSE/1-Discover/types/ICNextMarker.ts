/**
 * A generated header's marker: the C-Next source it records, and where in
 * the header that name is written (#1542), so a fault about the source --
 * E0509, a source that is not there -- is reported at the marker.
 */
interface ICNextMarker {
  /** The source as the marker spells it (e.g. "led.cnx") */
  readonly sourcePath: string;
  /** 1-based line of the recorded name */
  readonly line: number;
  /** 0-based column at which the recorded name starts */
  readonly column: number;
}

export default ICNextMarker;
