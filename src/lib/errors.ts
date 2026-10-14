export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class RetryLaterError extends Error {
  constructor(public retryAt: string) {
    super(
      "Limite temporário da UTMify. Aguarde o intervalo indicado pela plataforma.",
    );
  }
}
