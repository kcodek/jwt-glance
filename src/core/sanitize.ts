import { parseJwt } from './parse';

const MD_CHAR_REGEX = /([\\`*_{}[\]()|<>~])/g;

export function sanitizeMarkdown(input: unknown): string {
  if (input === null || input === undefined) {
    return '';
  }
  const str = typeof input === 'string' ? input : String(input);
  return str.replace(MD_CHAR_REGEX, '\\$1');
}

const PRESERVED_CLAIMS = new Set(['exp', 'nbf', 'iat']);

export function createSanitizedJwt(rawToken: string): string {
  const parsed = parseJwt(rawToken);
  if ('reason' in parsed) {
    return rawToken;
  }

  const { header, payload, segmentCount } = parsed;
  const sanitizedPayload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (PRESERVED_CLAIMS.has(key)) {
      sanitizedPayload[key] = value;
    } else if (key === 'iss') {
      sanitizedPayload[key] = 'https://issuer.example.com';
    } else if (key === 'aud') {
      sanitizedPayload[key] = Array.isArray(value) ? ['audience-example'] : 'audience-example';
    } else if (key === 'sub') {
      sanitizedPayload[key] = 'sanitized-subject';
    } else if (typeof value === 'string') {
      sanitizedPayload[key] = '[REDACTED]';
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitizedPayload[key] = value;
    } else if (Array.isArray(value)) {
      sanitizedPayload[key] = ['[REDACTED]'];
    } else if (typeof value === 'object' && value !== null) {
      sanitizedPayload[key] = { sanitized: true };
    } else {
      sanitizedPayload[key] = '[REDACTED]';
    }
  }

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(sanitizedPayload)).toString('base64url');

  if (segmentCount === 2) {
    return `${headerB64}.${payloadB64}`;
  }

  const sigB64 = parsed.hasSignature ? Buffer.from('sanitized_signature').toString('base64url') : '';
  return `${headerB64}.${payloadB64}.${sigB64}`;
}
