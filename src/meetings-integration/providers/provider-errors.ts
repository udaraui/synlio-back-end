/**
 * Error types shared by all meeting providers.
 *
 * The distinction matters because the two cases need opposite handling:
 *  - ProviderAuthError    → the grant is dead, only a new OAuth consent fixes it.
 *  - ProviderTransientError → a blip (network, 429, 5xx). Retrying later works,
 *    so the connection must NOT be flipped to "error" / forced to reconnect.
 */

export class ProviderAuthError extends Error {
  readonly requiresReauth = true;

  constructor(
    readonly provider: string,
    message: string,
    readonly providerCode?: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'ProviderAuthError';
  }
}

export class ProviderTransientError extends Error {
  readonly requiresReauth = false;

  constructor(
    readonly provider: string,
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'ProviderTransientError';
  }
}

/**
 * OAuth 2.0 error codes (RFC 6749 §5.2) that mean the refresh token / grant is
 * permanently unusable. Anything else from the token endpoint is treated as
 * transient so we don't force a reconnect over a temporary Google hiccup.
 */
const FATAL_OAUTH_CODES = new Set([
  'invalid_grant',
  'invalid_client',
  'unauthorized_client',
  'invalid_scope',
  'access_denied',
  'consent_required',
]);

/** Human-readable explanation for the OAuth codes users actually hit. */
const REAUTH_MESSAGES: Record<string, string> = {
  invalid_grant:
    'Google access expired or was revoked. Please reconnect your Google account.',
  invalid_client:
    'Google app credentials are invalid. Contact your administrator.',
  unauthorized_client:
    'This Google app is not authorized for the requested access. Contact your administrator.',
  invalid_scope:
    'The requested Google permissions are no longer granted. Please reconnect.',
  access_denied: 'Google access was denied. Please reconnect your account.',
  consent_required: 'Google requires consent again. Please reconnect.',
};

/**
 * Google answers 403 both for "you may not do this" and for plain rate
 * limiting. Only the former is worth disconnecting the user over.
 */
const TRANSIENT_403_REASONS = [
  'ratelimitexceeded',
  'userratelimitexceeded',
  'quotaexceeded',
  'backenderror',
  'variabletermexpireddailyexceeded',
];

/**
 * Classifies an axios failure from a provider token/API endpoint.
 * Always throws — either ProviderAuthError or ProviderTransientError.
 */
export function throwClassifiedProviderError(
  provider: string,
  err: any,
  context: string,
): never {
  const status: number | undefined = err?.response?.status;
  const body = err?.response?.data;
  // OAuth token endpoints use `error: "invalid_grant"`; Google REST APIs use
  // `error: { status, message, errors: [{ reason }] }`.
  const oauthCode: string | undefined =
    typeof body?.error === 'string' ? body.error : undefined;
  const apiReason: string = String(
    body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? '',
  ).toLowerCase();
  const description: string | undefined =
    body?.error_description ?? body?.error?.message;

  if (oauthCode && FATAL_OAUTH_CODES.has(oauthCode)) {
    throw new ProviderAuthError(
      provider,
      REAUTH_MESSAGES[oauthCode] ??
        description ??
        `${provider} authorization is no longer valid. Please reconnect.`,
      oauthCode,
      status,
    );
  }

  // A bare 401 from an API call usually just means the access token aged out;
  // the caller retries after a forced refresh (see httpStatus below).
  if (status === 401) {
    throw new ProviderAuthError(
      provider,
      description ?? `${provider} access token was rejected.`,
      apiReason || 'unauthenticated',
      401,
    );
  }

  if (status === 403 && !TRANSIENT_403_REASONS.includes(apiReason)) {
    throw new ProviderAuthError(
      provider,
      description ??
        `${provider} denied access with the granted permissions. Please reconnect.`,
      apiReason || 'forbidden',
      403,
    );
  }

  const detail = description ?? oauthCode ?? apiReason ?? err?.message ?? 'Unknown error';
  throw new ProviderTransientError(
    provider,
    `${context} failed (HTTP ${status ?? 'n/a'}): ${detail}`,
    status,
  );
}

/**
 * True when the failure was a 401 — either a raw axios error or one already
 * classified by throwClassifiedProviderError. A forced token refresh is worth
 * trying before declaring the connection broken.
 */
export function isUnauthorized(err: any): boolean {
  if (err instanceof ProviderAuthError) return err.httpStatus === 401;
  return err?.response?.status === 401;
}
