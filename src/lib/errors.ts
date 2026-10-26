export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const domainStatus = {
  invalid_input: 400,
  not_found: 404,
  conflict: 409,
  limit_reached: 429,
  unavailable: 503,
} as const;
export type DomainErrorCode = keyof typeof domainStatus;

/** Domain failure whose message is plain pt-BR text safe to show to the end user. */
export class DomainError extends Error {
  constructor(
    public code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
  get status() {
    return domainStatus[this.code];
  }
}

export class RetryLaterError extends Error {
  constructor(
    public provider: string,
    public retryAt: string,
  ) {
    super(
      `${provider} limitou as consultas temporariamente. A próxima sincronização acontece depois do intervalo indicado.`,
    );
    this.name = "RetryLaterError";
  }
}

/** The provider refused the credentials for good; retrying cannot help, the user must act. */
export class ProviderRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderRejectedError";
  }
}

/** Backup failure with a fixed message: never echoes object keys, SQL or tool output. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

/** Server misconfiguration; names only the group, never values. */
export class ConfigError extends Error {
  constructor(group: string) {
    super(`Missing or invalid ${group} configuration`);
    this.name = "ConfigError";
  }
}
