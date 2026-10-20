/** A platformio.ini section header: its name and the index of its line. */
interface IPlatformIOIniSection {
  readonly name: string;
  readonly line: number;
}

export default IPlatformIOIniSection;
