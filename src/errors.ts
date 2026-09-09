export type ByoagErrorCode =
  | "invalid_domain"
  | "discovery_not_found"
  | "discovery_invalid"
  | "issuer_mismatch"
  | "unsupported_version"
  | "network_error"
  | "platform_error"
  | "connection_not_found"
  | "pairing_code_required"
  | "pairing_code_invalid"
  | "confirmation_required"
  | "registration_not_found"
  | "engagement_invalid"
  | "credential_unavailable"
  | "secret_reference_invalid"
  | "storage_error";

export class ByoagError extends Error {
  constructor(
    public readonly code: ByoagErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "ByoagError";
  }
}

export function asByoagError(error: unknown): ByoagError {
  if (error instanceof ByoagError) return error;
  return new ByoagError("platform_error", "The BYOAg operation failed.");
}
