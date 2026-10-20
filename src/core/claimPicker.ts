/**
 * Pure helper for extracting and formatting human-meaningful claims
 * for display in ambient glance badges and CodeLens.
 */

const MAX_CLAIM_DISPLAY_LENGTH = 60;

/**
 * Resolves a nested property from an object using dot notation (e.g. 'user.email').
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  if (path in obj) {
    return obj[path];
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function normalizeClaimString(raw: string): string {
  return raw.replace(/[\x00-\x1f\x7f-\x9f\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Formats a raw claim value into a compact string suitable for inline badge display.
 */
function formatClaimValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const normalized = normalizeClaimString(value);
    if (normalized.length === 0) {
      return null;
    }
    return normalized.length > MAX_CLAIM_DISPLAY_LENGTH
      ? `${normalized.slice(0, MAX_CLAIM_DISPLAY_LENGTH - 1)}…`
      : normalized;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const scalarItems = value
      .filter((item): item is string | number => typeof item === 'string' || typeof item === 'number')
      .map((item) => normalizeClaimString(String(item)))
      .filter((item) => item.length > 0);

    if (scalarItems.length === 0) {
      return null;
    }

    const joined = scalarItems.join(', ');
    return joined.length > MAX_CLAIM_DISPLAY_LENGTH
      ? `${joined.slice(0, MAX_CLAIM_DISPLAY_LENGTH - 1)}…`
      : joined;
  }

  return null;
}

/**
 * Resolves up to maxClaims non-empty claim values matching candidate claim keys in priority order.
 *
 * @param payload Parsed JWT payload claims dictionary
 * @param candidates Single key or array of claim keys to search in order (e.g. ['roles', 'name', 'email', 'sub'])
 * @param maxClaims Maximum number of claims to return (default: 3)
 * @returns Array of formatted claim strings (up to maxClaims)
 */
export function resolveGlanceClaims(
  payload?: Record<string, unknown>,
  candidates: string | string[] = ['roles', 'name', 'email', 'sub'],
  maxClaims = 3
): string[] {
  if (!payload || typeof payload !== 'object' || maxClaims <= 0) {
    return [];
  }

  const candidateList = Array.isArray(candidates)
    ? candidates
    : typeof candidates === 'string'
      ? [candidates]
      : ['sub'];

  const results: string[] = [];
  const seen = new Set<string>();

  for (const key of candidateList) {
    if (!key || typeof key !== 'string') {
      continue;
    }

    const trimmedKey = key.trim();
    if (!trimmedKey) {
      continue;
    }

    const rawValue = getNestedValue(payload, trimmedKey);
    const formatted = formatClaimValue(rawValue);
    if (formatted !== null && !seen.has(formatted)) {
      seen.add(formatted);
      results.push(formatted);
      if (results.length >= maxClaims) {
        break;
      }
    }
  }

  return results;
}

/**
 * Picks the first non-empty claim value matching candidate claim keys in priority order.
 *
 * @param payload Parsed JWT payload claims dictionary
 * @param candidates Single key or array of claim keys to search in order (e.g. ['email', 'preferred_username', 'sub'])
 * @returns Formatted claim string or null if none found
 */
export function resolveGlanceClaim(
  payload?: Record<string, unknown>,
  candidates: string | string[] = ['sub']
): string | null {
  const claims = resolveGlanceClaims(payload, candidates, 1);
  return claims[0] ?? null;
}

