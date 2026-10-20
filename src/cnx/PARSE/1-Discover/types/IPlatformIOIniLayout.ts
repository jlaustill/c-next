import type IPlatformIOIniOption from "./IPlatformIOIniOption";
import type IPlatformIOIniSection from "./IPlatformIOIniSection";

/** A platformio.ini's section headers and options, in file order. */
interface IPlatformIOIniLayout {
  readonly sections: readonly IPlatformIOIniSection[];
  readonly options: readonly IPlatformIOIniOption[];
}

export default IPlatformIOIniLayout;
