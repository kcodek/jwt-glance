import type { UnrecognizedToken } from './types';

export interface ParsedJwtSuccess {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
}

export type ParseJwtResult = ParsedJwtSuccess | UnrecognizedToken;

function decodeBase64UrlJson(segment: string): Record<string, unknown> | null {
  try {
    const jsonStr = Buffer.from(segment, 'base64url').toString('utf8');
    const parsed = JSON.parse(jsonStr) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function parseJwt(token: string): ParseJwtResult {
  const parts = token.split('.');
  if (parts.length !== 2 && parts.length !== 3) {
    return {
      recognized: false,
      reason: 'INVALID_SEGMENT_COUNT'
    };
  }

  const [headerB64, payloadB64, signature] = parts;
  if (!headerB64 || !payloadB64) {
    return {
      recognized: false,
      reason: 'INVALID_SEGMENT_COUNT'
    };
  }

  const header = decodeBase64UrlJson(headerB64);
  if (!header || typeof header['alg'] !== 'string') {
    return {
      recognized: false,
      reason: 'MALFORMED_HEADER'
    };
  }

  const payload = decodeBase64UrlJson(payloadB64);
  if (!payload) {
    return {
      recognized: false,
      reason: 'MALFORMED_PAYLOAD'
    };
  }

  return {
    header,
    payload,
    signature: signature ?? ''
  };
}
