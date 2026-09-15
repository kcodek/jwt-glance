import { parseJwt } from './parse';

const MD_CHAR_REGEX = /([\\`*_{}[\]()|<>~])/g;

export function sanitizeMarkdown(input: unknown): string {
  if (input === null || input === undefined) {
    return '';
  }
  const str = typeof input === 'string' ? input : String(input);
  return str.replace(MD_CHAR_REGEX, '\\$1');
}

export const SAFE_HEADER_CLAIMS = new Set(['alg', 'typ', 'cty']);
export const SAFE_PAYLOAD_CLAIMS = new Set(['exp', 'nbf', 'iat']);

export function createRedactedJwt(rawToken: string): string {
  const parsed = parseJwt(rawToken);
  if ('reason' in parsed) {
    return rawToken;
  }

  const { header, payload, segmentCount, hasSignature } = parsed;

  // 1. Strict header allowlist (preserving only alg, typ, cty)
  const sanitizedHeader: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(header)) {
    if (SAFE_HEADER_CLAIMS.has(key)) {
      sanitizedHeader[key] = value;
    } else {
      sanitizedHeader[key] = '[REDACTED]';
    }
  }

  // 2. Strict payload allowlist (preserving only exp, nbf, iat)
  const sanitizedPayload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SAFE_PAYLOAD_CLAIMS.has(key)) {
      sanitizedPayload[key] = value;
    } else {
      sanitizedPayload[key] = '[REDACTED]';
    }
  }

  const headerB64 = Buffer.from(JSON.stringify(sanitizedHeader)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(sanitizedPayload)).toString('base64url');

  if (segmentCount === 2) {
    return `${headerB64}.${payloadB64}`;
  }

  const sigSegment = hasSignature ? 'REDACTED_SIGNATURE' : '';
  return `${headerB64}.${payloadB64}.${sigSegment}`;
}

/**
 * Backward-compatible alias for createRedactedJwt
 */
export const createSanitizedJwt = createRedactedJwt;

