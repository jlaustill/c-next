/** Where the project board is: enough to write to it and to link to it. */
interface IProjectRef {
  /** The project's node id, which every GraphQL write takes. */
  id: string;

  /** The project's number within its owner, as in `/orgs/<owner>/projects/<n>`. */
  number: number;

  /** The project's web address. */
  url: string;
}

export default IProjectRef;
