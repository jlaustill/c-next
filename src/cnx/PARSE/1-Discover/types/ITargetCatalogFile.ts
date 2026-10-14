/** ADR-049: the target catalog's text, read by 1.1 Discover, and where it was read */
interface ITargetCatalogFile {
  readonly path: string;
  readonly text: string;
}

export default ITargetCatalogFile;
