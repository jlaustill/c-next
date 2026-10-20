/** The build machine's environment variables, as `process.env` holds them */
type TEnvironment = Readonly<Record<string, string | undefined>>;

export default TEnvironment;
