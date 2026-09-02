export class H2ConfigError extends Error {
  readonly missingKeys: string[];

  constructor(missingKeys: string[]) {
    super(
      missingKeys.length > 0
        ? `H2 config invalid: chybí nebo je neplatná hodnota pro: ${missingKeys.join(", ")}`
        : "H2 config invalid",
    );
    this.name = "H2ConfigError";
    this.missingKeys = missingKeys;
  }
}
