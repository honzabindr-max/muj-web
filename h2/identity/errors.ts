export class H2AuthError extends Error {
  constructor(public readonly code: "UNAUTHENTICATED" | "UNKNOWN_OWNER") {
    super(`H2 auth: ${code}`);
    this.name = "H2AuthError";
  }
}

export class H2ReauthRequiredError extends Error {
  constructor() {
    super("H2 auth: REAUTH_REQUIRED");
    this.name = "H2ReauthRequiredError";
  }
}

export class H2CsrfError extends Error {
  constructor() {
    super("H2 auth: CSRF_REJECTED");
    this.name = "H2CsrfError";
  }
}
