import RequirementSites from "../../utils/RequirementSites";
import type IRequirementSite from "../../types/IRequirementSite";
import type TDeferredSiteKey from "../../types/TDeferredSiteKey";
import type TIncludeHeader from "../../types/TIncludeHeader";

/**
 * #1991: what one file's plan requires -- its headers, helpers and deferred
 * forms, with the sites that asked (#1143) -- collected while 2.2 plans the
 * file and read once, to build its emission plan. `planFile` makes one per
 * file, so 2.2 writes no shared state for it and nothing outlives the file.
 *
 * The sites are attribution only: the banner and the file result list them,
 * and no decision reads one (#1928, #1997).
 */
class PlannedRequirements {
  private readonly headers = new Set<TIncludeHeader>();
  private readonly sites = new Map<TDeferredSiteKey, IRequirementSite[]>();
  private readonly castHelperKeys = new Set<string>();
  private readonly safeDivisionKeys = new Set<string>();
  private readonly lengthHelperNames = new Set<string>();
  private ldrexStrexLoop = false;
  private readonly sourcePath: string;

  constructor(sourcePath: string | null) {
    this.sourcePath = sourcePath ?? "";
  }

  /**
   * The one sink for a header or deferred emission the plan needs. Only the
   * two whose plan blocks carry sites record one: "isr" carries none.
   */
  require(header: TIncludeHeader, line: number | null = null): void {
    if (header === "irq_wrappers" || header === "float_static_assert") {
      this.noteSite(header, line);
    }
    this.headers.add(header);
  }

  requires(header: TIncludeHeader): boolean {
    return this.headers.has(header);
  }

  /**
   * #1668: a single-evaluation saturating cast's helper. It uses the limit
   * macros, so it needs `<limits.h>` exactly as the inline form does.
   */
  castHelper(sourceType: string, targetType: string): void {
    this.castHelperKeys.add(`${sourceType}_${targetType}`);
    this.require("limits");
  }

  /** ADR-051: a safe_div/safe_mod helper, keyed as `"div_u32"` */
  safeDivision(operation: string, cnxType: string): void {
    this.safeDivisionKeys.add(`${operation}_${cnxType}`);
  }

  /** ADR-058: a runtime integer length's helper, `"cnx_value_bit_length"` */
  lengthHelper(name: string): void {
    this.lengthHelperNames.add(name);
  }

  /** #1997: an LDREX/STREX loop, whose site the requirement carries */
  noteLdrexStrexLoop(): void {
    this.ldrexStrexLoop = true;
    this.noteSite("ldrex_strex_loop", null);
  }

  get castHelpers(): ReadonlySet<string> {
    return this.castHelperKeys;
  }

  get lengthHelpers(): ReadonlySet<string> {
    return this.lengthHelperNames;
  }

  get safeDivisions(): ReadonlySet<string> {
    return this.safeDivisionKeys;
  }

  get emitsLdrexStrexLoop(): boolean {
    return this.ldrexStrexLoop;
  }

  sitesOf(key: TDeferredSiteKey): readonly IRequirementSite[] {
    return this.sites.get(key) ?? [];
  }

  private noteSite(key: TDeferredSiteKey, line: number | null): void {
    RequirementSites.accumulate(this.sites, key, [
      { sourcePath: this.sourcePath, line },
    ]);
  }
}

export default PlannedRequirements;
